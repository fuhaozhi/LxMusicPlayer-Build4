/**
 * 播放器上下文 —— react-native-video 播放 + 音源脚本取链（lx-ios-api）。
 * 取链策略：酷我歌曲直接走官方直链（antiserver.kuwo.cn，不依赖音源脚本）；
 * 其余源优先音源脚本取链，失败自动用酷我同名歌曲兜底播放（保证一定能播）。
 * 播放模式：顺序播放 / 单曲循环 / 随机播放（持久化）。
 * 附加能力：进度 seek、锁屏「正在播放」与远程控制、上次播放缓存自动续播、定时关闭。
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, NativeModules } from 'react-native';
import Video from 'react-native-video';
import { LxMusicApi } from '../lx-api/index.js';
import type { LxMusicApi as LxMusicApiType } from '../lx-api/index.js';
import { LUODIAN_SCRIPT, NIANXIN_SCRIPT, SUYIN_SCRIPT } from '../lx-api/builtinSources';
import type { PlayerState, Song } from '../types';
import { toMusicInfo } from '../sourceManager';
import { useLibrary } from '../library';
import { resolveCover } from '../cover';
import { searchKuwo } from '../searchSources';
import { KEYS, load, save } from '../storage';
import { formatTime } from './lrc';

/** 播放模式：order=顺序循环 / single=单曲循环 / random=随机播放 */
export type PlayMode = 'order' | 'single' | 'random';

interface PlayerContextValue {
  state: PlayerState;
  queue: Song[];
  play: (song: Song, api: LxMusicApi | null, queue?: Song[]) => Promise<void>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  /** 跳转到指定秒数（进度条拖动 / 锁屏拖动） */
  seekTo: (t: number) => void;
  setCurrentTime: (t: number) => void;
  /** 恢复上次播放（App 启动、音源加载完成后调用） */
  restoreLast: (api: LxMusicApi | null) => Promise<void>;
  /** 定时关闭：剩余秒数（0 表示未开启） */
  sleepRemaining: number;
  /** 开启/调整定时关闭（分钟）；<=0 为取消 */
  startSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  /** 当前播放模式 */
  mode: PlayMode;
  /** 循环切换播放模式：顺序 → 单曲 → 随机 → 顺序 */
  cycleMode: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

const QUALITY_FALLBACK = ['320k', '128k'] as const;

/** 上次播放的持久化结构（含完整队列，重启后恢复整个列表继续播） */
interface LastPlay {
  song: Song;
  queue: Song[];
  index: number;
  currentTime: number;
  ts: number;
}

/** 定时关闭：到点自动暂停 */
interface SleepTimer {
  endsAt: number;
  total: number;
}

const NowPlayingNative = NativeModules?.LxNowPlaying as
  | {
      setNowPlaying?: (info: any) => void;
      clearNowPlaying?: () => void;
      setCommandHandler?: (handler: ((events: any[]) => void) | null) => void;
      keepSessionActive?: () => void;
      updateProgress?: (currentTime: number, rate: number) => void;
    }
  | undefined;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const library = useLibrary();
  const [state, setState] = useState<PlayerState>({
    song: null,
    url: null,
    paused: true,
    buffering: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });
  const [queue, setQueue] = useState<Song[]>([]);
  const apiRef = useRef<LxMusicApi | null>(null);
  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(-1);
  const videoRef = useRef<any>(null);
  /** 待 seek 的进度（续播用，onLoad 后执行；绑定目标歌曲，防切歌/换源后残留错位 seek） */
  const pendingSeekRef = useRef<{ songKey: string; time: number } | null>(null);
  /** 上次上报的播放进度（防原生回退值导致进度条乱跳） */
  const lastProgressRef = useRef(0);
  /** 上次 seek 时间戳（防抖：seek 后短暂忽略 onProgress 回跳） */
  const seekAtRef = useRef(0);
  /** 进度写盘节流 */
  const lastPersistRef = useRef(0);
  /** 锁屏信息更新节流 */
  const lastLockRef = useRef(0);
  const lastLockKeyRef = useRef('');
  /** 预取的下一首播放地址（熄屏/后台切歌用） */
  const prefetchRef = useRef<{ songKey: string; url: string } | null>(null);
  const prefetchSeqRef = useRef(0);
  /** 内置音源（聆澜：主音源付费完整；念心：QQ/酷狗 免费兜底；溯音：酷我 免费兜底）懒加载实例 */
  const builtinApiRef = useRef<{ luodian?: LxMusicApiType; nianxin?: LxMusicApiType; suyin?: LxMusicApiType }>({});
  /** 懒加载内置音源 API（本地脚本字符串，不依赖网络下载；失败返回 null 不阻塞播放） */
  const getBuiltinApi = async (which: 'luodian' | 'nianxin' | 'suyin'): Promise<LxMusicApiType | null> => {
    if (!builtinApiRef.current[which]) {
      try {
        const script = which === 'luodian' ? LUODIAN_SCRIPT : which === 'nianxin' ? NIANXIN_SCRIPT : SUYIN_SCRIPT;
        builtinApiRef.current[which] = await LxMusicApi.fromScript(script, {
          initTimeout: 12_000,
          requestTimeout: 15_000,
          logger: () => {},
        });
      } catch {
        return null;
      }
    }
    return builtinApiRef.current[which] ?? null;
  };
  /** 当前歌曲是否已触发后台保活（每首歌只触发一次） */
  const bgKeepRef = useRef(false);
  /** 播放模式（持久化 + ref 同步，onEnd/next 内用 ref 避免闭包旧值） */
  const [mode, setMode] = useState<PlayMode>(() => load<PlayMode>(KEYS.playMode, 'order'));
  const modeRef = useRef<PlayMode>(mode);

