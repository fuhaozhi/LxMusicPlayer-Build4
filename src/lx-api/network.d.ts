/**
 * 网络请求层 —— 对齐 lx-music-mobile `src/core/init/userApi/request.js` 的行为：
 * - 支持 method / headers / body / form / formData / binary
 * - POST 默认 Content-Type: application/json，JSON 序列化 body
 * - form  -> application/x-www-form-urlencoded
 * - formData -> multipart/form-data（RN FormData / Node FormData）
 * - 超时取消（AbortController）
 * - 响应体自动 JSON.parse；binary 模式返回 Uint8Array
 */
import type { HostResponse } from './types.js';
export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    form?: Record<string, string | number>;
    formData?: any;
    binary?: boolean;
    timeout?: number;
    credentials?: string;
    cache?: string;
}
export interface FetchRequestHandle {
    request: Promise<HostResponse>;
    abort: () => void;
}
/**
 * 发起网络请求。与项目内 fetchData 语义一致：
 * - 默认超时 13s（options.timeout 可覆盖）
 * - 返回 Promise<HostResponse>，body 已解析（JSON/文本/Uint8Array）
 * - 附带 abort() 用于取消
 */
export declare function fetchData(url: string, options?: FetchOptions): FetchRequestHandle;
