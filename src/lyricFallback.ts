/**
 * 歌词兜底 —— 当前可用音源脚本（huibq/qdy/ikun）只提供 musicUrl 能力、不提供 lyric，
 * 播放页在音源脚本无歌词能力（或拉取失败）时自动补歌词：
 * 1) 优先网易云：搜索多首，依次取第一首有歌词的（接口不依赖 Referer，iOS 可用）
 * 2) 失败则用腾讯音乐（歌词接口需要 Referer，iOS 原生层会忽略自定义头，仅作后备）
 * 失败静默返回 null，不阻塞播放。
 */
import type { Song } from './types';
import type { LyricInfo } from './lx-api/types.js';

const TIMEOUT_MS = 12_000;

async function fetchText(url: string, referer: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', Referer: referer, 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(text: string): Promise<any> {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('非 JSON 响应');
  }
}

const cache = new Map<string, LyricInfo | null>();

/** 腾讯：搜索拿 songmid → 歌词接口（nobase64=1 直接返回明文 LRC） */
async function tryTencent(song: Song): Promise<LyricInfo | null> {
  const query = encodeURIComponent(`${song.name} ${song.singer}`.trim());
  const search = await parseJson(
    await fetchText(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${query}&format=json&p=1&n=3`, 'https://y.qq.com/'),
  );
  const list: any[] = search?.data?.song?.list ?? [];
  for (const item of list) {
    if (!item?.songmid) continue;
    try {
      const data = await parseJson(
        await fetchText(
          `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${item.songmid}&format=json&nobase64=1`,
          'https://y.qq.com/',
        ),
      );
      const lyric = data?.lyric ? String(data.lyric).trim() : '';
      if (lyric) return { lyric, tlyric: null, rlyric: null, lxlyric: null };
    } catch {
      /* 试下一首 */
    }
  }
  return null;
}

/** 网易：搜索多首，依次取第一首有歌词的 */
async function tryNetease(song: Song): Promise<LyricInfo | null> {
  const query = encodeURIComponent(`${song.name} ${song.singer}`.trim());
  const search = await parseJson(
    await fetchText(`https://music.163.com/api/search/get?s=${query}&type=1&limit=5`, 'https://music.163.com/'),
  );
  const list: any[] = search?.result?.songs ?? [];
  for (const item of list) {
    if (!item?.id) continue;
    try {
      const data = await parseJson(
        await fetchText(`https://music.163.com/api/song/lyric?id=${item.id}&lv=1&kv=1&tv=-1`, 'https://music.163.com/'),
      );
      const lyric = data?.lrc?.lyric ? String(data.lrc.lyric).trim() : '';
      if (lyric) {
        const tlyric = data?.tlyric?.lyric ? String(data.tlyric.lyric) : null;
        return { lyric, tlyric, rlyric: null, lxlyric: null };
      }
    } catch {
      /* 试下一首 */
    }
  }
  return null;
}

/** 按「歌名+歌手」补歌词，返回与音源脚本一致的结构 */
export async function fetchLyricByName(song: Song): Promise<LyricInfo | null> {
  const key = `${song.source}:${song.id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let info: LyricInfo | null = null;
  try {
    info = await tryNetease(song);
  } catch {
    info = null;
  }
  if (!info) {
    try {
      info = await tryTencent(song);
    } catch {
      info = null;
    }
  }
  cache.set(key, info);
  return info;
}
