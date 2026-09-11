/**
 * 播放器上下文 —— react-native-video 播放 + 音源脚本取链（lx-ios-api）。
 * 取链策略：当前音源脚本支持该 source 时用脚本取 musicUrl（320k 失败降级 128k）；
 * 不支持时抛明确错误提示换音源。
 * 附加能力：进度 seek（拖动/锁屏）、锁屏「正在播放」卡片与远程控制（原生 LxNowPlaying）、
 * 上次播放缓存（自动续播）。
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, NativeModules } from 'react-native';
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

/** 上次播放的持久化结构 */
interface LastPlay {
  song: Song;
  currentTime: number;
  ts: number;
}

const NowPlayingNative = NativeModules?.LxNowPlaying as
  | { setNowPlaying?: (info: any) => void; clearNowPlaying?: () => void }
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
  /** 待 seek 的进度（续播用，onLoad 后执行） */
  const pendingSeekRef = useRef<number | null>(null);
  /** 上次 seek 时间戳（防抖：seek 后短暂忽略 onProgress 回跳） */
  const seekAtRef = useRef(0);
  /** 进度写盘节流 */
  const lastPersistRef = useRef(0);
  /** 锁屏信息更新节流 */
  const lastLockRef = useRef(0);
  /** 预取的下一首播放地址（熄屏/后台切歌用，避免后台现场网络取链被挂起） */
  const prefetchRef = useRef<{ songKey: string; url: string } | null>(null);
  const prefetchSeqRef = useRef(0);
  /** 播放失败已自动换源重试的歌曲（同一首只试一次，防死循环） */
  const fallbackTriedRef = useRef<Set<string>>(new Set());

  const songKeyOf = (s: Song) => `${s.source}:${s.id}`;

  const persistPlay = (song: Song, currentTime: number) => {
    const last: LastPlay = { song, currentTime, ts: Date.now() };
    save(KEYS.lastPlay, last);
  };

  /** 直接以已知 URL 播放并进入就绪态（前台取链成功 / 预取命中均走这里） */
  const applySong = (index: number, queueList: Song[], api: LxMusicApi | null, url: string) => {
    const song = queueList[index];
    if (!song) return;
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

  /** 恢复上次播放：有缓存且当前未在播放时，用当前音源重新取链并续播 */
  const restoreLast: PlayerContextValue['restoreLast'] = async api => {
    if (state.song) return; // 已有播放则不打扰
    const last = load<LastPlay | null>(KEYS.lastPlay, null);
    if (!last?.song) return;
    pendingSeekRef.current = Math.max(0, Number(last.currentTime) || 0);
    await play(last.song, api);
    if (pendingSeekRef.current === 0) pendingSeekRef.current = null;
  };

  // ---- 锁屏「正在播放」：状态变化时同步到原生（封面由原生下载，支持 data URI）----
  useEffect(() => {
    if (!NowPlayingNative?.setNowPlaying) return;
    if (!state.song || !state.url) {
      NowPlayingNative.clearNowPlaying?.();
      return;
    }
    const now = Date.now();
    // currentTime 节流 5s；暂停/切歌/加载完成立即更新
    if (now - lastLockRef.current < 5000 && state.currentTime > 0 && !state.paused) return;
    lastLockRef.current = now;
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
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('LxNowPlayingCommand', (e: any) => {
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
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      }}
    >
      {children}
      {state.url ? (
        <Video
          ref={videoRef}
          source={{ uri: state.url }}
          paused={state.paused}
          playInBackground
          playWhenInactive
          ignoreSilentSwitch="ignore"
          onLoad={({ duration }) => {
            setState(prev => ({ ...prev, duration }));
            // 续播：加载完成后 seek 到上次进度（接近结尾则从头播）
            const seekToTime = pendingSeekRef.current;
            if (seekToTime != null) {
              pendingSeekRef.current = null;
              const target = seekToTime > 0 && duration > 0 && seekToTime < duration - 5 ? seekToTime : 0;
              seekAtRef.current = Date.now();
              if (target > 0) {
                try {
                  videoRef.current?.seek(target);
                } catch { /* 忽略 */ }
              }
              setState(prev => ({ ...prev, currentTime: target }));
            }
          }}
          onProgress={({ currentTime }) => {
            // seek 后 1.5s 内忽略原生回跳，避免进度条乱跳
            if (Date.now() - seekAtRef.current < 1500) return;
            setState(prev => ({ ...prev, currentTime }));
            // 节流：每 10 秒把进度写入缓存（下次打开自动续播）
            const now = Date.now();
            if (state.song && now - lastPersistRef.current > 10_000) {
              lastPersistRef.current = now;
              persistPlay(state.song, currentTime);
            }
          }}
          onEnd={() => {
            library.bumpSeconds(state.duration);
            // 走统一 next()：优先预取 URL，后台/熄屏也能自动切下一首；末尾循环
            next();
          }}
          onBuffer={({ isBuffering }) => setState(prev => ({ ...prev, buffering: isBuffering }))}
          onError={e => {
            const msg = typeof e === 'string' ? e : JSON.stringify(e);
            setState(prev => ({ ...prev, paused: true, buffering: false, error: `播放失败：${msg}` }));
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
