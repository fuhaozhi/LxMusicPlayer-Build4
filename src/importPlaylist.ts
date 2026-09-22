/**
 * 歌单导入 —— 支持网易云 / QQ音乐 / 酷狗 分享链接与歌单 ID 拉取，
 * 以及多行文本（歌名 歌手）解析。全部使用公开接口，不依赖音源脚本。
 */
import type { Song } from './types';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const TIMEOUT_MS = 15_000;

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const text = await fetchText(url, headers);
  try {
    return JSON.parse(text);
  } catch {
    // 兼容 JSONP / 括号包裹 / 单引号 JSON
    try {
      const inner = text.replace(/^[^(]*\(/, '').replace(/\)[^)]*$/, '');
      return JSON.parse(inner);
    } catch {
      try {
        return JSON.parse(text.replace(/'/g, '"'));
      } catch {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
        throw new Error('非 JSON 响应');
      }
    }
  }
}

export interface ParsedShare {
  kind: 'link' | 'text' | 'id';
  platform?: 'wy' | 'tx' | 'kg';
  id?: string;
  /** 短链（163cn.tv 等），调用方跟随跳转后重新解析 */
  shortUrl?: string;
}

/** 解析分享链接 / 歌单 ID / 多行文本 */
export function parseShareInput(text: string): ParsedShare {
  const t = text.trim();
  if (!t) return { kind: 'text' };

  // 网易云
  const wy =
    t.match(/(?:music\.163\.com[^\s]*?[?&#]id=|music\.163\.com\/(?:#\/)?playlist[^\s]*?\/)(\d{5,})/i) ||
    t.match(/music\.163\.com\/playlist[^\s]*?(\d{5,})/i);
  if (wy) return { kind: 'link', platform: 'wy', id: wy[1] };

  // QQ 音乐
  const tx =
    t.match(/y\.qq\.com\/n\/ryqq\/playlistDetail\/(\d{5,})/i) ||
    t.match(/i\.y\.qq\.com[^\s]*?[?&]id=(\d{5,})/i) ||
    t.match(/y\.qq\.com[^\s]*?playlist[^\s]*?(\d{5,})/i);
  if (tx) return { kind: 'link', platform: 'tx', id: tx[1] };

  // 酷狗
  const kg =
    t.match(/kugou\.com\/yy\/playlist\/(\d{5,})\.html/i) ||
    t.match(/m\.kugou\.com\/plist\/list\/(\d{5,})/i) ||
    t.match(/kugou\.com\/special\/single\/(\d{5,})/i);
  if (kg) return { kind: 'link', platform: 'kg', id: kg[1] };

  // 短链（163cn.tv / c6.y.qq.com 等）：返回 kind='id' 交由调用方跟随跳转后重新解析
  if (/^(https?:\/\/)?(163cn\.tv|c6\.y\.qq\.com|6cn\.tv)\//i.test(t)) {
    return { kind: 'link', platform: undefined, id: undefined, shortUrl: t };
  }

  // 纯数字 ID（>=4 位）
  if (/^\d{4,}$/.test(t)) return { kind: 'id', id: t };

  // 其余视为文本（多行 / 歌名 歌手）
  return { kind: 'text' };
}

export interface ImportedList {
  platform: 'wy' | 'tx' | 'kg';
  name: string;
  songs: Song[];
}

/** 网易云歌单（多候选接口，与音乐馆同一套公开接口） */
export async function fetchWyPlaylist(id: string): Promise<ImportedList> {
  const urls = [
    `https://music.163.com/api/v3/playlist/detail?id=${id}&n=1000`,
    `https://music.163.com/api/v6/playlist/detail?id=${id}&n=1000`,
    `https://music.163.com/api/playlist/detail?id=${id}`,
  ];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const data = await fetchJson(url, { Referer: 'https://music.163.com/' });
      const pl = data?.playlist ?? data?.result ?? {};
      const tracks: any[] = data?.playlist?.tracks ?? data?.result?.tracks ?? [];
      if (tracks.length) {
        return {
          platform: 'wy',
          name: String(pl?.name ?? '网易云歌单'),
          songs: tracks
            .filter((it: any) => it?.id)
            .map((it: any) => ({
              source: 'wy' as const,
              id: String(it.id),
              name: String(it.name ?? ''),
              singer: (it.ar ?? []).map((a: any) => a?.name ?? '').join(' / '),
              album: it.al?.name ? String(it.al.name) : undefined,
              interval: Math.floor(Number(it.dt ?? 0) / 1000) || undefined,
              pic: it.al?.picUrl ? String(it.al.picUrl).replace(/^http:/, 'https:') : undefined,
            })),
        };
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('网易云接口无返回');
}

/** QQ 音乐歌单（分页拉全） */
export async function fetchTxPlaylist(id: string): Promise<ImportedList> {
  const songs: Song[] = [];
  const name = `QQ音乐歌单 ${id}`;
  const pageSize = 50;
  const maxPages = 12;
  for (let page = 0; page < maxPages; page++) {
    const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}&format=json&song_begin=${page * pageSize}&song_num=${pageSize}`;
    const data = await fetchJson(url, { Referer: 'https://y.qq.com/' });
    const cd = data?.cdlist?.[0];
    if (!cd) break;
    if (page === 0 && cd.dissname) {
      // 用歌单名覆盖默认名
      return await fetchTxPlaylistWithName(id, String(cd.dissname));
    }
    const list: any[] = cd?.songlist ?? [];
    if (!list.length) break;
    for (const it of list) {
      if (!it?.songmid) continue;
      songs.push({
        source: 'tx' as const,
        id: String(it.songmid),
        songmid: String(it.songmid),
        name: String(it.songname ?? ''),
        singer: (it.singer ?? []).map((s: any) => s?.name ?? '').join(' / '),
        album: it.albumname ? String(it.albumname) : undefined,
        interval: Number(it.interval ?? 0) || undefined,
      });
    }
    if (list.length < pageSize) break;
  }
  if (!songs.length) throw new Error('QQ音乐接口无返回');
  return { platform: 'tx', name, songs };
}

/** QQ 音乐歌单（已知歌单名，拉全） */
async function fetchTxPlaylistWithName(id: string, name: string): Promise<ImportedList> {
  const songs: Song[] = [];
  const pageSize = 50;
  const maxPages = 12;
  for (let page = 0; page < maxPages; page++) {
    const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}&format=json&song_begin=${page * pageSize}&song_num=${pageSize}`;
    const data = await fetchJson(url, { Referer: 'https://y.qq.com/' });
    const cd = data?.cdlist?.[0];
    const list: any[] = cd?.songlist ?? [];
    if (!list.length) break;
    for (const it of list) {
      if (!it?.songmid) continue;
      songs.push({
        source: 'tx' as const,
        id: String(it.songmid),
        songmid: String(it.songmid),
        name: String(it.songname ?? ''),
        singer: (it.singer ?? []).map((s: any) => s?.name ?? '').join(' / '),
        album: it.albumname ? String(it.albumname) : undefined,
        interval: Number(it.interval ?? 0) || undefined,
      });
    }
    if (list.length < pageSize) break;
  }
  if (!songs.length) throw new Error('QQ音乐接口无返回');
  return { platform: 'tx', name, songs };
}

/** 酷狗歌单（分页拉全；歌单名另取 special/info） */
export async function fetchKgPlaylist(id: string): Promise<ImportedList> {
  let name = `酷狗歌单 ${id}`;
  try {
    const info = await fetchJson(
      `https://mobiles.kugou.com/api/v5/special/info?specialid=${id}&page=1&pagesize=1&is_all=1`,
      { Referer: 'https://www.kugou.com/' },
    );
    if (info?.data?.specialname) name = String(info.data.specialname);
  } catch {
    /* 歌单名拿不到就用默认名 */
  }
  const songs: Song[] = [];
  const pageSize = 30;
  const maxPages = 40;
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchJson(
      `https://mobiles.kugou.com/api/v5/special/song?specialid=${id}&page=${page}&pagesize=${pageSize}&is_all=1`,
      { Referer: 'https://www.kugou.com/' },
    );
    const list: any[] = data?.data?.info ?? [];
    if (!list.length) break;
    for (const it of list) {
      if (!it?.hash) continue;
      // 酷狗返回 filename="歌手 - 歌名"
      const filename = String(it.filename ?? '');
      const dash = filename.indexOf(' - ');
      const name = dash >= 0 ? filename.slice(dash + 3).trim() : filename.trim();
      const singer = dash >= 0 ? filename.slice(0, dash).trim() : '';
      const picRaw = String(it.union_cover || it.imgurl || '');
      songs.push({
        source: 'kg' as const,
        id: String(it.hash),
        hash: String(it.hash),
        name: name || '未知歌曲',
        singer,
        album: it.album_name ? String(it.album_name) : undefined,
        interval: Number(it.duration ?? 0) || undefined,
        pic: picRaw ? picRaw.replace(/\{size\}/g, '480') : undefined,
      });
    }
    if (list.length < pageSize) break;
  }
  if (!songs.length) throw new Error('酷狗接口无返回');
  return { platform: 'kg', name, songs };
}

export interface TextSongLine {
  name: string;
  singer?: string;
}

/** 解析多行文本：每行「歌名 歌手」或「歌名 - 歌手」 */
export function parseTextSongs(text: string): TextSongLine[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const sep = line.split(/\s+[-–—]\s+|\s+/);
      const name = sep[0]?.trim() || '';
      const singer = sep.length > 1 ? sep.slice(1).join(' ').trim() : undefined;
      return { name, singer };
    })
    .filter(x => x.name);
}
