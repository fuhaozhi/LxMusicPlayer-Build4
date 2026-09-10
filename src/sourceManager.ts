/**
 * 音源脚本管理器 —— 加载 awaw.cc 页面的 8 个自定义音源脚本（lx-ios-api 运行时）。
 * 当前选中的音源脚本提供 musicUrl/lyric/pic 能力。
 */
import { useState } from 'react';
import {
  LxMusicApi,
  LX_MUSIC_SOURCES,
  getSourceById,
  toAcceleratedUrl,
} from './lx-api/index.js';
import type { Song, SourceState } from './types';

const API_OPTIONS = {
  initTimeout: 15_000,
  requestTimeout: 20_000,
  logger: (level: string, message: string) => console.log(`[user-api] ${message}`),
};

export interface SourceManager {
  sources: SourceState[];
  currentId: string | null;
  loading: boolean;
  message: string | null;
  /** 加载并切换音源脚本 */
  loadSource: (id: string) => Promise<void>;
  /** 当前音源脚本的 API 实例（未加载时返回 null） */
  getApi: () => LxMusicApi | null;
}

let cachedApi: LxMusicApi | null = null;

export function useSourceManager(): SourceManager {
  const [sources, setSources] = useState<SourceState[]>(() =>
    LX_MUSIC_SOURCES.map(item => ({ id: item.id, name: item.name, url: item.url, state: 'idle' })),
  );
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const patch = (id: string, p: Partial<SourceState>) =>
    setSources(prev => prev.map(s => (s.id === id ? { ...s, ...p } : s)));

  const loadSource = async (id: string) => {
    setLoading(true);
    setMessage(null);
    patch(id, { state: 'loading', message: undefined });
    // 释放上一个实例
    if (cachedApi) {
      try {
        cachedApi.destroy();
      } catch { /* ignore */ }
      cachedApi = null;
    }
    try {
      const item = getSourceById(id);
      if (!item) throw new Error(`未知音源 ${id}`);
      // 优先原始链接，失败时自动换加速前缀
      const urls = [item.url, toAcceleratedUrl(item.url)];
      let api: LxMusicApi | null = null;
      let lastError: any = null;
      for (const url of urls) {
        try {
          api = await LxMusicApi.fromUrl(url, API_OPTIONS);
          break;
        } catch (e) {
          lastError = e;
        }
      }
      if (!api) throw lastError ?? new Error('加载失败');
      cachedApi = api;
      const caps = api.getInitResult().sources;
      patch(id, {
        state: 'ready',
        message: `已加载 ${caps.length} 个音源`,
        capabilities: caps.map(c => ({ source: c.source, actions: c.actions, qualitys: c.qualitys })),
      });
      setCurrentId(id);
    } catch (e: any) {
      patch(id, { state: 'error', message: String(e?.message ?? e) });
      setMessage(`音源 ${id} 加载失败：${e?.message ?? e}（外部服务可能失效，可换音源重试）`);
    } finally {
      setLoading(false);
    }
  };

  return { sources, currentId, loading, message, loadSource, getApi: () => cachedApi };
}

/** 从歌词对象中取文本字段（兼容脚本返回 null 的情况） */
export function lyricText(lyric: { lyric?: string | null; tlyric?: string | null } | null): string {
  if (!lyric) return '';
  return lyric.lyric ?? '';
}

/** 为播放准备 musicInfo（按音源脚本取链所需字段映射） */
export function toMusicInfo(song: Song): import('./lx-api/types.js').MusicInfo {
  return {
    id: song.id,
    name: song.name,
    singer: song.singer,
    source: song.source,
    interval: song.interval,
    albumName: song.album,
    albumArt: song.pic,
    hash: song.hash,
    songmid: song.songmid,
    copyrightId: song.copyrightId,
  } as import('./lx-api/types.js').MusicInfo;
}