  const songKeyOf = (s: Song) => `${s.source}:${s.id}`;

  /** 定时关闭状态与剩余秒数 */
  const [sleepTimer, setSleepTimer] = useState<SleepTimer | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);

  const startSleepTimer: PlayerContextValue['startSleepTimer'] = minutes => {
    if (minutes <= 0) {
      setSleepTimer(null);
      setSleepRemaining(0);
      return;
    }
    const total = minutes * 60 * 1000;
    setSleepTimer({ endsAt: Date.now() + total, total });
    setSleepRemaining(minutes * 60);
  };

  const cancelSleepTimer: PlayerContextValue['cancelSleepTimer'] = () => {
    setSleepTimer(null);
    setSleepRemaining(0);
  };

  /** 循环切换播放模式并持久化 */
  const cycleMode: PlayerContextValue['cycleMode'] = () => {
    const nextMode: PlayMode = mode === 'order' ? 'single' : mode === 'single' ? 'random' : 'order';
    setMode(nextMode);
    modeRef.current = nextMode;
    save(KEYS.playMode, nextMode);
  };

  // 定时关闭倒计时：到点自动暂停
  useEffect(() => {
    if (!sleepTimer) return;
    const id = setInterval(() => {
      const remainMs = sleepTimer.endsAt - Date.now();
      if (remainMs <= 0) {
        clearInterval(id);
        setSleepTimer(null);
        setSleepRemaining(0);
        setState(prev => ({ ...prev, paused: true }));
        return;
      }
      setSleepRemaining(Math.ceil(remainMs / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sleepTimer]);

  const persistPlay = (song: Song, currentTime: number) => {
    const last: LastPlay = {
      song,
      queue: queueRef.current.length > 0 ? queueRef.current : [song],
      index: indexRef.current >= 0 ? indexRef.current : 0,
      currentTime,
      ts: Date.now(),
    };
    save(KEYS.lastPlay, last);
  };

  /** 酷我官方直链：antiserver.kuwo.cn 返回真实 mp3 地址（官方接口，不依赖音源脚本；用 https 避开 iOS 明文限制） */
  const kuwoDirectUrl = async (rid: string): Promise<string> => {
    const url = `https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${rid}&format=mp3&response=url`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = (await resp.text()).trim();
      if (!/^https?:\/\//.test(text)) throw new Error('酷我直链返回异常');
      return text;
    } finally {
      clearTimeout(timer);
    }
  };

  /** 酷狗官方直链：m.kugou.com playInfo 返回真实音频地址（官方接口，不依赖音源脚本） */
  const kugouDirectUrl = async (hash: string): Promise<string> => {
    const url = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${encodeURIComponent(hash)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      const u: string = j?.url || j?.backup_url?.[0] || '';
      if (!/^https?:\/\//.test(u)) throw new Error('酷狗返回异常');
      return u;
    } finally {
      clearTimeout(timer);
    }
  };

  /** 网易云官方直链：enhance/player/url 返回真实音频地址（官方接口，实测可用；返回地址统一转 https） */
  const wyDirectUrl = async (id: string): Promise<string> => {
    const url = `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=128000`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const resp = await fetch(url, {
        headers: { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      const u: string = j?.data?.[0]?.url || '';
      if (!/^https?:\/\//.test(u)) throw new Error('网易返回异常');
      return u.startsWith('http://') ? 'https://' + u.slice(7) : u;
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * 统一取播放地址：点什么歌就播什么歌
   * 内置音源优先（实测 VIP 完整播放）：
   * - 聆澜（赞助版主音源）：QQ/酷狗/酷我/网易/咪咕 全平台完整 → 失败再降级
   * - 免费兜底：酷我→溯音；QQ/酷狗→念心
   * - 官方直链 → 用户音源脚本
   */
  const resolvePlayUrl = async (song: Song, api: LxMusicApiType | null): Promise<string> => {
    // 1) 聆澜音源（赞助版）优先：全平台完整播放
    try {
      const luodian = await getBuiltinApi('luodian');
      if (luodian) {
        const res = await luodian.getMusicUrl(song.source, toMusicInfo(song), '128k');
        if (res?.url) return res.url;
      }
    } catch {
      /* 聆澜失败，降级免费内置音源 */
    }
    // 2) 免费内置音源：酷我→溯音；QQ/酷狗→念心
    if (song.source === 'kw' || song.source === 'tx' || song.source === 'kg') {
      try {
        const builtin = await getBuiltinApi(song.source === 'kw' ? 'suyin' : 'nianxin');
        if (builtin) {
          const res = await builtin.getMusicUrl(song.source, toMusicInfo(song), '128k');
          if (res?.url) return res.url;
        }
      } catch {
        /* 内置音源失败，走官方直链/脚本兜底 */
      }
    }
    // 3) 官方直链（不依赖音源脚本）
    if (song.source === 'kw' && song.hash) {
      try {
        return await kuwoDirectUrl(song.hash);
      } catch {
        /* 官方直链失败，继续尝试 */
      }
    }
    if (song.source === 'kg' && song.hash) {
      try {
        return await kugouDirectUrl(song.hash);
      } catch {
        /* 官方直链失败，落回音源脚本尝试 */
      }
    }
    if (song.source === 'wy' && song.id) {
      try {
        return await wyDirectUrl(song.id);
      } catch {
        /* 官方直链失败，落回音源脚本尝试 */
      }
    }
    // 4) 用户选择的音源脚本
    if (api) {
      const cap = api.getSource(song.source);
      if (cap?.actions.includes('musicUrl')) {
        for (const quality of QUALITY_FALLBACK) {
          try {
            const res = await api.getMusicUrl(song.source, toMusicInfo(song), quality);
            if (res?.url) return res.url;
          } catch {
            /* 尝试下一档音质 */
          }
        }
      }
    }
    if (song.source === 'tx') {
      throw new Error('QQ 音乐当前音源不可用，请稍后重试');
    }
    throw new Error('音源暂不可用，无法播放这首歌');
  };

  /** 直接以已知 URL 播放并进入就绪态 */
  const applySong = (index: number, queueList: Song[], api: LxMusicApi | null, url: string) => {
    const song = queueList[index];
    if (!song) return;
    const p = pendingSeekRef.current;
    if (p && p.songKey !== songKeyOf(song)) pendingSeekRef.current = null;
    seekAtRef.current = 0;
    lastProgressRef.current = 0;
    apiRef.current = api;
    indexRef.current = index;
    queueRef.current = queueList;
    setQueue(queueList);
    setState(prev => ({
      ...prev,
      song,
      url,
      paused: false,
      buffering: false,
      error: null,
      currentTime: 0,
      duration: 0,
    }));
    library.bumpPlay(song);
    library.addRecent(song);
    persistPlay(song, 0);
    bgKeepRef.current = false;
    void prefetchNext(index, queueList, api);
  };

  /** 预取下一首播放地址（静默失败；队列末尾循环回第一首） */
  const prefetchNext = async (index: number, queueList: Song[], api: LxMusicApi | null) => {
    const seq = ++prefetchSeqRef.current;
    try {
      if (queueList.length === 0) return;
      const ni = index < queueList.length - 1 ? index + 1 : 0;
      const target = queueList[ni];
      if (!target) return;
      let url: string | null = null;
      try {
        url = await resolvePlayUrl(target, api);
      } catch {
        /* 预取失败不阻塞 */
      }
      if (seq !== prefetchSeqRef.current) return;
      prefetchRef.current = url ? { songKey: songKeyOf(target), url } : null;
    } catch {
      if (seq === prefetchSeqRef.current) prefetchRef.current = null;
    }
  };

  const playIndex = async (index: number, queueList: Song[], api: LxMusicApi | null) => {
    const song = queueList[index];
    if (!song) return;
    apiRef.current = api;
    indexRef.current = index;
    queueRef.current = queueList;
    setQueue(queueList);
    lastProgressRef.current = 0;
    setState(prev => ({
      ...prev,
      song,
      url: null,
      paused: true,
      buffering: true,
      currentTime: 0,
      duration: 0,
      error: null,
    }));

    let url: string | null = null;
    let lastError: any = null;
    try {
      url = await resolvePlayUrl(song, api);
    } catch (e) {
      lastError = e;
    }

    if (!url) {
      // 取链失败 → 明确报错（不自动换其他版本播放）
      setState(prev => ({
        ...prev,
        paused: true,
        buffering: false,
        error: `播放失败：${lastError?.message ?? '取链失败'}`,
      }));
      pendingSeekRef.current = null;
      return;
    }
    applySong(index, queueList, api, url);
  };

  const play: PlayerContextValue['play'] = async (song, api, queueList = [song]) => {
    const idx = queueList.findIndex(s => s === song || (s.source === song.source && s.id === song.id));
    await playIndex(idx >= 0 ? idx : 0, queueList, api);
  };

  const toggle = () => setState(prev => ({ ...prev, paused: !prev.paused }));

  /** 下一首：manual=true 为手动（单曲循环也切歌）；manual=false 为自动播完（单曲循环重播当前） */
  const next = (manual = true) => {
    const list = queueRef.current;
    if (list.length === 0) return;
    let ni: number;
    const m = modeRef.current;
    if (m === 'random' && list.length > 1) {
      let r = Math.floor(Math.random() * list.length);
      if (r === indexRef.current) r = (r + 1) % list.length;
      ni = r;
    } else if (m === 'single' && !manual) {
      // 单曲循环自动播完：重播当前（由 onEnd 处理 seek(0)，这里不切歌）
      return;
    } else {
      ni = indexRef.current < list.length - 1 ? indexRef.current + 1 : 0;
    }
    const target = list[ni];
    if (!target) return;
    const pf = prefetchRef.current;
    if (pf && pf.songKey === songKeyOf(target)) {
      prefetchRef.current = null;
      applySong(ni, list, apiRef.current, pf.url);
      return;
    }
    void playIndex(ni, list, apiRef.current);
  };

  const prev = () => {
    const list = queueRef.current;
    if (list.length === 0) return;
    const pi = indexRef.current > 0 ? indexRef.current - 1 : list.length - 1;
    void playIndex(pi, list, apiRef.current);
  };

  const seekTo: PlayerContextValue['seekTo'] = t => {
    const target = Math.max(0, Number(t) || 0);
    seekAtRef.current = Date.now();
    setState(prev => ({ ...prev, currentTime: target }));
    try {
      videoRef.current?.seek(target);
    } catch {
      /* 个别引擎不支持 seek 时忽略 */
    }
    // 立即同步锁屏进度基准（拖动后原生自推从新位置继续，不沿用旧进度）
    if (state.song && state.url && NowPlayingNative?.updateProgress) {
      NowPlayingNative.updateProgress(target, state.paused ? 0 : 1);
    }
  };

  /** 恢复上次播放：恢复完整队列与当前歌曲，重新取链并续播 */
  const restoreLast: PlayerContextValue['restoreLast'] = async api => {
    if (state.song) return;
    const last = load<LastPlay | null>(KEYS.lastPlay, null);
    if (!last?.song) return;
    const q = Array.isArray(last.queue) && last.queue.length > 0 ? last.queue : [last.song];
    let idx =
      Number.isInteger(last.index) && last.index >= 0 && last.index < q.length ? last.index : 0;
    if (!q[idx] || q[idx].source !== last.song.source || q[idx].id !== last.song.id) {
      const found = q.findIndex(s => s.source === last.song.source && s.id === last.song.id);
      idx = found >= 0 ? found : 0;
    }
    pendingSeekRef.current = {
      songKey: songKeyOf(last.song),
      time: Math.max(0, Number(last.currentTime) || 0),
    };
    await playIndex(idx, q, api);
  };

  // ---- 回前台强制校准进度 ----
  // iOS 后台/锁屏时 react-native-video 的 onProgress 会停发，且回前台不一定自动恢复，
  // 导致进度条卡在锁屏前的值。回前台主动 getCurrentTime 校准一次。
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return;
      setTimeout(() => {
        try {
          const v = videoRef.current;
          if (!v) return;
          v.getCurrentTime()
            .then((t: number) => {
              const nt = Number(t) || 0;
              if (nt <= 0) return;
              lastProgressRef.current = nt;
              setState(prev => {
                if (Math.abs(prev.currentTime - nt) < 1) return prev;
                return { ...prev, currentTime: nt };
              });
              // 同步校准锁屏进度基准（原生自推可能已漂移）
              if (NowPlayingNative?.updateProgress) {
                NowPlayingNative.updateProgress(nt, state.paused ? 0 : 1);
              }
            })
            .catch(() => {});
        } catch {
          /* 播放器未就绪时忽略 */
        }
      }, 400);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.url]);

  // ---- 锁屏「正在播放」 ----
  // 播放中不重复推送（原生自推锁屏进度，避免低频 JS 值覆盖导致锁屏卡/回跳）；
  // 仅切歌/暂停/时长变化时推送完整信息。
  useEffect(() => {
    if (!NowPlayingNative?.setNowPlaying) return;
    if (!state.song || !state.url) {
      NowPlayingNative.clearNowPlaying?.();
      return;
    }
    const now = Date.now();
    const key = `${songKeyOf(state.song)}|${state.duration}|${state.paused}`;
    if (key !== lastLockKeyRef.current) {
      lastLockKeyRef.current = key;
      lastLockRef.current = now;
    } else if (
      now - lastLockRef.current < 60_000 &&
      state.currentTime > 0 &&
      !state.paused
    ) {
      return;
    } else {
      lastLockRef.current = now;
    }
    const info = {
      title: state.song.name,
      artist: state.song.singer,
      album: state.song.album ?? '',
      duration: state.duration || 0,
      currentTime: state.currentTime || 0,
      rate: state.paused ? 0 : 1,
    };
    if (state.song.pic) {
      NowPlayingNative.setNowPlaying({ ...info, artworkUrl: state.song.pic });
    } else {
      resolveCover(state.song).then(dataUri => {
        NowPlayingNative?.setNowPlaying?.({ ...info, artworkUrl: dataUri ?? '' });
      });
    }
  }, [state.song, state.url, state.paused, state.duration, state.currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 锁屏远程控制 ----
  useEffect(() => {
    const mod = NowPlayingNative;
    if (!mod?.setCommandHandler) return;
    const handler = (events: any[]) => {
      const e = Array.isArray(events) ? events[0] : events;
      switch (e?.type) {
        case 'play':
          setState(prev => ({ ...prev, paused: false }));
          break;
        case 'pause':
          setState(prev => ({ ...prev, paused: true }));
          break;
        case 'toggle':
          toggle();
          break;
        case 'next':
          next(true);
          break;
        case 'prev':
          prev();
          break;
        case 'seek':
          seekTo(Number(e.position) || 0);
          break;
        default:
          break;
      }
    };
    mod.setCommandHandler(handler);
    return () => {
      mod.setCommandHandler?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const videoSource = useMemo(() => (state.url ? { uri: state.url } : null), [state.url]);

  return (
    <PlayerContext.Provider
      value={{
        state,
        queue,
        play,
        toggle,
        next,
        prev,
        seekTo,
        setCurrentTime: t => setState(prev => ({ ...prev, currentTime: t })),
        restoreLast,
        sleepRemaining,
        startSleepTimer,
        cancelSleepTimer,
        mode,
        cycleMode,
      }}
    >
      {children}
      {state.url ? (
        <Video
          ref={videoRef}
          source={videoSource as { uri: string }}
          paused={state.paused}
          playInBackground
          playWhenInactive
          ignoreSilentSwitch="ignore"
          onLoad={({ duration }) => {
            setState(prev => ({ ...prev, duration }));
            const p = pendingSeekRef.current;
            if (p) {
              pendingSeekRef.current = null;
              if (state.song && p.songKey === songKeyOf(state.song)) {
                const target = p.time > 0 && duration > 0 && p.time < duration - 5 ? p.time : 0;
                seekAtRef.current = Date.now();
                if (target > 0) {
                  try {
                    videoRef.current?.seek(target);
                  } catch { /* 忽略 */ }
                }
                setState(prev => ({ ...prev, currentTime: target }));
              }
            }
          }}
          onProgress={({ currentTime }) => {
            if (Date.now() - seekAtRef.current < 3000) return;
            const t = Number(currentTime) || 0;
            if (t < lastProgressRef.current - 1.5) return;
            lastProgressRef.current = t;
            setState(prev => ({ ...prev, currentTime: t }));
            if (!bgKeepRef.current && state.song && state.duration > 10 && t > state.duration - 6) {
              bgKeepRef.current = true;
              NowPlayingNative?.keepSessionActive?.();
            }
            const now = Date.now();
            if (state.song && now - lastPersistRef.current > 10_000) {
              lastPersistRef.current = now;
              persistPlay(state.song, t);
            }
          }}
          onEnd={() => {
            library.bumpSeconds(state.duration);
            if (!bgKeepRef.current) {
              bgKeepRef.current = true;
              NowPlayingNative?.keepSessionActive?.();
            }
            if (modeRef.current === 'single') {
              // 单曲循环：重播当前
              try {
                videoRef.current?.seek(0);
              } catch { /* 忽略 */ }
              seekAtRef.current = Date.now();
              setState(prev => ({ ...prev, paused: false, currentTime: 0 }));
              return;
            }
            next(false);
          }}
          onBuffer={({ isBuffering }) => setState(prev => ({ ...prev, buffering: isBuffering }))}
          onError={e => {
            const msg = typeof e === 'string' ? e : JSON.stringify(e);
            setState(prev => ({ ...prev, paused: true, buffering: false, error: `播放失败：${msg}` }));
            pendingSeekRef.current = null;
          }}
          style={{ width: 0, height: 0, position: 'absolute' }}
        />
      ) : null}
    </PlayerContext.Provider>
  );
}

export { formatTime };
