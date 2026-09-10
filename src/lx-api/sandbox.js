function createSandboxConsole(logger) {
    const logFn = (level) => (...args) => {
        const message = args.map(a => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
        if (logger)
            logger(level, message);
        else if (level === 'error')
            console.error(...args);
        else if (level === 'warn')
            console.warn(...args);
        else
            console.log(...args);
    };
    return {
        log: logFn('log'),
        info: logFn('info'),
        warn: logFn('warn'),
        error: logFn('error'),
        debug: logFn('log'),
        trace: logFn('log'),
        dir: logFn('log'),
        table: logFn('log'),
        group: () => { },
        groupEnd: () => { },
        groupCollapsed: () => { },
        count: () => { },
        countReset: () => { },
        time: () => { },
        timeEnd: () => { },
        timeLog: () => { },
        assert: (condition, ...data) => {
            if (!condition)
                logFn('error')('Assertion failed:', ...data);
        },
        clear: () => { },
        dirxml: logFn('log'),
        exception: logFn('error'),
        profile: () => { },
        profileEnd: () => { },
        timeStamp: () => { },
        Context: undefined,
    };
}
function safeStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
/** 构建沙箱全局对象（含原生桥接函数位） */
function createSandboxGlobal(handlers) {
    const global = {};
    global.__lx_native_call__ = (key, action, data) => {
        if (typeof key !== 'string' || typeof action !== 'string')
            return null;
        handlers.nativeCall(action, data ?? '');
        return null;
    };
    global.__lx_native_call__utils_str2b64 = (str) => handlers.utilsStr2B64(String(str ?? ''));
    global.__lx_native_call__utils_b642buf = (b64) => handlers.utilsB642Buf(String(b64 ?? ''));
    global.__lx_native_call__utils_str2md5 = (str) => handlers.utilsStr2Md5(String(str ?? ''));
    global.__lx_native_call__utils_aes_encrypt = (data, key, iv, mode) => handlers.utilsAesEncrypt(String(data ?? ''), String(key ?? ''), String(iv ?? ''), String(mode ?? ''));
    global.__lx_native_call__utils_rsa_encrypt = (data, key) => handlers.utilsRsaEncrypt(String(data ?? ''), String(key ?? ''));
    global.__lx_native_call__set_timeout = (id, ms) => handlers.setTimeout(Number(id), Number(ms));
    return global;
}
/** 惰性加载 Node vm 模块（仅 Node 环境可用；iOS RN 的 Hermes/JSC 没有 node:vm） */
function loadNodeVm() {
    const proc = globalThis.process;
    if (proc?.getBuiltinModule) {
        try {
            return proc.getBuiltinModule('node:vm');
        }
        catch {
            // fallthrough
        }
    }
    // 兜底：CJS / 打包器环境（globalThis.require）；ESM 下不存在则抛明确错误
    const req = globalThis.require;
    if (typeof req === 'function') {
        try {
            return req('node:vm');
        }
        catch {
            // fallthrough
        }
    }
    throw new Error('VMSandbox 需要 Node.js 的 vm 模块；iOS 环境请使用 FunctionSandbox');
}
/** Node vm 后端：真隔离 */
export class VMSandbox {
    constructor(options) {
        /** 沙箱脚本文件名标记（用于识别未捕获 rejection 是否来自本沙箱） */
        this.scriptFilename = 'user-api-script.js';
        this.unhandledRejectionBound = null;
        this.vm = loadNodeVm();
        this.sandboxGlobal = createSandboxGlobal(options.handlers);
        this.sandboxGlobal.console = createSandboxConsole(options.logger);
        // 注意：不要注入宿主共享对象（如 Node Buffer）——预加载脚本会冻结上下文全局，
        // 注入宿主对象会把宿主自身的原型链冻坏。vm 上下文自带独立 ECMAScript 内建对象，
        // setTimeout 由预加载脚本自行写入 globalThis。
        this.context = this.vm.createContext(this.sandboxGlobal);
        this.contextified = this.context;
        // Node >=15 默认把未捕获 Promise rejection 当作致命错误；官方 QuickJS（Android）
        // 与 iOS JSC/Hermes 都不会因此崩溃。这里挂一个作用域化拦截器，只吞掉
        // 由本沙箱脚本产生的 rejection（栈里带 scriptFilename 标记），不干扰宿主自己的 handler。
        this.installUnhandledRejectionGuard();
    }
    installUnhandledRejectionGuard() {
        const proc = globalThis.process;
        if (!proc || typeof proc.on !== 'function')
            return;
        if (this.unhandledRejectionBound)
            return;
        this.unhandledRejectionBound = (reason, _promise) => {
            const stack = typeof reason?.stack === 'string' ? reason.stack : String(reason ?? '');
            if (!stack.includes(this.scriptFilename))
                return; // 非本沙箱来源，交还宿主处理
            // 只做静默收敛 + 提示日志，避免宿主进程崩溃
            if (typeof console?.warn === 'function') {
                console.warn(`[lx-ios-api] 音源脚本未捕获的异步错误已被沙箱收敛: ${reason?.message ?? reason}`);
            }
        };
        proc.on('unhandledRejection', this.unhandledRejectionBound);
    }
    evaluate(code) {
        return this.vm.runInContext(code, this.context, { filename: this.scriptFilename });
    }
    callGlobal(name, ...args) {
        return this.sandboxGlobal[name](...args);
    }
    setGlobal(name, value) {
        this.sandboxGlobal[name] = value;
    }
    getGlobal(name) {
        return this.sandboxGlobal[name];
    }
    destroy() {
        // 移除作用域化的 rejection 拦截器，避免内存泄漏/干扰宿主
        const proc = globalThis.process;
        if (proc && typeof proc.removeListener === 'function' && this.unhandledRejectionBound) {
            proc.removeListener('unhandledRejection', this.unhandledRejectionBound);
            this.unhandledRejectionBound = null;
        }
        // vm 上下文随 GC 回收
    }
}
/** new Function 后端：适用于 iOS RN（JSC / Hermes），函数参数遮蔽全局 */
export class FunctionSandbox {
    constructor(options) {
        this.runner = null;
        this.logger = options.logger;
        this.sandboxGlobal = createSandboxGlobal(options.handlers);
        this.sandboxGlobal.console = createSandboxConsole(options.logger);
        this.FunctionCtor = Function;
    }
    evaluate(code) {
        // 用函数参数遮蔽 globalThis/self/window/setTimeout/clearTimeout/console，
        // 使脚本内对全局的读写落到沙箱对象上，不影响宿主全局。
        const fn = this.FunctionCtor('globalThis', 'self', 'window', 'setTimeout', 'clearTimeout', 'console', 'Buffer', 'TextEncoder', 'TextDecoder', '"use strict";\n' + code);
        const ret = fn(this.sandboxGlobal, this.sandboxGlobal, this.sandboxGlobal, globalThis.setTimeout, globalThis.clearTimeout, this.sandboxGlobal.console, globalThis.Buffer, globalThis.TextEncoder, globalThis.TextDecoder);
        // 保留最近一次 runner 引用，防止被 GC（避免 setTimeout 回调期间上下文失效）
        this.runner = fn;
        return ret;
    }
    callGlobal(name, ...args) {
        const fn = this.sandboxGlobal[name];
        if (typeof fn !== 'function')
            throw new Error(`Global function "${name}" is not available`);
        return fn(...args);
    }
    setGlobal(name, value) {
        this.sandboxGlobal[name] = value;
    }
    getGlobal(name) {
        return this.sandboxGlobal[name];
    }
    destroy() {
        this.runner = null;
    }
}
/** 自动选择后端：Node 环境优先 vm，其余用 new Function */
export function createSandbox(options) {
    const isNode = typeof process !== 'undefined' && !!process.versions?.node;
    return isNode ? new VMSandbox(options) : new FunctionSandbox(options);
}
