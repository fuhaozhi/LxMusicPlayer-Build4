/**
 * 本地持久化 —— 使用 RN 自带 Settings（iOS 轻量键值存储），零原生依赖。
 * 不支持时（如 Android/异常）自动降级为内存存储。
 */
import { Settings } from 'react-native';

const store: any = typeof Settings !== 'undefined' && Settings ? Settings : null;
const mem = new Map<string, string>();

export function load<T>(key: string, fallback: T): T {
  try {
    let raw: string | null | undefined = null;
    if (store) raw = store.get(key);
    if (raw == null) raw = mem.get(key) ?? null;
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value);
    mem.set(key, raw);
    if (store) store.set({ [key]: raw });
  } catch {
    /* 存储失败不阻塞功能 */
  }
}

/** 删除某个 key（用于清理缓存） */
export function remove(key: string): void {
  try {
    mem.delete(key);
    if (store) store.set({ [key]: '' });
  } catch {
    /* 删除失败不阻塞功能 */
  }
}

export const KEYS = {
  recents: 'lx.recents',
  playlists: 'lx.playlists',
  favs: 'lx.favs',
  stats: 'lx.stats',
  sources: 'lx.sources',
  /** 上次使用的音源 id（启动自动加载） */
  lastSource: 'lx.lastSource',
  /** 上次播放的歌曲 + 进度（启动自动续播） */
  lastPlay: 'lx.lastPlay',
  /** 搜索历史（最多 10 条，点击可重搜） */
  searchHistory: 'lx.searchHistory',
  /** 播放模式：order/single/random */
  playMode: 'lx.playMode',
  /** 歌单 / 榜单数据缓存（离线可看列表 + 秒开） */
  collectionCache: 'lx.cache.collections',
  /** 音乐馆卡片封面缓存（打开秒显，后台刷新） */
  coversCache: 'lx.cache.covers',
} as const;
