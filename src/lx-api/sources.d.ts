/**
 * 音源注册表 —— 来自 https://awaw.cc/post/lx-music-source
 * 仓库：https://github.com/pdone/lx-music-source
 *
 * 每个音源提供原始链接与加速链接（加速仅推荐 GitHub 受限网络使用）。
 */
export interface SourceRegistryItem {
    id: string;
    name: string;
    /** 原始链接 */
    url: string;
    /** 加速链接（可替换 https://ghproxy.net/ 前缀） */
    acceleratedUrl: string;
    /** 备注 */
    note?: string;
}
export declare const LX_MUSIC_SOURCES: SourceRegistryItem[];
/** 其他可用的加速前缀（来自 awaw.cc 页面） */
export declare const PROXY_PREFIXES: string[];
/** 替换加速前缀（raw.githubusercontent.com 开头则使用原始链接） */
export declare function toAcceleratedUrl(url: string, prefix?: string): string;
/** 按 id 查找音源 */
export declare function getSourceById(id: string): SourceRegistryItem | null;
