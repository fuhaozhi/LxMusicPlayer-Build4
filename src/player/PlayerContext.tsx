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

  const persistPlay = (song: Song, currentTime: number) => {
    const last: LastPlay = { song, currentTime, ts: Date.now() };
    save(KEYS.lastPlay, last);
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
          setState(prev => ({ ...prev, url: res.url, paused: false, buffering: false, error: null }));
          library.bumpPlay(song);
          library.addRecent(song);
          persistPlay(song, 0);
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

  const next = () => {
    if (indexRef.current < queueRef.current.length - 1) {
      void playIndex(indexRef.current + 1, queueRef.current, apiRef.current);
    }
  };

  const prev = () => {
    if (indexRef.current > 0) {
      void playIndex(indexRef.current - 1, queueRef.current, apiRef.current);
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
            const list = queueRef.current;
            if (list.length > 0) {
              // 正常下一首；队列末尾则循环回第一首（避免播完卡住）
              if (indexRef.current < list.length - 1) {
                void playIndex(indexRef.current + 1, list, apiRef.current);
              } else {
                void playIndex(0, list, apiRef.current);
              }
            }
          }}
          onBuffer={({ isBuffering }) => setState(prev => ({ ...prev, buffering: isBuffering }))}
          onError={e => setState(prev => ({ ...prev, paused: true, buffering: false, error: `播放失败：${JSON.stringify(e)}` }))}
          style={{ width: 0, height: 0, position: 'absolute' }}
        />
      ) : null}
    </PlayerContext.Provider>
  );
}

export { formatTime };
