/**
 * 歌词兜底 —— 当前可用音源脚本（huibq/qdy/ikun）只提供 musicUrl 能力、不提供 lyric，
 * 播放页在音源脚本无歌词能力（或拉取失败）时，用网易云公开接口按「歌名+歌手」补歌词。
 * 失败静默返回 null，不阻塞播放。
 */
import type { Song } from './types';
import type { LyricInfo } from './lx-api/types.js';

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

const cache = new Map<string, LyricInfo | null>();

/** 网易云搜第一首并拉取 LRC 歌词，返回与音源脚本一致的结构 */
export async function fetchLyricByName(song: Song): Promise<LyricInfo | null> {
  const key = `${song.source}:${song.id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const query = encodeURIComponent(`${song.name} ${song.singer}`.trim());
    const search = await fetchJson(`https://music.163.com/api/search/get?s=${query}&type=1&limit=1`);
    const first = search?.result?.songs?.[0];
    if (!first?.id) {
      cache.set(key, null);
      return null;
    }
    const lyricData = await fetchJson(
      `https://music.163.com/api/song/lyric?id=${first.id}&lv=1&kv=1&tv=-1`,
    );
    const lyric = lyricData?.lrc?.lyric ? String(lyricData.lrc.lyric) : '';
    if (!lyric) {
      cache.set(key, null);
      return null;
    }
    const tlyric = lyricData?.tlyric?.lyric ? String(lyricData.tlyric.lyric) : null;
    const info: LyricInfo = { lyric, tlyric, rlyric: null, lxlyric: null };
    cache.set(key, info);
    return info;
  } catch {
    cache.set(key, null);
    return null;
  }
}
