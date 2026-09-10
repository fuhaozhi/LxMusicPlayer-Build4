/**
 * 音源注册表 —— 来自 https://awaw.cc/post/lx-music-source
 * 仓库：https://github.com/pdone/lx-music-source
 *
 * 每个音源提供原始链接与加速链接（加速仅推荐 GitHub 受限网络使用）。
 */
const RAW = 'https://raw.githubusercontent.com/pdone/lx-music-source/main';
const PROXY = 'https://ghproxy.net/raw.githubusercontent.com/pdone/lx-music-source/main';
export const LX_MUSIC_SOURCES = [
    // 以下为在 iOS（FunctionSandbox/Hermes 兼容层）实测可正常加载的音源。
    // sixyin/flower/lx/grass/juhe 已在实测中被移除：
    //   sixyin — 自带版本校验，拒绝在非官方环境加载
    //   flower — 版本检查服务器（97.64.37.235 / js.org / mirror.com）已停运
    //   lx     — 脚本依赖 babel regeneratorRuntime，沙箱不提供
    //   grass/juhe — 初始化超时（外部服务不可达）
    { id: 'huibq', name: 'Huibq', url: `${RAW}/huibq/latest.js`, acceleratedUrl: `${PROXY}/huibq/latest.js`, note: '酷我/酷狗/腾讯/网易/咪咕 5 源' },
    { id: 'qdy', name: 'QDY 全豆要聚合', url: `${RAW}/qdy/latest.js`, acceleratedUrl: `${PROXY}/qdy/latest.js`, note: '酷我/酷狗/腾讯/网易/咪咕 5 源' },
    { id: 'ikun', name: 'ikun', url: `${RAW}/ikun/latest.js`, acceleratedUrl: `${PROXY}/ikun/latest.js`, note: '酷我/网易 2 源' },
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
