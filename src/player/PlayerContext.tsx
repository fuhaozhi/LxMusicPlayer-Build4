/**
 * 播放器上下文 —— react-native-video 播放 + 音源脚本取链（lx-ios-api）。
 * 取链策略：当前音源脚本支持该 source 时用脚本取 musicUrl（320k 失败降级 128k）；
 * 不支持时抛明确错误提示换音源。
 */
import React, { createContext, useContext, useRef, useState } from 'react';
import Video from 'react-native-video';
import type { LxMusicApi } from '../lx-api/index.js';
import type { PlayerState, Song } from '../types';
import { toMusicInfo } from '../sourceManager';
import { formatTime } from './lrc';

interface PlayerContextValue {
  state: PlayerState;
  queue: Song[];
  play: (song: Song, api: LxMusicApi | null, queue?: Song[]) => Promise<void>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setCurrentTime: (t: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

const QUALITY_FALLBACK = ['320k', '128k'] as const;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
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
      setState(prev => ({ ...prev, paused: true, buffering: false, error: '尚未加载音源脚本，请先到「音源」页加载' }));
      return;
    }
    const cap = api.getSource(song.source);
    if (!cap || !cap.actions.includes('musicUrl')) {
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

  return (
    <PlayerContext.Provider value={{ state, queue, play, toggle, next, prev, setCurrentTime: t => setState(prev => ({ ...prev, currentTime: t })) }}>
      {children}
      {state.url ? (
        <Video
          source={{ uri: state.url }}
          paused={state.paused}
          playInBackground
          playWhenInactive
          ignoreSilentSwitch="ignore"
          onLoad={({ duration }) => setState(prev => ({ ...prev, duration }))}
          onProgress={({ currentTime }) => setState(prev => ({ ...prev, currentTime }))}
          onEnd={() => next()}
          onBuffer={({ isBuffering }) => setState(prev => ({ ...prev, buffering: isBuffering }))}
          onError={e => setState(prev => ({ ...prev, paused: true, buffering: false, error: `播放失败：${JSON.stringify(e)}` }))}
          style={{ width: 0, height: 0, position: 'absolute' }}
        />
      ) : null}
    </PlayerContext.Provider>
  );
}

export { formatTime };
