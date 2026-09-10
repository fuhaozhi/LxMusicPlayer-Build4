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

export const KEYS = {
  recents: 'lx.recents',
  playlists: 'lx.playlists',
  favs: 'lx.favs',
  stats: 'lx.stats',
  sources: 'lx.sources',
} as const;
