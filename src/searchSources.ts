/**
 * 内置搜索源 —— 公开接口，无鉴权，失败自动跳过。
 * 搜索结果统一为 Song[]，字段按音源脚本取链所需映射（hash/songmid/copyrightId 等）。
 */
import type { Song } from './types';

const TIMEOUT_MS = 12_000;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    // 1) 标准 JSON
    try {
      return JSON.parse(text);
    } catch {
      /* 兼容处理 */
    }
    // 2) JSONP / 括号包裹（jQuery123(...) 等）：剥掉首尾包裹再解析
    try {
      const inner = text.replace(/^[^(]*\(/, '').replace(/\)[^)]*$/, '');
      return JSON.parse(inner);
    } catch {
      /* 继续 */
    }
    // 3) 单引号 JSON（酷我 r.s 接口返回 {'a':1}）：引号统一转双引号
    try {
      const quoted = text.replace(/'/g, '"');
      return JSON.parse(quoted);
    } catch {
      /* 继续 */
    }
    // 4) 提取首个 { 到最后一个 }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    // 5) 提取数组
    const as = text.indexOf('[');
    const ae = text.lastIndexOf(']');
    if (as >= 0 && ae > as) return JSON.parse(text.slice(as, ae + 1));
    throw new Error('非 JSON 响应');
  } finally {
    clearTimeout(timer);
  }
}

/** 酷我音乐搜索（官方接口；播放走官方直链 antiserver.kuwo.cn，不依赖音源脚本） */
export async function searchKuwo(kw: string): Promise<Song[]> {
  const url = `https://search.kuwo.cn/r.s?all=${encodeURIComponent(kw)}&ft=music&itemset=web_2013&pn=0&rn=50&rformat=json&encoding=utf8`;
  const data = await fetchJson(url, { Referer: 'https://www.kuwo.cn/' });
  const list: any[] = data?.abslist ?? data?.ABSLIST ?? [];
  return list
    .filter((it: any) => it?.MUSICRID)
    .map((it: any) => {
      const rid = String(it.MUSICRID).replace(/^MUSIC_/, '');
      return {
        source: 'kw',
        id: rid,
        hash: rid,
        name: String(it.NAME ?? ''),
        singer: String(it.ARTIST ?? ''),
        album: it.ALBUM ? String(it.ALBUM) : undefined,
        interval: Number(it.DURATION ?? 0) || undefined,
        pic: it.web_albumpic_short ? String(it.web_albumpic_short) : undefined,
      };
    });
}

/** 腾讯音乐（QQ 音乐）搜索 */
async function searchTencent(kw: string): Promise<Song[]> {
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(kw)}&format=json&p=1&n=50`;
  const data = await fetchJson(url, { Referer: 'https://y.qq.com/' });
  const list: any[] = data?.data?.song?.list ?? [];
  return list
    .filter((it: any) => it?.songmid)
    .map((it: any) => ({
      source: 'tx',
      id: String(it.songmid),
      songmid: String(it.songmid),
      name: String(it.songname ?? ''),
      singer: (it.singer ?? []).map((s: any) => s?.name ?? '').join(' / '),
      album: it.albumname ? String(it.albumname) : undefined,
      interval: Number(it.interval ?? 0) || undefined,
      pic: it.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${it.albummid}.jpg` : undefined,
    }));
}

/** 酷狗音乐搜索（搜索接口无需签名，直接 JSON；hash 即 FileHash，供取链） */
async function searchKuGou(kw: string): Promise<Song[]> {
  const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(kw)}&page=1&pagesize=50&platform=WebFilter&userid=-1&clientver=2000&iscorrection=1`;
  const data = await fetchJson(url, {
    Referer: 'https://www.kugou.com/',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  });
  const list: any[] = data?.data?.lists ?? [];
  return list
    .filter((it: any) => it?.FileHash)
    .map((it: any) => {
      const hash = String(it.FileHash);
      // 封面：官方返回 http://imge.kugou.com/stdmusic/{size}/...jpg，占位符 {size} 需替换为具体尺寸
      const rawPic = it.Image ? String(it.Image).replace('{size}', '300') : '';
      return {
        source: 'kg',
        id: hash,
        hash,
        name: String(it.SongName ?? ''),
        singer: String(it.SingerName ?? ''),
        album: it.AlbumName ? String(it.AlbumName) : undefined,
        interval: Number(it.Duration ?? 0) || undefined,
        pic: rawPic ? rawPic.replace(/^http:\/\//, 'https://') : undefined,
      };
    });
}

/** 网易云音乐搜索（可播源优先：qdy 音源网易取链实测稳定，播放失败自动换源也用它） */
export async function searchNetease(kw: string): Promise<Song[]> {
  const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(kw)}&type=1&limit=50`;
  const data = await fetchJson(url, { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' });
  const list: any[] = data?.result?.songs ?? [];
  return list
    .filter((it: any) => it?.id)
    .map((it: any) => ({
      source: 'wy',
      id: String(it.id),
      name: String(it.name ?? ''),
      singer: (it.ar ?? []).map((a: any) => a?.name ?? '').join(' / '),
      album: it.al?.name ? String(it.al.name) : undefined,
      interval: Math.floor(Number(it.dt ?? 0) / 1000) || undefined,
      pic: it.al?.picUrl ? String(it.al.picUrl) : undefined,
    }));
}

/** 搜索接口选择列表：酷我（官方直链自足，播放最稳）置顶；酷狗/QQ/网易取链失败会自动用酷我同名兜底播放 */
export const SEARCH_PICKER: { id: string; label: string; run: (kw: string) => Promise<Song[]> }[] = [
  { id: 'kw', label: '酷我', run: searchKuwo },
  { id: 'kg', label: '酷狗', run: searchKuGou },
  { id: 'tx', label: 'QQ', run: searchTencent },
  { id: 'wy', label: '网易', run: searchNetease },
];

/** 全部搜索源（兼容旧调用），按顺序尝试；网易排最前（取链实测稳定，避免用户点到放不了的源） */
export const SEARCH_SOURCES: { id: string; label: string; run: (kw: string) => Promise<Song[]> }[] = SEARCH_PICKER.map(
  s => ({ id: s.id, label: s.label, run: s.run }),
);

/** 并行搜索全部源，返回成功源的合集（带来源标签） */
export async function searchAll(kw: string): Promise<{ source: string; label: string; songs: Song[] }[]> {
  const results = await Promise.allSettled(SEARCH_SOURCES.map(s => s.run(kw).then(songs => ({ s, songs }))));
  return results
    .filter((r): r is PromiseFulfilledResult<{ s: typeof SEARCH_SOURCES[number]; songs: Song[] }> => r.status === 'fulfilled')
    .map(r => ({ source: r.value.s.id, label: r.value.s.label, songs: r.value.songs }));
}
