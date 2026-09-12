/**
 * 播放器上下文 —— react-native-video 播放 + 音源脚本取链（lx-ios-api）。
 * 取链策略：当前音源脚本支持该 source 时用脚本取 musicUrl（320k 失败降级 128k）；
 * 不支持时抛明确错误提示换音源。
 * 附加能力：进度 seek（拖动/锁屏）、锁屏「正在播放」卡片与远程控制（原生 LxNowPlaying）、
 * 上次播放缓存（自动续播）。
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules } from 'react-native';
import Video from 'react-native-video';
import type { LxMusicApi } from '../lx-api/index.js';
import type { PlayerState, Song } from '../types';
import { toMusicInfo } from '../sourceManager';
import { useLibrary } from '../library';
import { resolveCover } from '../cover';
import { searchNetease } from '../searchSources';
import { KEYS, load, save } from '../storage';
import { formatTime } from './lrc';

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
    }
  | undefined;

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
}

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
  /** 锁屏信息更新节流（仅进度变化时节流；歌曲/时长/暂停态变化立即推送） */
  const lastLockRef = useRef(0);
  const lastLockKeyRef = useRef('');
  /** 预取的下一首播放地址（熄屏/后台切歌用，避免后台现场网络取链被挂起） */
  const prefetchRef = useRef<{ songKey: string; url: string } | null>(null);
  const prefetchSeqRef = useRef(0);
  /** 播放失败已自动换源重试的歌曲（同一首只试一次，防死循环） */
  const fallbackTriedRef = useRef<Set<string>>(new Set());
  /** 当前歌曲是否已触发后台保活（每首歌只触发一次） */
  const bgKeepRef = useRef(false);

  const songKeyOf = (s: Song) => `${s.source}:${s.id}`;

  /** 定时关闭状态（endsAt 毫秒时间戳）与剩余秒数 */
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

  /** 直接以已知 URL 播放并进入就绪态（前台取链成功 / 预取命中均走这里） */
  const applySong = (index: number, queueList: Song[], api: LxMusicApi | null, url: string) => {
    const song = queueList[index];
    if (!song) return;
    // 若待续播目标是别的歌（切歌/换源重试），作废旧位置，避免错位 seek 导致乱跳
    const p = pendingSeekRef.current;
    if (p && p.songKey !== songKeyOf(song)) pendingSeekRef.current = null;
    // 新歌进度立即生效：清掉上一首的 seek 防抖窗口（否则前 3 秒 onProgress 被忽略，进度条像卡住）
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
    // 切歌后重置保活标记，下一首临近结束时重新触发
    bgKeepRef.current = false;
    // 顺带预取下一首，熄屏/后台切歌直接走缓存
    void prefetchNext(index, queueList, api);
  };

  /** 预取下一首播放地址（静默失败；队列末尾循环回第一首） */
  const prefetchNext = async (index: number, queueList: Song[], api: LxMusicApi | null) => {
    const seq = ++prefetchSeqRef.current;
    try {
      if (!api || queueList.length === 0) return;
      const ni = index < queueList.length - 1 ? index + 1 : 0;
      const target = queueList[ni];
      if (!target) return;
      const cap = api.getSource(target.source);
      if (!cap || !cap.actions.includes('musicUrl')) return;
      let url: string | null = null;
      for (const quality of QUALITY_FALLBACK) {
        try {
          const res = await api.getMusicUrl(target.source, toMusicInfo(target), quality);
          if (res?.url) {
            url = res.url;
            break;
          }
        } catch {
          /* 尝试下一档音质 */
        }
      }
      if (seq !== prefetchSeqRef.current) return; // 期间已切歌，丢弃过期结果
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

    const info = toMusicInfo(song);
    if (!api) {
      pendingSeekRef.current = null;
      setState(prev => ({ ...prev, paused: true, buffering: false, error: '尚未加载音源脚本，请先到「音源」页加载' }));
      return;
    }
    const cap = api.getSource(song.source);
    if (!cap || !cap.actions.includes('musicUrl')) {
      pendingSeekRef.current = null;
      setState(prev => ({
        ...prev,
        paused: true,
        buffering: false,
        error: `当前音源脚本不支持 ${song.source} 源，请换音源脚本或换搜索源`,
      }));
      return;
    }
    let lastError: any = null;
    for (const quality of QUALITY_FALLBACK) {
      try {
        const res = await api.getMusicUrl(song.source, info, quality);
        if (res?.url) {
          applySong(index, queueList, api, res.url);
          return;
        }
      } catch (e) {
        lastError = e;
      }
    }
    setState(prev => ({
      ...prev,
      paused: true,
      buffering: false,
      error: `取播放地址失败：${lastError?.message ?? lastError}（外部服务可能失效）`,
    }));
    pendingSeekRef.current = null;
  };

  const play: PlayerContextValue['play'] = async (song, api, queueList = [song]) => {
    const idx = queueList.findIndex(s => s === song || (s.source === song.source && s.id === song.id));
    await playIndex(idx >= 0 ? idx : 0, queueList, api);
  };

  const toggle = () => setState(prev => ({ ...prev, paused: !prev.paused }));

  /** 下一首：优先用预取 URL（熄屏/后台零网络依赖），队列末尾循环回第一首 */
  const next = () => {
    const list = queueRef.current;
    if (list.length === 0) return;
    const ni = indexRef.current < list.length - 1 ? indexRef.current + 1 : 0;
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

  /**
   * 播放失败自动换源：当前源（腾讯/酷我等）取到的地址失效（403/-1102 权限类错误）时，
   * 自动用网易云搜索同名歌曲并用当前音源播放（网易取链实测稳定）。
   * 同一首歌只尝试一次，避免反复失败。
   */
  const autoFallbackToNetease = async (song: Song): Promise<boolean> => {
    const key = songKeyOf(song);
    if (fallbackTriedRef.current.has(key)) return false;
    fallbackTriedRef.current.add(key);
    if (song.source === 'wy') return false;
    try {
      const kw = `${song.name} ${song.singer}`.trim();
      const results = await searchNetease(kw);
      const target = results[0];
      if (!target) return false;
      await play(target, apiRef.current, [target]);
      return true;
    } catch {
      return false;
    }
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
  };

  /** 恢复上次播放：恢复完整队列与当前歌曲，用当前音源重新取链并续播 */
  const restoreLast: PlayerContextValue['restoreLast'] = async api => {
    if (state.song) return; // 已有播放则不打扰
    const last = load<LastPlay | null>(KEYS.lastPlay, null);
    if (!last?.song) return;
    const q = Array.isArray(last.queue) && last.queue.length > 0 ? last.queue : [last.song];
    let idx =
      Number.isInteger(last.index) && last.index >= 0 && last.index < q.length ? last.index : 0;
    // 当前歌曲不在队列（数据异常）时按歌曲定位
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

  // ---- 锁屏「正在播放」：状态变化时同步到原生（封面由原生下载，支持 data URI）----
  useEffect(() => {
    if (!NowPlayingNative?.setNowPlaying) return;
    if (!state.song || !state.url) {
      NowPlayingNative.clearNowPlaying?.();
      return;
    }
    const now = Date.now();
    // 关键信息（歌曲/时长/播放暂停态）变化 → 立即推送；
    // 仅进度（currentTime）变化 → 5s 节流，避免高频刷原生
    const key = `${songKeyOf(state.song)}|${state.duration}|${state.paused}`;
    if (key !== lastLockKeyRef.current) {
      lastLockKeyRef.current = key;
      lastLockRef.current = now;
    } else if (now - lastLockRef.current < 5000 && state.currentTime > 0 && !state.paused) {
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
      // 无自带封面：用统一兜底拿 dataURI（避免锁屏卡片无图）
      resolveCover(state.song).then(dataUri => {
        NowPlayingNative?.setNowPlaying?.({ ...info, artworkUrl: dataUri ?? '' });
      });
    }
  }, [state.song, state.url, state.paused, state.duration, state.currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 锁屏远程控制（播放/暂停/下一首/上一首/拖动进度）----
  // 用原生回调注册（新架构下 RCTEventEmitter 事件不可靠），命令到达即回调
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
          next();
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

  // 当前播放地址（引用稳定，避免每次渲染触发底层重新加载）
  const videoSource = useMemo(
    () => (state.url ? { uri: state.url } : null),
    [state.url],
  );

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
            // 续播：仅当待 seek 位置属于当前这首歌时才消费，避免错位 seek
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
            // seek 后 3s 内忽略原生回跳（跳转需要时间，窗口太短会让旧进度漏进来）
            if (Date.now() - seekAtRef.current < 3000) return;
            const t = Number(currentTime) || 0;
            // 非 seek 期间出现明显回退（>1.5s）→ 原生异常回退值，忽略
            if (t < lastProgressRef.current - 1.5) return;
            lastProgressRef.current = t;
            setState(prev => ({ ...prev, currentTime: t }));
            // 临近结尾（剩余 <6s）触发后台保活：保持音频会话 + 后台任务额度，
            // 防止切歌空窗期（新歌网络加载中无声音输出）被系统挂起，导致后台不自动切下一首
            if (!bgKeepRef.current && state.song && state.duration > 10 && t > state.duration - 6) {
              bgKeepRef.current = true;
              NowPlayingNative?.keepSessionActive?.();
            }
            // 节流：每 10 秒把进度写入缓存（下次打开自动续播）
            const now = Date.now();
            if (state.song && now - lastPersistRef.current > 10_000) {
              lastPersistRef.current = now;
              persistPlay(state.song, t);
            }
          }}
          onEnd={() => {
            library.bumpSeconds(state.duration);
            // 播完瞬间再保活一次（万一临近结尾那 6 秒的进度事件被系统吃掉）
            if (!bgKeepRef.current) {
              bgKeepRef.current = true;
              NowPlayingNative?.keepSessionActive?.();
            }
            // 走统一 next()：优先预取 URL，后台/熄屏也能自动切下一首；末尾循环
            next();
          }}
          onBuffer={({ isBuffering }) => setState(prev => ({ ...prev, buffering: isBuffering }))}
          onError={e => {
            const msg = typeof e === 'string' ? e : JSON.stringify(e);
            setState(prev => ({ ...prev, paused: true, buffering: false, error: `播放失败：${msg}` }));
            // 这首歌没播起来，作废待续播位置（防换源重试时错位 seek）
            pendingSeekRef.current = null;
            const song = state.song;
            // 权限类错误（-1102 / 403 等）＝该源取到的地址已失效 → 自动换网易同名歌曲重试
            if (song && song.source !== 'wy' && /-1102|permission|403|not allowed/i.test(msg)) {
              void autoFallbackToNetease(song);
            }
          }}
          style={{ width: 0, height: 0, position: 'absolute' }}
        />
      ) : null}
    </PlayerContext.Provider>
  );
}

export { formatTime };
