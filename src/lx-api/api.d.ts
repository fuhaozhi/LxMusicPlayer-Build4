/**
 * LxMusicApi —— 统一音乐 API 客户端
 *
 * 封装 LxUserApiRuntime，对上层提供稳定的统一格式：
 *   - getMusicUrl(source, musicInfo, quality) -> { type, url }
 *   - getLyric(source, musicInfo)              -> { lyric, tlyric, rlyric, lxlyric }
 *   - getPic(source, musicInfo)                -> string (封面 URL)
 *   - 音源能力查询：actions / qualitys
 *
 * iOS 应用中直接 new 一个实例即可，无需任何原生模块。
 */
import { LxUserApiRuntime, type RuntimeOptions } from './runtime.js';
import type { ApiInitResult, ApiSourceCapability, LyricInfo, MusicInfo, MusicUrlResult, Quality, Source, UserApiScriptInfo } from './types.js';
export interface LxMusicApiOptions extends RuntimeOptions {
    /** 是否自动加载（默认 true；false 时需手动调用 load()） */
    autoLoad?: boolean;
}
/** 从脚本源码创建（脚本信息缺省字段自动补默认值） */
export declare function buildScriptInfo(info: Partial<UserApiScriptInfo> & {
    script: string;
}): UserApiScriptInfo;
/** 从 URL 拉取脚本源码 */
export declare function fetchScript(url: string, timeout?: number): Promise<string>;
export declare class LxMusicApi {
    readonly runtime: LxUserApiRuntime;
    private readonly info;
    constructor(scriptInfo: UserApiScriptInfo, options?: LxMusicApiOptions);
    /** 便捷创建：直接传脚本源码 */
    static fromScript(script: string, options?: LxMusicApiOptions): Promise<LxMusicApi>;
    /** 便捷创建：从 URL 拉取脚本 */
    static fromUrl(url: string, options?: LxMusicApiOptions): Promise<LxMusicApi>;
    /** 便捷创建：传完整脚本信息 */
    static fromScriptInfo(info: UserApiScriptInfo, options?: LxMusicApiOptions): Promise<LxMusicApi>;
    /** 加载脚本并等待初始化完成 */
    load(): Promise<ApiInitResult>;
    /** 初始化结果（脚本信息 + 源能力表） */
    getInitResult(): ApiInitResult;
    /** 全部音源能力 */
    getSourceCapabilities(): ApiSourceCapability[];
    /** 指定音源能力；音源不存在时返回 null */
    getSource(source: Source | string): ApiSourceCapability | null;
    private assertAction;
    /** 获取播放地址 */
    getMusicUrl(source: Source | string, musicInfo: MusicInfo, quality: Quality): Promise<MusicUrlResult>;
    /** 获取歌词 */
    getLyric(source: Source | string, musicInfo: MusicInfo): Promise<LyricInfo>;
    /** 获取封面 */
    getPic(source: Source | string, musicInfo: MusicInfo): Promise<string>;
    /** 释放资源 */
    destroy(): void;
}
