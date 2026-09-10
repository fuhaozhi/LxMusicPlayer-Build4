/**
 * 音源脚本管理器 —— 加载自定义音源脚本（lx-ios-api 运行时）。
 * 音源由用户在「设置」中自行添加（可从内置推荐列表选择，或输入脚本 URL），
 * 当前选中的音源脚本提供 musicUrl/lyric/pic 能力。
 */
import { useState } from 'react';
import {
  LxMusicApi,
  LX_MUSIC_SOURCES,
  toAcceleratedUrl,
} from './lx-api/index.js';
import type { Song, SourceState } from './types';
import { KEYS, load, save } from './storage';

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
  /** 添加自定义音源（校验 URL、去重） */
  addSource: (url: string, name?: string) => { ok: boolean; error?: string };
  /** 删除音源（若为当前音源则清空） */
  removeSource: (id: string) => void;
}

let cachedApi: LxMusicApi | null = null;

/** 内置推荐音源脚本（设置页供选择添加） */
export const AVAILABLE_SOURCES = LX_MUSIC_SOURCES;

/** URL 校验：必须是 http(s) 的 .js 脚本 */
export function isValidSourceUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+\.js(\?.*)?$/i.test(url.trim());
}

interface PersistedSource {
  id: string;
  name: string;
  url: string;
}

function readPersisted(): PersistedSource[] {
  return load<PersistedSource[]>(KEYS.sources, []);
}

export function useSourceManager(): SourceManager {
  const [sources, setSources] = useState<SourceState[]>(() =>
    readPersisted().map(s => ({ id: s.id, name: s.name, url: s.url, state: 'idle' })),
  );
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const persist = (list: SourceState[]) => {
    save(
      KEYS.sources,
      list.map(s => ({ id: s.id, name: s.name, url: s.url })),
    );
  };

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
      const item = sources.find(s => s.id === id);
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
      setMessage(`音源加载失败：${e?.message ?? e}（外部服务可能失效，可换音源重试）`);
    } finally {
      setLoading(false);
    }
  };

  const addSource = (url: string, name?: string): { ok: boolean; error?: string } => {
    const trimmed = url.trim();
    if (!isValidSourceUrl(trimmed)) {
      return { ok: false, error: '请输入有效的脚本地址（http/https 且以 .js 结尾）' };
    }
    const exists = sources.some(s => s.url === trimmed);
    if (exists) return { ok: false, error: '该音源已添加' };
    const fallbackName = trimmed.replace(/^https?:\/\//, '').split('/')[0] || '自定义音源';
    const id = `src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next = [...sources, { id, name: name?.trim() || fallbackName, url: trimmed, state: 'idle' as const }];
    setSources(next);
    persist(next);
    return { ok: true };
  };

  const removeSource = (id: string) => {
    if (cachedApi && id === currentId) {
      try {
        cachedApi.destroy();
      } catch { /* ignore */ }
      cachedApi = null;
    }
    const next = sources.filter(s => s.id !== id);
    setSources(next);
    persist(next);
    if (currentId === id) setCurrentId(null);
  };

  return { sources, currentId, loading, message, loadSource, getApi: () => cachedApi, addSource, removeSource };
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
