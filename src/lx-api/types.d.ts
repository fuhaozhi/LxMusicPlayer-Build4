/**
 * lx-music 自定义音源 API 格式 —— 类型定义
 * 对齐 lx-music-mobile 的 src/types/user_api.d.ts 与 src/types/music.d.ts
 */
/** 音源标识（内置支持源） */
export type Source = 'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'xm' | 'local';
/** 音质 */
export type Quality = '128k' | '320k' | 'flac' | 'flac24bit';
/** 音源支持的动作 */
export type UserApiSourceAction = 'musicUrl' | 'lyric' | 'pic';
/** 脚本上报的单个源信息 */
export interface UserApiSourceInfo {
    /** 源类型，目前仅 music */
    type: 'music';
    /** 支持的动作列表 */
    actions: UserApiSourceAction[];
    /** 支持的音质列表 */
    qualitys: Quality[];
}
/** 脚本信息 */
export interface UserApiScriptInfo {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage: string;
    /** 脚本源码 */
    script: string;
}
/** 初始化完成后的源信息表 */
export type UserApiSources = Partial<Record<Source, UserApiSourceInfo>>;
/** 歌曲信息（脚本侧接收的 musicInfo 字段） */
export interface MusicInfo {
    /** 源内歌曲 ID */
    id: string;
    /** 歌曲名 */
    name: string;
    /** 歌手 */
    singer: string;
    /** 来源 */
    source: Source | string;
    /** 时长（秒） */
    interval?: number;
    /** 专辑名 */
    albumName?: string;
    /** 专辑封面 */
    albumArt?: string;
    /** 酷我源：歌曲 ID（hash 或 songmid 二选一） */
    hash?: string;
    /** 腾讯源：歌曲 mid */
    songmid?: string;
    /** 咪咕源：歌曲 ID */
    copyrightId?: string;
    [key: string]: any;
}
/** 歌词信息（lyric 动作返回） */
export interface LyricInfo {
    /** 原始歌词 */
    lyric: string;
    /** 翻译歌词（可选） */
    tlyric: string | null;
    /** 罗马音歌词（可选） */
    rlyric: string | null;
    /** LX 逐行歌词（可选） */
    lxlyric: string | null;
}
/** 脚本侧音乐请求负载（app -> script 的 request 事件 data） */
export interface ScriptRequestData {
    source: Source;
    action: UserApiSourceAction;
    info: {
        /** 请求音质（musicUrl 时存在） */
        type?: Quality;
        musicInfo: MusicInfo;
    };
}
/** 脚本 -> 宿主 的网络请求（script 调用 lx.request 时发出） */
export interface HostRequestParams {
    requestKey: string;
    url: string;
    options: {
        method: string;
        headers?: Record<string, string>;
        body?: any;
        form?: Record<string, string>;
        formData?: any;
        binary?: boolean;
        timeout?: number;
    };
}
/** 宿主网络响应 */
export interface HostResponse {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
    body: any;
    ok: boolean;
}
/** 宿主 -> 脚本 的响应投递（response 事件） */
export interface HostResponseParams {
    requestKey: string;
    error: string | null;
    response: HostResponse | null;
}
/** 脚本初始化上报（inited 事件 data，形状与官方一致：sources 嵌在 info 下） */
export interface ScriptInitParams {
    status: boolean;
    openDevTools?: boolean;
    info?: {
        sources: Record<string, {
            name?: string;
            type: string;
            actions: string[];
            qualitys: string[];
        }>;
    };
    /** 兼容某些脚本直接平铺上报 */
    sources?: Record<string, {
        name?: string;
        type: string;
        actions: string[];
        qualitys: string[];
    }>;
}
/** 脚本更新提醒（updateAlert 事件 data） */
export interface ScriptUpdateAlertParams {
    log: string;
    updateUrl?: string;
}
/** 统一 API 客户端的源能力描述 */
export interface ApiSourceCapability {
    source: Source | string;
    actions: UserApiSourceAction[];
    qualitys: Quality[];
}
/** 统一 API 客户端初始化结果 */
export interface ApiInitResult {
    name: string;
    description: string;
    version: string;
    author: string;
    homepage: string;
    sources: ApiSourceCapability[];
}
/** 播放地址结果 */
export interface MusicUrlResult {
    type: Quality;
    url: string;
}
/** 运行时日志级别 */
export type LogLevel = 'log' | 'info' | 'warn' | 'error';
/** 日志回调 */
export type Logger = (level: LogLevel, message: string) => void;
