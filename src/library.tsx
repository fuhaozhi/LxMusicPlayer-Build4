/**
 * 音乐库 Context —— 最近播放、自建歌单、收藏合集、听歌统计。
 * 基于 storage 本地持久化（iOS Settings），零原生依赖。
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Collection, FavCollection, ListenStats, LocalPlaylist, Song } from './types';
import { KEYS, load, save } from './storage';

interface LibraryContextValue {
  recents: Song[];
  playlists: LocalPlaylist[];
  favs: FavCollection[];
  stats: ListenStats;
  /** 记录一次播放（切歌计数） */
  bumpPlay: (song: Song) => void;
  /** 累计播放时长（秒） */
  bumpSeconds: (seconds: number) => void;
  /** 加入最近播放（去重置顶，上限 50） */
  addRecent: (song: Song) => void;
  /** 新建歌单，返回创建的歌单 */
  createPlaylist: (name: string) => LocalPlaylist | null;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songKey: string) => void;
  toggleFav: (c: Collection) => void;
  isFav: (id: string) => boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}

const songKey = (s: Song) => `${s.source}:${s.id}`;

const DEFAULT_STATS: ListenStats = { totalPlays: 0, totalSeconds: 0, songs: [] };

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [recents, setRecents] = useState<Song[]>(() => load(KEYS.recents, [] as Song[]));
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>(() => load(KEYS.playlists, [] as LocalPlaylist[]));
  const [favs, setFavs] = useState<FavCollection[]>(() => load(KEYS.favs, [] as FavCollection[]));
  const [stats, setStats] = useState<ListenStats>(() => load(KEYS.stats, DEFAULT_STATS));

  const value = useMemo<LibraryContextValue>(() => {
    const bumpPlay = (song: Song) => {
      setStats(prev => {
        const key = songKey(song);
        const exists = prev.songs.find(s => s.key === key);
        const next: ListenStats = {
          ...prev,
          totalPlays: prev.totalPlays + 1,
          songs: exists
            ? prev.songs.map(s => (s.key === key ? { ...s, count: s.count + 1 } : s))
            : [...prev.songs, { key, name: song.name, singer: song.singer, count: 1 }],
        };
        save(KEYS.stats, next);
        return next;
      });
    };

    const bumpSeconds = (seconds: number) => {
      if (!seconds || seconds <= 0) return;
      setStats(prev => {
        const next: ListenStats = { ...prev, totalSeconds: prev.totalSeconds + seconds };
        save(KEYS.stats, next);
        return next;
      });
    };

    const addRecent = (song: Song) => {
      setRecents(prev => {
        const rest = prev.filter(s => songKey(s) !== songKey(song));
        const next = [song, ...rest].slice(0, 50);
        save(KEYS.recents, next);
        return next;
      });
    };

    const createPlaylist = (name: string): LocalPlaylist | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const pl: LocalPlaylist = { id: `pl-${Date.now()}`, name: trimmed.slice(0, 20), createdAt: Date.now(), songs: [] };
      setPlaylists(prev => {
        const next = [pl, ...prev];
        save(KEYS.playlists, next);
        return next;
      });
      return pl;
    };

    const deletePlaylist = (id: string) => {
      setPlaylists(prev => {
        const next = prev.filter(p => p.id !== id);
        save(KEYS.playlists, next);
        return next;
      });
    };

    const addSongToPlaylist = (playlistId: string, song: Song) => {
      setPlaylists(prev =>
        prev.map(p => {
          if (p.id !== playlistId) return p;
          if (p.songs.some(s => songKey(s) === songKey(song))) return p;
          const next = { ...p, songs: [...p.songs, song] };
          save(KEYS.playlists, prev.map(q => (q.id === p.id ? next : q)));
          return next;
        }),
      );
    };

    const removeSongFromPlaylist = (playlistId: string, key: string) => {
      setPlaylists(prev =>
        prev.map(p => {
          if (p.id !== playlistId) return p;
          const next = { ...p, songs: p.songs.filter(s => songKey(s) !== key) };
          save(KEYS.playlists, prev.map(q => (q.id === p.id ? next : q)));
          return next;
        }),
      );
    };

    const toggleFav = (c: Collection) => {
      setFavs(prev => {
        const exists = prev.some(f => f.id === c.id);
        const next = exists
          ? prev.filter(f => f.id !== c.id)
          : [{ id: c.id, name: c.name, desc: c.desc, source: c.source, apiId: c.apiId, hue: c.hue }, ...prev];
        save(KEYS.favs, next);
        return next;
      });
    };

    const isFav = (id: string) => favs.some(f => f.id === id);

    return {
      recents,
      playlists,
      favs,
      stats,
      bumpPlay,
      bumpSeconds,
      addRecent,
      createPlaylist,
      deletePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      toggleFav,
      isFav,
    };
  }, [recents, playlists, favs, stats]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
