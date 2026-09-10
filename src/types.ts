/** 搜索结果中的一首歌 */
export interface Song {
  /** 音源标识（kw/kg/tx/wy/mg） */
  source: string;
  /** 源内歌曲 ID */
  id: string;
  /** 歌曲名 */
  name: string;
  /** 歌手 */
  singer: string;
  /** 专辑名 */
  album?: string;
  /** 时长（秒） */
  interval?: number;
  /** 封面 URL */
  pic?: string;
  /** 音源脚本取链所需的额外字段 */
  hash?: string;
  songmid?: string;
  copyrightId?: string;
}

/** 单个音源脚本的加载状态 */
export interface SourceState {
  id: string;
  name: string;
  url: string;
  state: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  /** 加载成功后脚本暴露的能力 */
  capabilities?: { source: string; actions: string[]; qualitys: string[] }[];
}

/** 播放状态 */
export interface PlayerState {
  song: Song | null;
  url: string | null;
  paused: boolean;
  /** 是否正在缓冲 */
  buffering: boolean;
  currentTime: number;
  duration: number;
  /** 播放出错（外部源失效时展示） */
  error: string | null;
}

/** LRC 歌词行 */
export interface LrcLine {
  time: number;
  text: string;
}
