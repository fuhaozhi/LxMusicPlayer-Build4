/**
 * 发现数据层 —— 主页「每日推荐」与音乐馆「热门合集」的歌曲来源。
 * 全部使用实测可用的公开接口（网易云 / QQ 音乐官方榜单接口），
 * 每个合集多候选接口快速失败：单个接口失效自动跳到下一个，全部失败快速返回空。
 */
import type { Collection, Song } from './types';
import { KEYS, load, save } from './storage';

const TIMEOUT_MS = 20_000;
/** 最多缓存多少个歌单（防止本地存储无限膨胀；无时间限制，手动清理） */
const MAX_CACHED = 20;

interface CollectionCacheEntry {
  songs: Song[];
  ts: number;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', ...headers },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
      throw new Error('非 JSON 响应');
    }
  } finally {
    clearTimeout(timer);
  }
}

/** 网易云榜单 / 歌单（多候选接口，实测 api/v3 与 api/playlist 均可用） */
async function fetchWyPlaylist(id: string): Promise<Song[]> {
  const urls = [
    `https://music.163.com/api/v3/playlist/detail?id=${id}&n=1000`,
    `https://music.163.com/api/v6/playlist/detail?id=${id}&n=1000`,
    `https://music.163.com/api/playlist/detail?id=${id}`,
  ];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const data = await fetchJson(url, { Referer: 'https://music.163.com/' });
      const tracks: any[] = data?.playlist?.tracks ?? data?.result?.tracks ?? [];
      if (tracks.length) {
        return tracks
          .filter((it: any) => it?.id)
          .map((it: any) => ({
            source: 'wy' as const,
            id: String(it.id),
            name: String(it.name ?? ''),
            singer: (it.ar ?? []).map((a: any) => a?.name ?? '').join(' / '),
            album: it.al?.name ? String(it.al.name) : undefined,
            interval: Math.floor(Number(it.dt ?? 0) / 1000) || undefined,
            pic: it.al?.picUrl ? String(it.al.picUrl).replace(/^http:/, 'https:') : undefined,
          }));
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('网易云接口无返回');
}

/** 腾讯音乐排行榜（实测 v8 toplist 可用；响应歌曲信息在 songlist[].data 嵌套字段） */
async function fetchTxTop(topId: string): Promise<Song[]> {
  const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?page=detail&topid=${topId}&type=top&song_begin=0&song_num=50&format=json`;
  const data = await fetchJson(url, { Referer: 'https://y.qq.com/' });
  const list: any[] = data?.songlist ?? [];
  return list
    .filter((it: any) => it?.data?.songmid)
    .map((it: any) => {
      const d = it.data;
      return {
        source: 'tx' as const,
        id: String(d.songmid),
        songmid: String(d.songmid),
        name: String(d.songname ?? ''),
        singer: (d.singer ?? []).map((s: any) => s?.name ?? '').join(' / '),
        album: d.albumname ? String(d.albumname) : undefined,
        interval: Number(d.interval ?? 0) || undefined,
        pic: d.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${d.albummid}.jpg` : undefined,
      };
    });
}

/** 主页「每日推荐」合集（全部为实测可用接口） */
export const HOME_COLLECTIONS: Collection[] = [
  { id: 'wy-up', name: '每日推荐·飙升榜', desc: '网易云音乐 · 24 小时热度上升最快', source: 'wy', apiId: '19723756', hue: 152 },
  { id: 'wy-hot', name: '每日推荐·热歌榜', desc: '网易云音乐 · 大家都在听', source: 'wy', apiId: '3778678', hue: 198 },
  { id: 'wy-new', name: '每日推荐·新歌榜', desc: '网易云音乐 · 最新发布抢先听', source: 'wy', apiId: '3779629', hue: 268 },
  { id: 'tx-top', name: '每日推荐·腾讯巅峰', desc: 'QQ 音乐 · 巅峰流行榜', source: 'tx', apiId: '26', hue: 330 },
];

/** 音乐馆「热门音乐合集」 */
export const EXPLORE_COLLECTIONS: Collection[] = [
  { id: 'wy-hot', name: '热歌榜', desc: '网易云音乐 · 大家都在听', source: 'wy', apiId: '3778678', hue: 22 },
  { id: 'wy-up', name: '飙升榜', desc: '网易云音乐 · 热度上升最快', source: 'wy', apiId: '19723756', hue: 198 },
  { id: 'wy-new', name: '新歌榜', desc: '网易云音乐 · 最新发布', source: 'wy', apiId: '3779629', hue: 268 },
  { id: 'wy-original', name: '原创音乐榜', desc: '网易云音乐 · 独立原创新声', source: 'wy', apiId: '2884035', hue: 152 },
  { id: 'tx-top', name: '腾讯巅峰榜', desc: 'QQ 音乐 · 巅峰流行榜', source: 'tx', apiId: '26', hue: 330 },
  { id: 'tx-new', name: '腾讯新歌榜', desc: 'QQ 音乐 · 最新歌曲', source: 'tx', apiId: '27', hue: 268 },
  { id: 'tx-inland', name: 'QQ内地榜', desc: 'QQ 音乐 · 内地热歌', source: 'tx', apiId: '62', hue: 130 },
  { id: 'tx-ht', name: 'QQ港台榜', desc: 'QQ 音乐 · 港台热歌', source: 'tx', apiId: '63', hue: 300 },
  { id: 'tx-douyin', name: 'QQ抖音榜', desc: 'QQ 音乐 · 抖音爆款', source: 'tx', apiId: '59', hue: 200 },
  { id: 'tx-eu', name: 'QQ欧美榜', desc: 'QQ 音乐 · 欧美热歌', source: 'tx', apiId: '3', hue: 40 },
  { id: 'tx-rap', name: 'QQ说唱榜', desc: 'QQ 音乐 · 说唱新势力', source: 'tx', apiId: '52', hue: 170 },
  { id: 'tx-edm', name: 'QQ电音榜', desc: 'QQ 音乐 · 电子舞曲', source: 'tx', apiId: '36', hue: 260 },
];

/** 根据合集拉取歌曲列表（本地缓存：无时间限制，秒开 + 断网可看；设置里可手动清理） */
export async function fetchCollectionSongs(c: Collection): Promise<Song[]> {
  const cache = load<Record<string, CollectionCacheEntry>>(KEYS.collectionCache, {});
  const hit = cache[c.id];
  if (hit && hit.songs.length > 0) {
    return hit.songs;
  }

  let songs: Song[];
  switch (c.source) {
    case 'wy':
      songs = await fetchWyPlaylist(c.apiId);
      break;
    case 'tx':
      songs = await fetchTxTop(c.apiId);
      break;
    default:
      throw new Error('未知合集来源');
  }

  if (songs.length > 0) {
    const next: Record<string, CollectionCacheEntry> = { ...cache, [c.id]: { songs, ts: Date.now() } };
    const ids = Object.keys(next);
    while (ids.length > MAX_CACHED) {
      const oldest = ids.reduce((a, b) => (next[a].ts < next[b].ts ? a : b));
      delete next[oldest];
      ids.splice(ids.indexOf(oldest), 1);
    }
    try {
      save(KEYS.collectionCache, next);
    } catch {
      /* 缓存写失败不阻塞 */
    }
  }
  return songs;
}
