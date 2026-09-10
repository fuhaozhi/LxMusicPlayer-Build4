/** 简易 LRC 歌词解析：支持 [mm:ss.xx] / [mm:ss] 多时间戳行 */
import type { LrcLine } from '../types';

export function parseLrc(text: string): LrcLine[] {
  const lines: LrcLine[] = [];
  if (!text) return lines;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('[') === false) continue;
    const times = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (!times.length) continue;
    const content = line.replace(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g, '').trim();
    for (const m of times) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const frac = m[3] ? Number(m[3].padEnd(3, '0').slice(0, 3)) : 0;
      lines.push({ time: min * 60 + sec + frac / 1000, text: content });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** 找到 currentTime 对应的当前行索引（-1 表示歌词尚未开始） */
export function currentLrcIndex(lrc: LrcLine[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lrc.length; i++) {
    if (lrc[i].time <= time) idx = i;
    else break;
  }
  return idx;
}

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
