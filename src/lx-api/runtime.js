/**
 * LxUserApiRuntime —— lx-music 自定义音源脚本运行时（纯 JS，iOS 可直接使用）
 *
 * 在 Android 上，音源脚本运行在独立 QuickJS 线程，通过 UserApiModule 与 App 通信；
 * 本模块用纯 JS 重新实现了该桥接的全部行为（桥接格式与官方实现一致）：
 *
 *  - 脚本环境：globalThis.lx（on/send/request/utils/EVENT_NAMES/version/env/currentScriptInfo）
 *  - 脚本 -> 宿主事件：init / request / cancelRequest / response / showUpdateAlert / log
 *  - 宿主 -> 脚本事件：request / response / __set_timeout__ / __run_error__
 *  - 音乐动作：musicUrl / lyric / pic（结果在脚本侧完成格式校验与归一化）
 *
 * 可直接在 iOS RN（JavaScriptCore / 开启 eval 的 Hermes）或 Node 中运行。
 */
import { PRELOAD_SCRIPT } from './preload.js';
import { createSandbox } from './sandbox.js';
import { fetchData } from './network.js';
import { aesEncrypt, base64ToByteArrayJson, md5, randomBytes, rsaEncrypt, strToBase64, } from './crypto.js';
const DEFAULT_OPTIONS = {
    initTimeout: 10000,
    requestTimeout: 20000,
    allowShowUpdateAlert: false,
};
function defaultLogger(level, message) {
    if (level === 'error')
        console.error(`[user-api] ${message}`);
    else if (level === 'warn')
        console.warn(`[user-api] ${message}`);
    else
        console.log(`[user-api] ${message}`);
}
export class LxUserApiRuntime {
    constructor(scriptInfo, options = {}) {
        this.isReady = false;
        this.isDestroyed = false;
        /** 宿主网络请求表（脚本 -> 宿主 fetch 的取消句柄） */
        this.nativeRequestMap = new Map();
        /** 音乐请求表（宿主 -> 脚本 的 pending 调用） */
        this.appRequestMap = new Map();
        /** 更新提醒事件（需要 options.allowShowUpdateAlert === true 才触发） */
        this.onUpdateAlert = null;
        this.sources = {};
        this.scriptInfo = scriptInfo;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.logger = this.options.logger ?? defaultLogger;
        this.key = randomKey();
        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        const handlers = {
            nativeCall: (action, data) => this.handleNativeCall(action, data),
            utilsStr2B64: str => strToBase64(str),
            utilsB642Buf: b64 => base64ToByteArrayJson(b64),
            utilsStr2Md5: str => md5(str),
            utilsAesEncrypt: (data, key, iv, mode) => aesEncrypt(data, key, iv, mode),
            utilsRsaEncrypt: (data, key) => rsaEncrypt(data, key),
            setTimeout: (id, ms) => {
                if (this.isDestroyed)
                    return;
                globalThis.setTimeout(() => {
                    if (this.isDestroyed)
                        return;
                    try {
                        this.sandbox.callGlobal('__lx_native__', this.key, '__set_timeout__', String(id));
                    }
                    catch (err) {
                        this.logger('error', `set_timeout callback error: ${err?.message ?? err}`);
                    }
                }, ms);
            },
        };
        this.sandbox = this.options.sandbox ? this.options.sandbox(handlers) : createSandbox({ logger: this.logger, handlers });
    }
    /** 加载脚本并等待 inited 事件，返回脚本声明的源能力表 */
    async load() {
        // 1. 注入预加载脚本（建立 globalThis.lx 环境）
        this.sandbox.evaluate(PRELOAD_SCRIPT);
        // 2. 初始化环境（等价 Android QuickJS.createJSEnv -> lx_setup）
        const setup = this.sandbox.getGlobal('lx_setup');
        if (typeof setup !== 'function')
            throw new Error('Preload script failed: lx_setup is not available');
        setup(this.key, this.scriptInfo.id, this.scriptInfo.name, this.scriptInfo.description ?? '', this.scriptInfo.version ?? '', this.scriptInfo.author ?? '', this.scriptInfo.homepage ?? '', this.scriptInfo.script);
        // 3. 执行音源脚本
        try {
            this.sandbox.evaluate(this.scriptInfo.script);
        }
        catch (err) {
            // 等价 Android loadScript 失败路径
            try {
                this.sandbox.callGlobal('__lx_native__', this.key, '__run_error__', null);
            }
            catch { /* ignore */ }
            const loadError = new Error(`Script load failed: ${err?.message ?? err}`);
            if (!this.isReady) {
                this.isReady = true;
                this.readyReject(loadError);
                // 本分支随后直接 throw，无人 await readyPromise，挂一个空 catch 防止 unhandled rejection
                this.readyPromise.catch(() => { });
            }
            throw loadError;
        }
        // 4. 等待 inited
        const initTimeout = this.options.initTimeout ?? DEFAULT_OPTIONS.initTimeout;
        const timer = setTimeout(() => {
            if (this.isReady)
                return;
            this.isReady = true;
            this.readyReject(new Error(`Script init timeout (${initTimeout}ms)`));
        }, initTimeout);
        try {
            return await this.readyPromise;
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** 脚本初始化完成后上报的源信息（load() 返回的同一对象） */
    getSources() {
        return this.sources;
    }
    /** 当前是否已完成初始化 */
    isInited() {
        return this.isReady;
    }
    // ------------------------------------------------------------------
    // 脚本 -> 宿主 事件处理（等价 Android 原生桥 + App 端处理逻辑）
    // ------------------------------------------------------------------
    handleNativeCall(action, data) {
        if (this.isDestroyed)
            return;
        let payload;
        try {
            payload = data == null || data === '' ? null : JSON.parse(data);
        }
        catch {
            this.logger('error', `Invalid native call payload for action "${action}"`);
            return;
        }
        switch (action) {
            case 'init': {
                const info = payload;
                // 官方预加载脚本 handleInit 发送 { info: { sources }, status: true }
                const rawSources = (info.info?.sources ?? info.sources);
                if (info.status && rawSources) {
                    const sources = {};
                    for (const [source, sourceInfo] of Object.entries(rawSources)) {
                        if (!sourceInfo || sourceInfo.type !== 'music')
                            continue;
                        sources[source] = {
                            type: 'music',
                            actions: (sourceInfo.actions ?? []).filter((a) => a === 'musicUrl' || a === 'lyric' || a === 'pic'),
                            qualitys: (sourceInfo.qualitys ?? []).filter((q) => typeof q === 'string'),
                        };
                    }
                    this.sources = sources;
                    this.isReady = true;
                    this.readyResolve(sources);
                }
                else {
                    const message = payload?.errorMessage ?? 'init failed';
                    this.isReady = true;
                    this.readyReject(new Error(message));
                }
                break;
            }
            case 'request': {
                const req = payload;
                if (!req || typeof req.url !== 'string')
                    break;
                const handle = fetchData(req.url, {
                    method: req.options?.method,
                    headers: req.options?.headers,
                    body: req.options?.body,
                    form: req.options?.form,
                    formData: req.options?.formData,
                    binary: req.options?.binary,
                    timeout: req.options?.timeout,
                });
                this.nativeRequestMap.set(req.requestKey, { abort: handle.abort });
                handle.request
                    .then((response) => {
                    this.nativeRequestMap.delete(req.requestKey);
                    this.callScript('response', {
                        requestKey: req.requestKey,
                        error: null,
                        response,
                    });
                })
                    .catch((err) => {
                    this.nativeRequestMap.delete(req.requestKey);
                    this.callScript('response', {
                        requestKey: req.requestKey,
                        error: err?.message ?? String(err),
                        response: null,
                    });
                });
                break;
            }
            case 'cancelRequest': {
                const requestKey = payload;
                const target = this.nativeRequestMap.get(requestKey);
                if (!target)
                    return;
                this.nativeRequestMap.delete(requestKey);
                target.abort();
                break;
            }
            case 'response': {
                // 音乐动作结果回传（脚本侧已完成归一化）
                const { requestKey, status, result, errorMessage } = payload ?? {};
                const pending = this.appRequestMap.get(requestKey);
                if (!pending)
                    return;
                this.appRequestMap.delete(requestKey);
                clearTimeout(pending.timer);
                // 官方结果格式 { source, action, data }，对外只暴露归一化后的 data
                if (status)
                    pending.resolve(result?.data);
                else
                    pending.reject(new Error(errorMessage ?? 'request failed'));
                break;
            }
            case 'showUpdateAlert': {
                if (!(this.options.allowShowUpdateAlert ?? false) || !this.onUpdateAlert)
                    break;
                const data = payload;
                this.onUpdateAlert({
                    name: this.scriptInfo.name,
                    log: data?.log ?? '',
                    updateUrl: data?.updateUrl,
                });
                break;
            }
            default:
                this.logger('warn', `Unhandled native action: ${action}`);
                break;
        }
    }
    /** 宿主 -> 脚本 事件投递（等价 App 端 sendAction -> 脚本 __lx_native__） */
    callScript(action, data) {
        if (this.isDestroyed)
            return;
        this.sandbox.callGlobal('__lx_native__', this.key, action, data == null ? null : JSON.stringify(data));
    }
    // ------------------------------------------------------------------
    // 统一音乐 API
    // ------------------------------------------------------------------
    /** 调用脚本的某个动作（source + action + info），返回脚本归一化后的 result.data */
    callAction(source, action, info) {
        if (!this.isReady) {
            return Promise.reject(new Error('User api script is not inited'));
        }
        const requestKey = `request__${Math.random().toString().substring(2)}`;
        const requestTimeout = this.options.requestTimeout ?? DEFAULT_OPTIONS.requestTimeout;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const target = this.appRequestMap.get(requestKey);
                if (!target)
                    return;
                this.appRequestMap.delete(requestKey);
                target.reject(new Error('request timeout'));
            }, requestTimeout);
            this.appRequestMap.set(requestKey, { resolve, reject, timer });
            // 官方协议：App -> 脚本的 request 事件为 { requestKey, data: { source, action, info } }
            this.callScript('request', { requestKey, data: { source, action, info } });
        });
    }
    /** 获取播放地址：返回 { type, url } */
    getMusicUrl(source, musicInfo, type) {
        return this.callAction(source, 'musicUrl', { type, musicInfo });
    }
    /** 获取歌词：返回 { lyric, tlyric, rlyric, lxlyric } */
    getLyric(source, musicInfo) {
        return this.callAction(source, 'lyric', { musicInfo });
    }
    /** 获取封面：返回图片 URL 字符串 */
    getPic(source, musicInfo) {
        return this.callAction(source, 'pic', { musicInfo });
    }
    /** 释放运行时 */
    destroy() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        for (const [, { abort }] of this.nativeRequestMap)
            abort();
        this.nativeRequestMap.clear();
        for (const [, pending] of this.appRequestMap) {
            clearTimeout(pending.timer);
            pending.reject(new Error('runtime destroyed'));
        }
        this.appRequestMap.clear();
        this.sandbox.destroy();
    }
}
function randomKey() {
    const bytes = randomBytes(16);
    let str = '';
    for (let i = 0; i < bytes.length; i++)
        str += bytes[i].toString(16).padStart(2, '0');
    return str;
}
/** 便捷工厂：传入脚本信息与配置，加载后返回已就绪的运行时 */
export async function createRuntime(scriptInfo, options) {
    const runtime = new LxUserApiRuntime(scriptInfo, options);
    await runtime.load();
    return runtime;
}
