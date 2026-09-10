/**
 * 音源注册表 —— 来自 https://awaw.cc/post/lx-music-source
 * 仓库：https://github.com/pdone/lx-music-source
 *
 * 每个音源提供原始链接与加速链接（加速仅推荐 GitHub 受限网络使用）。
 */
const RAW = 'https://raw.githubusercontent.com/pdone/lx-music-source/main';
const PROXY = 'https://ghproxy.net/raw.githubusercontent.com/pdone/lx-music-source/main';
export const LX_MUSIC_SOURCES = [
    { id: 'sixyin', name: 'SixYin', url: `${RAW}/sixyin/latest.js`, acceleratedUrl: `${PROXY}/sixyin/latest.js` },
    { id: 'huibq', name: 'Huibq', url: `${RAW}/huibq/latest.js`, acceleratedUrl: `${PROXY}/huibq/latest.js` },
    { id: 'flower', name: 'Flower', url: `${RAW}/flower/latest.js`, acceleratedUrl: `${PROXY}/flower/latest.js` },
    { id: 'lx', name: 'LX', url: `${RAW}/lx/latest.js`, acceleratedUrl: `${PROXY}/lx/latest.js` },
    { id: 'ikun', name: 'ikun', url: `${RAW}/ikun/latest.js`, acceleratedUrl: `${PROXY}/ikun/latest.js` },
    { id: 'grass', name: 'Grass', url: `${RAW}/grass/latest.js`, acceleratedUrl: `${PROXY}/grass/latest.js` },
    { id: 'juhe', name: 'JuheApi', url: `${RAW}/juhe/latest.js`, acceleratedUrl: `${PROXY}/juhe/latest.js` },
    { id: 'qdy', name: 'QDY', url: `${RAW}/qdy/latest.js`, acceleratedUrl: `${PROXY}/qdy/latest.js` },
];
/** 其他可用的加速前缀（来自 awaw.cc 页面） */
export const PROXY_PREFIXES = [
    'https://ghproxy.net/',
    'https://gh.llkk.cc/',
    'https://github.moeyy.xyz/',
    'https://ghproxy.cn/',
    'https://gh.api.99988866.xyz/',
    'https://ghp.ci/',
    'https://gh-proxy.org/',
];
/** 替换加速前缀（raw.githubusercontent.com 开头则使用原始链接） */
export function toAcceleratedUrl(url, prefix = PROXY_PREFIXES[0]) {
    const idx = url.indexOf('raw.githubusercontent.com/');
    if (idx === -1)
        return url;
    return prefix + url.substring(idx);
}
/** 按 id 查找音源 */
export function getSourceById(id) {
    return LX_MUSIC_SOURCES.find(item => item.id === id) ?? null;
}
