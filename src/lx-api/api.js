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
import { LxUserApiRuntime } from './runtime.js';
/** 从脚本源码创建（脚本信息缺省字段自动补默认值） */
export function buildScriptInfo(info) {
    return {
        id: info.id ?? `user-api-${Date.now().toString(36)}`,
        name: info.name ?? 'Custom User Api',
        description: info.description ?? '',
        version: info.version ?? '',
        author: info.author ?? '',
        homepage: info.homepage ?? '',
        script: info.script,
    };
}
/** 从 URL 拉取脚本源码 */
export async function fetchScript(url, timeout = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const resp = await globalThis.fetch(url, { signal: controller.signal });
        if (!resp.ok)
            throw new Error(`Failed to fetch script (${resp.status} ${resp.statusText}): ${url}`);
        return await resp.text();
    }
    finally {
        clearTimeout(timer);
    }
}
export class LxMusicApi {
    constructor(scriptInfo, options = {}) {
        this.info = scriptInfo;
        this.runtime = new LxUserApiRuntime(scriptInfo, options);
    }
    /** 便捷创建：直接传脚本源码 */
    static async fromScript(script, options) {
        return LxMusicApi.fromScriptInfo(buildScriptInfo({ script }), options);
    }
    /** 便捷创建：从 URL 拉取脚本 */
    static async fromUrl(url, options) {
        const script = await fetchScript(url);
        return LxMusicApi.fromScriptInfo(buildScriptInfo({ script, name: url }), options);
    }
    /** 便捷创建：传完整脚本信息 */
    static async fromScriptInfo(info, options) {
        const api = new LxMusicApi(info, options);
        if (options?.autoLoad !== false)
            await api.load();
        return api;
    }
    /** 加载脚本并等待初始化完成 */
    async load() {
        const sources = await this.runtime.load();
        return this.getInitResult();
    }
    /** 初始化结果（脚本信息 + 源能力表） */
    getInitResult() {
        return {
            name: this.info.name,
            description: this.info.description,
            version: this.info.version,
            author: this.info.author,
            homepage: this.info.homepage,
            sources: this.getSourceCapabilities(),
        };
    }
    /** 全部音源能力 */
    getSourceCapabilities() {
        const sources = this.runtime.getSources();
        return Object.entries(sources).map(([source, info]) => ({
            source,
            actions: info.actions,
            qualitys: info.qualitys,
        }));
    }
    /** 指定音源能力；音源不存在时返回 null */
    getSource(source) {
        const info = this.runtime.getSources()[source];
        if (!info)
            return null;
        return { source, actions: info.actions, qualitys: info.qualitys };
    }
    assertAction(source, action) {
        const cap = this.getSource(source);
        if (!cap)
            throw new Error(`Source "${source}" is not provided by this script`);
        if (!cap.actions.includes(action))
            throw new Error(`Source "${source}" does not support action "${action}"`);
    }
    /** 获取播放地址 */
    async getMusicUrl(source, musicInfo, quality) {
        this.assertAction(source, 'musicUrl');
        return this.runtime.getMusicUrl(source, musicInfo, quality);
    }
    /** 获取歌词 */
    async getLyric(source, musicInfo) {
        this.assertAction(source, 'lyric');
        return this.runtime.getLyric(source, musicInfo);
    }
    /** 获取封面 */
    async getPic(source, musicInfo) {
        this.assertAction(source, 'pic');
        return this.runtime.getPic(source, musicInfo);
    }
    /** 释放资源 */
    destroy() {
        this.runtime.destroy();
    }
}
