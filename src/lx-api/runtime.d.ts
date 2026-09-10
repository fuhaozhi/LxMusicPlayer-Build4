import { type ISandbox, type SandboxOptions } from './sandbox.js';
import type { Logger, LyricInfo, MusicInfo, MusicUrlResult, Quality, Source, UserApiScriptInfo, UserApiSources } from './types.js';
export interface RuntimeOptions {
    /** 日志回调（默认转发到 console） */
    logger?: Logger;
    /** 脚本初始化超时（ms，默认 10000） */
    initTimeout?: number;
    /** 音乐请求超时（ms，默认 20000，与官方 App 一致） */
    requestTimeout?: number;
    /** 是否允许脚本弹更新提醒（默认 false，与官方 App 默认一致） */
    allowShowUpdateAlert?: boolean;
    /**
     * 自定义沙箱工厂（测试 / 强制指定后端用）。
     * 默认 Node 环境用 VMSandbox，其余（iOS RN）用 FunctionSandbox。
     * 传入时接收与 createSandbox 相同的 handlers，返回自定义 ISandbox。
     */
    sandbox?: (handlers: SandboxOptions['handlers']) => ISandbox;
}
export interface UpdateAlertEvent {
    name: string;
    log: string;
    updateUrl?: string;
}
export declare class LxUserApiRuntime {
    readonly scriptInfo: UserApiScriptInfo;
    private readonly options;
    private readonly logger;
    private readonly sandbox;
    private readonly key;
    private readyPromise;
    private readyResolve;
    private readyReject;
    private isReady;
    private isDestroyed;
    /** 宿主网络请求表（脚本 -> 宿主 fetch 的取消句柄） */
    private readonly nativeRequestMap;
    /** 音乐请求表（宿主 -> 脚本 的 pending 调用） */
    private readonly appRequestMap;
    /** 更新提醒事件（需要 options.allowShowUpdateAlert === true 才触发） */
    onUpdateAlert: ((event: UpdateAlertEvent) => void) | null;
    constructor(scriptInfo: UserApiScriptInfo, options?: RuntimeOptions);
    /** 加载脚本并等待 inited 事件，返回脚本声明的源能力表 */
    load(): Promise<UserApiSources>;
    /** 脚本初始化完成后上报的源信息（load() 返回的同一对象） */
    getSources(): UserApiSources;
    private sources;
    /** 当前是否已完成初始化 */
    isInited(): boolean;
    private handleNativeCall;
    /** 宿主 -> 脚本 事件投递（等价 App 端 sendAction -> 脚本 __lx_native__） */
    private callScript;
    /** 调用脚本的某个动作（source + action + info），返回脚本归一化后的 result.data */
    callAction(source: Source | string, action: 'musicUrl' | 'lyric' | 'pic', info: {
        type?: Quality;
        musicInfo: MusicInfo;
    }): Promise<any>;
    /** 获取播放地址：返回 { type, url } */
    getMusicUrl(source: Source | string, musicInfo: MusicInfo, type: Quality): Promise<MusicUrlResult>;
    /** 获取歌词：返回 { lyric, tlyric, rlyric, lxlyric } */
    getLyric(source: Source | string, musicInfo: MusicInfo): Promise<LyricInfo>;
    /** 获取封面：返回图片 URL 字符串 */
    getPic(source: Source | string, musicInfo: MusicInfo): Promise<string>;
    /** 释放运行时 */
    destroy(): void;
}
/** 便捷工厂：传入脚本信息与配置，加载后返回已就绪的运行时 */
export declare function createRuntime(scriptInfo: UserApiScriptInfo, options?: RuntimeOptions): Promise<LxUserApiRuntime>;
