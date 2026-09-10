/**
 * 发现数据层 —— 主页「每日推荐」与音乐馆「热门合集」的歌曲来源。
 * 全部使用公开接口，多源容错：单个接口失效自动跳过，不影响其他合集。
 */
import type { Collection, Song } from './types';

const TIMEOUT_MS = 12_000;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
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

/** 网易云榜单 / 歌单 */
async function fetchWyPlaylist(id: string): Promise<Song[]> {
  const urls = [
    `https://music.163.com/api/v3/playlist/detail?id=${id}&n=1000`,
    `https://music.163.com/api/playlist/detail?id=${id}`,
  ];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const data = await fetchJson(url, { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' });
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
            pic: it.al?.picUrl ? String(it.al.picUrl) : undefined,
          }));
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('网易云接口无返回');
}

/** 酷我热歌榜 */
async function fetchKwBang(bangId: string): Promise<Song[]> {
  const url = `https://www.kuwo.cn/api/www/bang/bang/musicList?bangId=${bangId}&pn=1&rn=50`;
  const data = await fetchJson(url, {
    Referer: 'https://www.kuwo.cn/',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  });
  const list: any[] = data?.data?.musiclist ?? [];
  return list
    .filter((it: any) => it?.rid)
    .map((it: any) => ({
      source: 'kw' as const,
      id: String(it.rid),
      hash: String(it.rid),
      name: String(it.name ?? ''),
      singer: String(it.artist ?? ''),
      album: it.album ? String(it.album) : undefined,
      interval: Number(it.duration ?? 0) || undefined,
      pic: it.pic ? String(it.pic) : undefined,
    }));
}

/** 腾讯音乐排行榜 */
async function fetchTxTop(topId: string): Promise<Song[]> {
  const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?page=detail&topid=${topId}&type=top&song_begin=0&song_num=50&format=json`;
  const data = await fetchJson(url, { Referer: 'https://y.qq.com/' });
  const list: any[] = data?.songlist ?? [];
  return list
    .filter((it: any) => it?.songmid)
    .map((it: any) => ({
      source: 'tx' as const,
      id: String(it.songmid),
      songmid: String(it.songmid),
      name: String(it.songname ?? ''),
      singer: (it.singer ?? []).map((s: any) => s?.name ?? '').join(' / '),
      album: it.albumname ? String(it.albumname) : undefined,
      interval: Number(it.interval ?? 0) || undefined,
      pic: it.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${it.albummid}.jpg` : undefined,
    }));
}

/** 主页「每日推荐」合集 */
export const HOME_COLLECTIONS: Collection[] = [
  { id: 'wy-up', name: '每日推荐·飙升榜', desc: '网易云音乐 · 24 小时热度上升最快', source: 'wy', apiId: '19723756', hue: 152 },
  { id: 'wy-hot', name: '每日推荐·热歌榜', desc: '网易云音乐 · 大家都在听', source: 'wy', apiId: '3778678', hue: 198 },
  { id: 'wy-new', name: '每日推荐·新歌榜', desc: '网易云音乐 · 最新发布抢先听', source: 'wy', apiId: '3779629', hue: 268 },
  { id: 'kw-hot', name: '每日推荐·酷我热歌', desc: '酷我音乐 · 热歌 TOP50', source: 'kw', apiId: '16', hue: 26 },
  { id: 'tx-top', name: '每日推荐·腾讯巅峰', desc: 'QQ 音乐 · 巅峰流行榜', source: 'tx', apiId: '26', hue: 330 },
];

/** 音乐馆「热门音乐合集」 */
export const EXPLORE_COLLECTIONS: Collection[] = [
  { id: 'wy-original', name: '原创音乐榜', desc: '网易云音乐 · 独立原创新声', source: 'wy', apiId: '2884035', hue: 152 },
  { id: 'kw-hot', name: '酷我热歌榜', desc: '酷我音乐 · 热歌 TOP50', source: 'kw', apiId: '16', hue: 26 },
  { id: 'tx-top', name: '腾讯巅峰榜', desc: 'QQ 音乐 · 巅峰流行榜', source: 'tx', apiId: '26', hue: 330 },
  { id: 'wy-up', name: '飙升榜', desc: '网易云音乐 · 热度上升最快', source: 'wy', apiId: '19723756', hue: 198 },
  { id: 'wy-new', name: '新歌榜', desc: '网易云音乐 · 最新发布', source: 'wy', apiId: '3779629', hue: 268 },
  { id: 'wy-hot', name: '热歌榜', desc: '网易云音乐 · 大家都在听', source: 'wy', apiId: '3778678', hue: 22 },
];

/** 根据合集拉取歌曲列表 */
export async function fetchCollectionSongs(c: Collection): Promise<Song[]> {
  switch (c.source) {
    case 'wy':
      return fetchWyPlaylist(c.apiId);
    case 'kw':
      return fetchKwBang(c.apiId);
    case 'tx':
      return fetchTxTop(c.apiId);
    default:
      throw new Error('未知合集来源');
  }
}
