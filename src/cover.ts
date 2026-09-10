/**
 * 封面解析 —— 统一的封面获取链路（全部走 fetch 下载 + base64，绕开 RN Image
 * 在 iOS 上直接加载远程图的各种限制：防盗链、请求头、证书等）。
 *
 * 兜底顺序：
 * 1) song.pic（搜索源/合集自带）
 * 2) 腾讯搜索按「歌名+歌手」查 albummid → y.gtimg.cn 图片直链（实测可用）
 * 3) 全部失败返回 null（由组件显示中性占位）
 *
 * 结果带内存缓存（URL → dataURI、歌曲 → dataURI），列表滚动不重复下载。
 */
import type { Song } from './types';

const TIMEOUT_MS = 12_000;

async function fetchBuffer(url: string, referer?: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: {
        Accept: 'image/*',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        ...(referer ? { Referer: referer } : {}),
      },
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (!buf || buf.byteLength < 100) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 二进制 → base64 data URI（分块避免栈溢出） */
function bytesToDataUri(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  const b64 = (globalThis as any).btoa as (s: string) => string; // RN(Hermes) 与 Node16+ 均有全局 btoa
  return `data:${mime};base64,${b64(binary)}`;
}

async function fetchDataUri(url: string): Promise<string | null> {
  const hit = dataUriCache.get(url);
  if (hit) return hit || null;
  const bytes = await fetchBuffer(url);
  if (!bytes) {
    dataUriCache.set(url, '');
    return null;
  }
  // 由文件头推断 mime（绝大多数封面为 jpeg）
  let mime = 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png';
  else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = 'image/gif';
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mime = 'image/webp';
  const dataUri = bytesToDataUri(bytes, mime);
  dataUriCache.set(url, dataUri);
  return dataUri;
}

/** URL → dataURI 缓存 */
const dataUriCache = new Map<string, string>();
/** 歌曲 → 最终封面（dataURI 或 ''）缓存 */
const resultCache = new Map<string, string>();

async function fetchJson(url: string, referer: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', ...(referer ? { Referer: referer } : {}) },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 腾讯搜索拿封面直链（实测无需 Referer，iOS 可用） */
async function tencentCoverUrl(song: Song): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${song.name} ${song.singer}`.trim());
    const data = await fetchJson(
      `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${query}&format=json&p=1&n=1`,
      '',
    );
    const albummid = data?.data?.song?.list?.[0]?.albummid;
    return albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : null;
  } catch {
    return null;
  }
}

/**
 * 获取歌曲封面（dataURI）。song.pic 存在则尝试；失败或缺失时用腾讯兜底。
 */
export async function resolveCover(song: Song): Promise<string | null> {
  const key = `${song.source}:${song.id}`;
  const hit = resultCache.get(key);
  if (hit !== undefined) return hit || null;

  const candidates: string[] = [];
  if (song.pic) candidates.push(song.pic);
  const tx = await tencentCoverUrl(song);
  if (tx && !candidates.includes(tx)) candidates.push(tx);

  let resolved: string | null = null;
  for (const url of candidates) {
    const dataUri = await fetchDataUri(url);
    if (dataUri) {
      resolved = dataUri;
      break;
    }
  }
  resultCache.set(key, resolved ?? '');
  return resolved;
}

/** 兼容旧引用：按 URL 拿 dataURI（组件内部用） */
export async function fetchCover(song: Song, opts?: { ignorePic?: boolean }): Promise<string | null> {
  return resolveCover(opts?.ignorePic ? { ...song, pic: undefined } : song);
}
