/**
 * 封面兜底 —— 当歌曲缺少封面（pic 为空）或原图加载失败时，用腾讯音乐搜索接口按
 * 「歌名+歌手」补封面（albummid → y.gtimg.cn 图片直链，实测可用）。
 * 内存缓存避免重复请求；失败静默返回 null（不阻塞播放）。
 */
import type { Song } from './types';

const TIMEOUT_MS = 12_000;

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', Referer: 'https://y.qq.com/' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, string>();

/**
 * 获取歌曲封面：
 * - song.pic 存在且未强制忽略 → 直接返回
 * - 否则腾讯搜索第一首，用 albummid 拼图片直链（带缓存）
 */
export async function fetchCover(song: Song, opts?: { ignorePic?: boolean }): Promise<string | null> {
  if (song.pic && !opts?.ignorePic) return song.pic;
  const key = `${song.source}:${song.id}`;
  const hit = cache.get(key);
  if (hit) return hit || null;
  const query = encodeURIComponent(`${song.name} ${song.singer}`.trim());
  try {
    const data = await fetchJson(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${query}&format=json&p=1&n=1`);
    const albummid = data?.data?.song?.list?.[0]?.albummid;
    const pic = albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : null;
    cache.set(key, pic ?? '');
    return pic;
  } catch {
    cache.set(key, '');
    return null;
  }
}
