/**
 * 脚本隔离执行环境
 *
 * Android 端在独立 QuickJS 线程中执行音源脚本；iOS 端没有对应原生模块，
 * 这里提供两种纯 JS 后端：
 *
 * - VMSandbox      ：基于 Node `vm`，真隔离上下文，用于 Node 测试 / SSR 场景
 * - FunctionSandbox：基于 `new Function` + 参数遮蔽 globalThis，可在 iOS RN
 *                    （JavaScriptCore 或开启 eval 的 Hermes）中运行
 */
import type { Logger } from './types.js';
export interface ISandbox {
    /** 在沙箱中执行一段脚本 */
    evaluate(code: string): any;
    /** 调用沙箱全局函数（如 __lx_native__） */
    callGlobal(name: string, ...args: any[]): any;
    /** 设置沙箱全局属性（如 __lx_native_call__ 系列桥接函数） */
    setGlobal(name: string, value: any): void;
    /** 读取沙箱全局属性 */
    getGlobal(name: string): any;
    /** 销毁沙箱 */
    destroy(): void;
}
export interface SandboxOptions {
    logger?: Logger;
    handlers: {
        nativeCall: (action: string, data: string) => void;
        utilsStr2B64: (str: string) => string;
        utilsB642Buf: (b64: string) => string;
        utilsStr2Md5: (str: string) => string;
        utilsAesEncrypt: (dataB64: string, keyB64: string, ivB64: string, mode: string) => string;
        utilsRsaEncrypt: (dataB64: string, keyPem: string) => string;
        setTimeout: (id: number, ms: number) => void;
    };
}
/** Node vm 后端：真隔离 */
export declare class VMSandbox implements ISandbox {
    private context;
    private readonly sandboxGlobal;
    private readonly contextified;
    private readonly vm;
    /** 沙箱脚本文件名标记（用于识别未捕获 rejection 是否来自本沙箱） */
    private readonly scriptFilename;
    private unhandledRejectionBound;
    constructor(options: SandboxOptions);
    private installUnhandledRejectionGuard;
    evaluate(code: string): any;
    callGlobal(name: string, ...args: any[]): any;
    setGlobal(name: string, value: any): void;
    getGlobal(name: string): any;
    destroy(): void;
}
/** new Function 后端：适用于 iOS RN（JSC / Hermes），函数参数遮蔽全局 */
export declare class FunctionSandbox implements ISandbox {
    private readonly sandboxGlobal;
    private readonly logger?;
    private runner;
    private readonly FunctionCtor;
    constructor(options: SandboxOptions);
    evaluate(code: string): any;
    callGlobal(name: string, ...args: any[]): any;
    setGlobal(name: string, value: any): void;
    getGlobal(name: string): any;
    destroy(): void;
}
/** 自动选择后端：Node 环境优先 vm，其余用 new Function */
export declare function createSandbox(options: SandboxOptions): ISandbox;
