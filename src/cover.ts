/**
 * 封面兜底 —— 当歌曲缺少封面（pic 为空）时，用网易云搜索接口按「歌名+歌手」补封面。
 * 内存缓存避免重复请求；失败静默返回 null（不阻塞播放）。
 */
import type { Song } from './types';

const TIMEOUT_MS = 12_000;

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, string>();

/** 网易云按歌名+歌手搜第一首，取封面 URL */
export async function fetchCover(song: Song): Promise<string | null> {
  if (song.pic) return song.pic;
  const key = `${song.source}:${song.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const query = encodeURIComponent(`${song.name} ${song.singer}`.trim());
  try {
    const data = await fetchJson(`https://music.163.com/api/search/get?s=${query}&type=1&limit=1`);
    const first = data?.result?.songs?.[0];
    const pic = first?.al?.picUrl ? String(first.al.picUrl) : null;
    cache.set(key, pic ?? '');
    return pic;
  } catch {
    cache.set(key, '');
    return null;
  }
}
