/**
 * 内置音源脚本（聆澜 v8.5 赞助版 + 念心 V1.0.1 + 溯音 v1）
 * - 聆澜：主音源（付费服务器，QQ/酷狗/酷我/网易/咪咕 完整播放）
 * - 念心：QQ/酷狗 免费兜底；溯音：酷我 免费兜底
 * 来源：source.shiqianjiang.cn（用户提供 key）+ github.com/guoyue2010/lxmusic-
 * 集成日期：2026-09-12
 */
export const LUODIAN_SCRIPT = `/*!
 * @name 聆澜音源(赞助版)[过期: 27-09-12 22:00:57]
 * @description 支持所有平台音质以当前密钥开放配置为准
 * @version v8.5
 * @author 时迁酱&guoyue2010
 */
// DEV_ENABLE 只控制 LX Music 是否打开开发者工具；日志由 LOG_ENABLE 单独控制。
const DEV_ENABLE = false;
const LOG_ENABLE = true;
const UPDATE_ENABLE = true;
const API_URL = "https://source.shiqianjiang.cn/api";
const API_KEY = "CERU_KEY-AE5432BA-FD69-420A-8A7C-580DCAB748C2";
const SCRIPT_MD5 = "1071e0320b9a220ed465fb30372c7539";
const MUSIC_QUALITY = {"git":["128k","320k","flac"],"kg":["128k","320k","flac","flac24bit","hires","atmos","master"],"kw":["128k","320k","flac","flac24bit","hires"],"mg":["128k","320k","flac","flac24bit","hires"],"tx":["128k","320k","flac","flac24bit","hires","atmos","atmos_plus","master"],"wy":["128k","320k","flac","flac24bit","hires","atmos","master"]};
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);
const { EVENT_NAMES, request, on, send, env, version } = globalThis.lx;

const LOG_PREFIX = "[聆澜音源(赞助版)[过期: 27-09-12 22:00:57]]";
let requestSequence = 0;

const logInfo = (...args) => {
  if (LOG_ENABLE) console.log(LOG_PREFIX, ...args);
};

const logError = (...args) => {
  console.error(LOG_PREFIX, ...args);
};

// 日志只保留排障所需信息，不暴露 API Key 和临时播放凭据。
const sanitizeUrl = (value) => {
  if (!value) return "";
  return String(value).replace(
    /([?&](?:key|apiKey|vkey|token|sign|mask)=)[^&]*/gi,
    "$1<redacted>",
  );
};

const formatError = (error) => ({
  name: error?.name ?? "Error",
  message: error?.message ?? String(error),
  stack: error?.stack,
});

const summarizeBody = (body) => {
  if (!body || typeof body !== "object") {
    return { bodyType: typeof body, bodyPresent: body != null };
  }
  return {
    code: body.code,
    message: body.message,
    hasUrl: typeof body.url === "string" && body.url.length > 0,
    url: sanitizeUrl(body.url),
    type: body.type,
    server: body.server,
    serverName: body.serverName,
  };
};

// LX Music 使用回调式 request，这里转成 Promise 并统一记录网络耗时。
const httpFetch = (url, options = { method: "GET" }, label = "request") => {
  const startedAt = Date.now();
  logInfo(\`[http:\${label}] 开始\`, {
    method: options.method ?? "GET",
    url: sanitizeUrl(url),
    timeout: options.timeout,
    followMax: options.follow_max,
  });

  return new Promise((resolve, reject) => {
    request(url, options, (error, response) => {
      const elapsedMs = Date.now() - startedAt;
      if (error) {
        logError(\`[http:\${label}] 网络请求失败\`, {
          elapsedMs,
          error: formatError(error),
        });
        reject(error);
        return;
      }
      logInfo(\`[http:\${label}] 请求结束\`, {
        elapsedMs,
        statusCode: response?.statusCode ?? response?.status,
        bodyType: typeof response?.body,
      });
      resolve(response);
    });
  });
};

// 不同 LX 版本可能返回 JSON 字符串或已反序列化对象，两种都兼容。
const parseResponseBody = (body) => {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(\`响应不是有效 JSON: \${error.message}\`);
  }
};

const handleGetMusicUrl = async (source, musicInfo, quality) => {
  const requestId = \`\${Date.now()}-\${++requestSequence}\`;
  const startedAt = Date.now();
  const songId = musicInfo?.hash ?? musicInfo?.songmid ?? musicInfo?.id;

  logInfo(\`[request:\${requestId}] 收到音乐链接请求\`, {
    source,
    songId,
    quality,
    musicInfoKeys: musicInfo ? Object.keys(musicInfo) : [],
  });

  try {
    if (!MUSIC_QUALITY[source]) throw new Error(\`不支持的音源: \${source}\`);
    if (!songId) throw new Error("音乐 ID 不存在");

    const requestUrl = \`\${API_URL}/music/url?source=\${encodeURIComponent(source)}&songId=\${encodeURIComponent(songId)}&quality=\${encodeURIComponent(quality)}\`;
    const headers = {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "User-Agent": env
        ? \`lx-music-\${env}/\${version}\`
        : \`lx-music-request/\${version}\`,
    };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    logInfo(\`[request:\${requestId}] 请求服务端\`, {
      url: requestUrl,
      hasApiKey: Boolean(API_KEY),
      userAgent: headers["User-Agent"],
    });

    const response = await httpFetch(
      requestUrl,
      { method: "GET", headers, follow_max: 5, timeout: 15000 },
      requestId,
    );
    const statusCode = response?.statusCode ?? response?.status;
    const body = parseResponseBody(response?.body);
    const code = Number(body?.code);

    logInfo(\`[request:\${requestId}] 服务端响应\`, {
      statusCode,
      elapsedMs: Date.now() - startedAt,
      ...summarizeBody(body),
    });

    if (!body || Number.isNaN(code)) {
      throw new Error("服务端响应缺少有效业务码");
    }
    if (statusCode != null && Number(statusCode) !== 200) {
      throw new Error(body.message ?? \`HTTP 请求失败: \${statusCode}\`);
    }

    // Go 服务统一返回 200；保留 code=0 兼容，避免旧通道成功响应被误判。
    if (code === 0 || code === 200) {
      if (!body.url) {
        throw new Error("服务端返回成功，但响应中没有音乐链接");
      }
      logInfo(\`[request:\${requestId}] 获取音乐链接成功\`, {
        source,
        songId,
        quality,
        elapsedMs: Date.now() - startedAt,
        url: sanitizeUrl(body.url),
      });
      return body.url;
    }

    switch (code) {
      case 403:
        throw new Error("权限不足或 Key 失效");
      case 429:
        throw new Error("请求过速，请稍后再试");
      default:
        throw new Error(body.message ?? \`服务端错误: \${code}\`);
    }
  } catch (error) {
    logError(\`[request:\${requestId}] 获取音乐链接失败\`, {
      source,
      songId,
      quality,
      elapsedMs: Date.now() - startedAt,
      error: formatError(error),
    });
    throw new Error(error?.message ?? String(error));
  }
};

// 更新 URL 含 API Key，日志必须经过 sanitizeUrl 脱敏。
const checkUpdate = async () => {
  const startedAt = Date.now();
  
  const requestId = \`lx-update-\${Date.now()}-\${++requestSequence}\`;
  const updateUrl = \`\${API_URL.replace("/music", "")}/script?checkUpdate=\${encodeURIComponent(SCRIPT_MD5)}&key=\${encodeURIComponent(API_KEY)}&type=lx\`;
  logInfo(\`[update:\${requestId}] 开始检查更新\`, {
    url: sanitizeUrl(updateUrl),
  });

  try {
    const response = await httpFetch(
      updateUrl,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "User-Agent": env
            ? \`lx-music-\${env}/\${version}\`
            : \`lx-music-request/\${version}\`,
        },
        timeout: 15000,
      },
      "update",
    );
    const body = parseResponseBody(response?.body);
    logInfo(\`[update:\${requestId}] 检查完成\`, {
      elapsedMs: Date.now() - startedAt,
      statusCode: response?.statusCode ?? response?.status,
      code: body?.code,
      hasUpdate: Boolean(body?.data),
      message: body?.message,
    });

    if (body?.data) {
      send(EVENT_NAMES.updateAlert, {
        log: body.data.updateMsg,
        updateUrl: body.data.updateUrl,
      });
    }
  } catch (error) {
    logError(\`[update:\${requestId}] 检查失败\`, {
      elapsedMs: Date.now() - startedAt,
      error: formatError(error),
    });
  }
};

// 按服务端下发的音质能力动态注册 LX Music 音源。
const musicSources = {};
MUSIC_SOURCE.forEach((source) => {
  musicSources[source] = {
    name: source,
    type: "music",
    actions: ["musicUrl"],
    qualitys: MUSIC_QUALITY[source],
  };
});

on(EVENT_NAMES.request, ({ action, source, info }) => {
  logInfo("[event] 收到 LX Music 事件", {
    action,
    source,
    quality: info?.type,
    hasMusicInfo: Boolean(info?.musicInfo),
  });

  if (action === "musicUrl") {
    return handleGetMusicUrl(source, info?.musicInfo, info?.type);
  }
  logError("[event] 不支持的操作", { action, source });
  return Promise.reject(new Error(\`action not supported: \${action}\`));
});

logInfo("[init] 插件初始化", {
  version: "v8.5",
  lxVersion: version,
  env,
  apiUrl: API_URL,
  updateEnabled: UPDATE_ENABLE,
  sources: MUSIC_SOURCE,
  qualitys: MUSIC_QUALITY,
});

if (UPDATE_ENABLE) checkUpdate();

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: DEV_ENABLE,
  sources: musicSources,
});

logInfo("[init] 插件已就绪", { sourceCount: MUSIC_SOURCE.length });
`;
export const NIANXIN_SCRIPT = `/**
 * @name 念心音源
 * @description 音源更新，关注微信公众号: 念心小站
 * @version 1.0.1
 * @author 念心小站
 * @update_url https://gitee.com/nianxinxz1/emo-music/raw/master/wubian.json
 */
const _0x1cb06b=_0x4a54,_0x1df937=_0x33fc;(function(_0x3696f9,_0x24bb15){const _0x20e63b=_0x33fc,_0xa0065a=_0x4a54,_0x1489d7=_0x3696f9();while(!![]){try{const _0x4b81e0=-parseInt(_0xa0065a(0x28c))/0x1*(-parseInt(_0xa0065a(0x1b1))/0x2)+-parseInt(_0x20e63b(0x251,'EBiS'))/0x3*(-parseInt(_0x20e63b(0x23a,')53a'))/0x4)+-parseInt(_0x20e63b(0x1b3,'^*5H'))/0x5+-parseInt(_0xa0065a(0x287))/0x6+parseInt(_0x20e63b(0x24b,'VX%#'))/0x7+parseInt(_0x20e63b(0x21e,'nfO&'))/0x8*(parseInt(_0xa0065a(0x2b6))/0x9)+parseInt(_0x20e63b(0x255,')53a'))/0xa*(-parseInt(_0xa0065a(0x264))/0xb);if(_0x4b81e0===_0x24bb15)break;else _0x1489d7['push'](_0x1489d7['shift']());}catch(_0x2c07f7){_0x1489d7['push'](_0x1489d7['shift']());}}}(_0x5d1c,0x32089));function _0x4a54(_0x215fcf,_0x50bca0){_0x215fcf=_0x215fcf-0x1a0;const _0x5d1cd6=_0x5d1c();let _0x4a5420=_0x5d1cd6[_0x215fcf];if(_0x4a54['DYSTtI']===undefined){var _0x1d011a=function(_0x12e00f){const _0x27ac17='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let _0x33fcc4='',_0x26f066='';for(let _0x3b1a66=0x0,_0x505b8b,_0x3f03dd,_0x149808=0x0;_0x3f03dd=_0x12e00f['charAt'](_0x149808++);~_0x3f03dd&&(_0x505b8b=_0x3b1a66%0x4?_0x505b8b*0x40+_0x3f03dd:_0x3f03dd,_0x3b1a66++%0x4)?_0x33fcc4+=String['fromCharCode'](0xff&_0x505b8b>>(-0x2*_0x3b1a66&0x6)):0x0){_0x3f03dd=_0x27ac17['indexOf'](_0x3f03dd);}for(let _0x2741f1=0x0,_0x59f45f=_0x33fcc4['length'];_0x2741f1<_0x59f45f;_0x2741f1++){_0x26f066+='%'+('00'+_0x33fcc4['charCodeAt'](_0x2741f1)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x26f066);};_0x4a54['JwxfWU']=_0x1d011a,_0x4a54['eiyVwr']={},_0x4a54['DYSTtI']=!![];}const _0x23d670=_0x5d1cd6[0x0],_0x46ed44=_0x215fcf+_0x23d670,_0x151c33=_0x4a54['eiyVwr'][_0x46ed44];return!_0x151c33?(_0x4a5420=_0x4a54['JwxfWU'](_0x4a5420),_0x4a54['eiyVwr'][_0x46ed44]=_0x4a5420):_0x4a5420=_0x151c33,_0x4a5420;}const {EVENT_NAMES,request,on,send}=globalThis['lx'],CURRENT_VERSION=_0x1df937(0x1e5,'v([]'),VERSION_CHECK_URL=_0x1df937(0x2bc,'hwJV'),_0x281199={};_0x281199[_0x1df937(0x1c1,'EBiS')]=_0x1df937(0x20f,'u#X^'),_0x281199[_0x1cb06b(0x1d7)]=_0x1df937(0x288,'qz^p'),_0x281199[_0x1df937(0x24a,'6IQ]')]=_0x1cb06b(0x29b),_0x281199[_0x1df937(0x2a5,'BH7#')]=_0x1cb06b(0x29f),_0x281199[_0x1cb06b(0x240)]=_0x1df937(0x289,'rb1Q');function _0x5d1c(){const _0x557409=['t3D6wvu','aNFdRbvJpa','5B+q5yUB5Bs+5PI35P695PAl54Uf5P+MW7pMRRxLUj7LIBhLPAlLJ5S','zCkeECknFa','iHyUWQBcQq','txDNrvC','EvnIALu','W7TFWPhcJr4','lSk5WPDtW5u','6k+35PU05PAW5zco5l2/55sO','zN51na','y8oiWR/cImkVqSocW7NdPsX+','WPzeW6NdVcC','rfrLq3a','C3rHBMrHCMq','v2XAtwG','jMXLDMvSpq','W7pcOCkMlHu','wLrwA0m','Bmo9W7JcMKa','mmkCv8kkf0JcVxBdOK/cTG','emkPlmoxD8kgsmowfW','DhLWzq','A8kqlSohqW','mtaWndqWmNHOrLL2zq','fgddQHTPprq','W73cISk2nG','WQhcU8oJt1VcTq3cI0m','sfHMq3q','ALPiyLa','W6RcLIlcKSo9','hmkQlCoDDq','uuHwAMG','WPu8WRpcKJL2h3DO','B1nRrLy','uujKBhK','sIznWO/cSW','ALv5C3q','B0r0Cvy','W5ipW4uwfmoih8kUW4e','BxvZAwm','DMvYC2LVBG','yxHRANG','CCoFW7JcON8','dCkYW70Lyq','yxrTB3m','amosW6/dP8kh','z0rgwgC','WPLaW78','w2xdJ8k+sa','W5ldGabJkq','ANLTyxn0zxi','Bwf4','AMfoDLO','BvjyCgi','W6pcNdKO','rePeW5/dTCoBW5aYWOiurCopW4W','W6NdMcXTaa','BKzVAxG','vcNdS8kznq','W43dQIXGdCk1WQWjhW','cepdIcPE','CSoDchibFM9otCoN','5B2Q5yMm5Bwk5PM45PYs5Pwf54Ms5P2zW5tMRyhLU7lLIP3LP7RLJ5q','vmo2W7ZcHKy','5PQ25Pwn5ywM5A6lWO0j','W50kWOqGaCoPfSk9','sw15v0C','ugXrqwS','W6lcLZFcNSoE','dtOYg8oA','aSkqFSkCpW','WPmRW7RcVG','tNHTzg4','uwz2v0u','W5NcRctcNSol','BSoLWQ7dK18','W4/dHLhdJmod','kcbYWRyG','BwFPN7pKUza','yhFdOqf/','ndaXmJaZsNzWAxfM','f3tcQSoC','nq7PNO/KUje','s3DKEgq','amkFW7mZiSkOf8opa8kbWOJcPCoPleira1RdJmkjnGvpW7H/WQ/dOCoDvmkRW4pcPSkprCoBiCkyuJChW7JcGmoNW5/cVNyS','sezRtuO','yvFdVGqj','W4NcJmkioI0','W6xcImofWPO','r8oKDSopwmkl','DgHLBG','D1ffyve','WR/dQmk5WQzS','BgPhzw0','gSk5W6FdV8oo','CgPzwgm','kSkjWPDcWO0gWQGGW4/cOmkQW7eQyqdcL2RdJ8k/W5xdTSoWWPJcUSoVW7RdQ3ldNCoqdSoyBNhdLCklW7BdLhm+u1lcNHVdMh/cPa','svv6t2W','C1zYz1a','sWRdVCkXhG','W57cOCk+asa','5y6/54Y85PAL54If5PYYW63PN6NOPzBMMAFML6/cJoIgN+AEM+wWPEs7T+s8VEwkUUwLMUwmIxm','mX7PNO/KUje','W7FcJmkGkGq','se5xsuC','u1tdGsrM','BmklsJ5bW58KWOPZomkn','qr/dOmorsG','ANLLzMzLy3q','W5tdSUMFRUs7IG','DxbKyxrLvxjS','Aw5PDgvK','eCkUlSon','Bg9N','tSkFW74ZFCk6vCosuW','mtq3mJe3ofvyBxfdsa','preukmoWbG','uatdPmkqpW','uuDSDgC','qcpdQCouqCoeq8oduGpcGG','mxLmBM1yAq','C29Uz21Pza','ndm3mwrTzKfnua','ud/dQSos','B0XmvLO','kWVdUaJdSSkEuq','ESkHAc5r','W7BcHdKLW7VcRfpcKq','hCo1EqnA','pCkWxq','BCoQW5JcUMe','g8o8CsXQWQtcVmkLW78','cSk9aG','AgzAzva','AmkGDSkgAq','Bg9ZC2XLC3m','C3rHDhvZtwvZC2fNzq','W6NcNZ8','pmo36z245lUB','BwfZDgvY','Ber0ywi','nqZdVaKDW5D9da','q3JdOYmP','WQZdQ8kDW5C','n8k/kSoWyq','WRlcQWpdV2/cVG','zvL6zNK','5y+k54+U5PA054QT5P+7W4pPNQpOPBJMMitMLQJdOEIhQUAFVEwZHUs6RUs+UEwiLowNKownHZK','dcKwWOhcLa','kSkuWPfxW4q','jCoGucXv','z056q1q','W5xdJLZdLmop','5QgW5PYN5PQh5Pwm5AAO6lsMia','mCksWO1vW5PaW6m','EM5yzfq','zfHkCMK','y2TXAxC','n8oHW73dUwjmg3tdOb9t','C3LStKq','WPrdW53dPJK','qCo3B8opsa','mJuYCuHLthbN','rSoaW4xcVLu','pCkWsCk/WRBcGxNdOa','wg1Mrw0','DxnUB04','tJ/dV8orvCoiumod','W4JdVMNdQSoQcCozeaJdJmoIWRKaW4S9W4WbtmkHW7/cVa48WOJcPv7cISoRmCoCy8oxxqJdPqxcTKBcU2pcRmkfW60OWRj0DCkfd8kkbmkCWQ9zW7/dSmkfcuekW60','Aw3cPCkxW6K','hCoJEYPZWQJcJq','zLn1ANC','qurStLC','s0LYyuq','rYnNWQBdKXFdNG','zNjhsxO','W4tcTdqfW4G','uwDhug4','WRlcPmo0CW','r0vu','yuDlshO','mdqTnSorW7y','scNdVq','vhtdIZ5X','oduYuNzIr0rR','CgzPz0S','mHHHWRuc','jmoPxt99','W5tdTs8','vMLADvO','WOzPWRODlq','dgJPNBFKUkW','wfnXsNa','W5tcPWdcN8oRAMOsW4GuWPW','qCkOxXvf','D0ZdQWWkW7fMkCky','WOldK8kNWOrc','BxvZAwnjBMzV','uhngtxG','W7hdIhNdTSoG','BxvZAwnvCMW','kqfvWPNdSq','W4XwWPiYb8ogzq','tHtdISoarq','CMDYB0y','fwRdTqLHjWq','y2f0y2G','DhJPN7pKUza','W7FcKCkMp03cNCofW7TcWRZcPmoRW6ddH2xcOY5ybXZcTs/cJ8oau8oBfL1+qMG1ftfXW5ZcQhFdNWatWQnOW4bvcmom','DxbKyxrLqwXLCNq','AgLYzxm','WQFdJSkCWOvTW7ZdLs/dJCkF','FG3dGmkCcW','xmkYDJPn','W6hcHSorW6xdRa','ntGYnJq0BwfcC0Hl','6k+v5PMO5PAU5zkO5l2a55El','e8kQj8kvb8ounmo8mSonuqnH','W6hcP8olW6pdUSkS','q3HRC0i','Ahr0CdOVl21JCc5UAwfUEgLUEhOUy29Tl3nOyxjLl2nLC2HPl2TNlNbOCd9Pzd0','zmogWQddKh4','5Qoa5P+L5PU05PAW5yE66zszloATO+w4UowiNEwNI+wmLJO','W5RcOZ3cISod','zvLpDM0','FH0fmCoYu0JdOIO','mty5mZG3mfPcAwj2Da','WPtcGWldQK4','mti4AW','E8ozWR/dIMzlW5tdSa','W5hcTH7cK8oQ','D8oCbYG','WQpcHce7W7RdSeZcHvy','W4FcSCkCoIu','Ahr0CdOVl21JCc5UAwfUEgLUEhOUy29Tl3nOyxjLl2nLC2HPl21NlNbOCd9Pzd0','E8kP6z+Z5lQU','W53dOIbOhSk4','ua/dTCkqhW','a8km6z205lIt','WR13W77dLIq','scpdTmoqr8of','tu5YrLu','z0fnwey','hYa8WONcKq','W7NcPHxdVw/cOd0','i2SWW5ZdOCkfW6lcVSk/ESkV','u1pdQcbK','W7NcVGNdU2/dSw1wW6K','l8kiWPbBW5q','WR95W5FdJsO','5PU05PAW5yAf5A65oIa','pGuDiG','eYaoimot','mZiWAW','W5ZcRrq','ug5szfe','fCkRcCoFva','Ahr0CdOVl21JCc5UAwfUEgLUEhOUy29Tl3nOyxjLl2nLC2HPl3r4lNbOCd9Pzd0','aSoiysX8','zwzhALu','DbPWWPtcGq','DM1PvMi','W6lcJSoPW5ldLa','WRZdM8koWPK','q1nLrLm','y1PgCwq','zMXHyW','W4LNW7ddLwS','zmk26z+Z5lQU','rM5Hww4','pCo/W6W','z2jowxG','WP4tWORcLSobe3VdGW','sePYEeu','jNr5Cgu9BxaZ','W6JcI8oUtMG','r3zJrfi','yNPtBva','AgfZAa','xcldNmkokq','W6LUWQBcRry','WQFcSWLU','W43dQ20','odK2nSovW4VcRZy','5y+r546W5PAW54Mi5PYSihy','WOdcQSo5FZe','6kEJ5P6q54Mi5PYS5l+H5OgV5AsX6lsLoG','whrLrLK','zfPotNO','iYK3lmoFW7hcSW','cbFdKcldPW','D29lCxC','W6f7WPdcTXy','WOXwWPyN','W6VcRSoeW6C','ESoxWRW','A3FPN7pKUza','zfrQswm','ALjqD3y','lmkEW4eiDa','C8kPFIHd','WPHAW6VdVdnjW7xdKW','DKxdVXPb','eLxdGSk/E0/cMmoOWOG','C3bSAxq','zgvZy3jPChrPB24','y0jhrLO','D8o9W53cGebS','rMf0EeS','eJTJWR7dKHRcKrm','D3NPN7pKUza','BcFPN7FKURu','wb7dOmklkxu'];_0x5d1c=function(){return _0x557409;};return _0x5d1c();}const _0x586e9d={};_0x586e9d[_0x1df937(0x26c,'cB0I')]=_0x1df937(0x293,'6IQ]'),_0x586e9d[_0x1df937(0x265,'%7jm')]=_0x1df937(0x1c6,'kk2^'),_0x586e9d[_0x1df937(0x1d5,'qz^p')]=_0x1df937(0x2b8,'ZD@X'),_0x586e9d[_0x1cb06b(0x1ac)]=_0x1df937(0x2a9,'9rSY'),_0x586e9d[_0x1cb06b(0x29f)]=_0x1cb06b(0x29f),_0x586e9d[_0x1df937(0x1c0,'tgcD')]=_0x1cb06b(0x240);const _0x14e9ec={};_0x14e9ec[_0x1cb06b(0x1be)]=_0x1df937(0x1ea,'vuOP'),_0x14e9ec[_0x1df937(0x1f3,'C*@r')]=_0x1df937(0x2c9,'^t17'),_0x14e9ec[_0x1df937(0x2a3,'NDAA')]=_0x1cb06b(0x29b),_0x14e9ec[_0x1cb06b(0x1ac)]=_0x1df937(0x27b,'@0Tb'),_0x14e9ec[_0x1cb06b(0x280)]=_0x1df937(0x2bb,'%7jm'),_0x14e9ec[_0x1cb06b(0x246)]=_0x1cb06b(0x246);const _0x40b92d={};_0x40b92d[_0x1df937(0x2c6,'Esz!')]=_0x1cb06b(0x221),_0x40b92d[_0x1df937(0x284,'^*5H')]=_0x1df937(0x214,'TPG7'),_0x40b92d[_0x1cb06b(0x1e4)]=_0x1df937(0x1bf,'rkgL');const _0x2c8791={};_0x2c8791[_0x1cb06b(0x1be)]=_0x1cb06b(0x221),_0x2c8791[_0x1cb06b(0x1d7)]=_0x1df937(0x26d,'^*5H'),_0x2c8791[_0x1df937(0x200,'6xR2')]=_0x1cb06b(0x29b);const _0x2f9a8a={};_0x2f9a8a['kg']=_0x281199,_0x2f9a8a['tx']=_0x586e9d,_0x2f9a8a['wy']=_0x14e9ec,_0x2f9a8a['kw']=_0x40b92d,_0x2f9a8a['mg']=_0x2c8791;function _0x33fc(_0x215fcf,_0x50bca0){_0x215fcf=_0x215fcf-0x1a0;const _0x5d1cd6=_0x5d1c();let _0x4a5420=_0x5d1cd6[_0x215fcf];if(_0x33fc['UkDsrQ']===undefined){var _0x1d011a=function(_0x27ac17){const _0x33fcc4='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let _0x26f066='',_0x3b1a66='';for(let _0x505b8b=0x0,_0x3f03dd,_0x149808,_0x2741f1=0x0;_0x149808=_0x27ac17['charAt'](_0x2741f1++);~_0x149808&&(_0x3f03dd=_0x505b8b%0x4?_0x3f03dd*0x40+_0x149808:_0x149808,_0x505b8b++%0x4)?_0x26f066+=String['fromCharCode'](0xff&_0x3f03dd>>(-0x2*_0x505b8b&0x6)):0x0){_0x149808=_0x33fcc4['indexOf'](_0x149808);}for(let _0x59f45f=0x0,_0x112189=_0x26f066['length'];_0x59f45f<_0x112189;_0x59f45f++){_0x3b1a66+='%'+('00'+_0x26f066['charCodeAt'](_0x59f45f)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x3b1a66);};const _0x12e00f=function(_0x1938a0,_0x23551f){let _0x1e23e5=[],_0x347b78=0x0,_0x23e297,_0x56669e='';_0x1938a0=_0x1d011a(_0x1938a0);let _0x3b0865;for(_0x3b0865=0x0;_0x3b0865<0x100;_0x3b0865++){_0x1e23e5[_0x3b0865]=_0x3b0865;}for(_0x3b0865=0x0;_0x3b0865<0x100;_0x3b0865++){_0x347b78=(_0x347b78+_0x1e23e5[_0x3b0865]+_0x23551f['charCodeAt'](_0x3b0865%_0x23551f['length']))%0x100,_0x23e297=_0x1e23e5[_0x3b0865],_0x1e23e5[_0x3b0865]=_0x1e23e5[_0x347b78],_0x1e23e5[_0x347b78]=_0x23e297;}_0x3b0865=0x0,_0x347b78=0x0;for(let _0x44fc11=0x0;_0x44fc11<_0x1938a0['length'];_0x44fc11++){_0x3b0865=(_0x3b0865+0x1)%0x100,_0x347b78=(_0x347b78+_0x1e23e5[_0x3b0865])%0x100,_0x23e297=_0x1e23e5[_0x3b0865],_0x1e23e5[_0x3b0865]=_0x1e23e5[_0x347b78],_0x1e23e5[_0x347b78]=_0x23e297,_0x56669e+=String['fromCharCode'](_0x1938a0['charCodeAt'](_0x44fc11)^_0x1e23e5[(_0x1e23e5[_0x3b0865]+_0x1e23e5[_0x347b78])%0x100]);}return _0x56669e;};_0x33fc['zmKAvp']=_0x12e00f,_0x33fc['AgmTbb']={},_0x33fc['UkDsrQ']=!![];}const _0x23d670=_0x5d1cd6[0x0],_0x46ed44=_0x215fcf+_0x23d670,_0x151c33=_0x33fc['AgmTbb'][_0x46ed44];return!_0x151c33?(_0x33fc['FomRrN']===undefined&&(_0x33fc['FomRrN']=!![]),_0x4a5420=_0x33fc['zmKAvp'](_0x4a5420,_0x50bca0),_0x33fc['AgmTbb'][_0x46ed44]=_0x4a5420):_0x4a5420=_0x151c33,_0x4a5420;}const qualitys=_0x2f9a8a,apis={'kg':{'musicUrl'(_0x2a9b7c,_0x3034f6){const _0x24bd8e=_0x1cb06b,_0x4de115=_0x1df937,_0x5ec48={'PlQAk':function(_0x5c51ae,_0x2081de){return _0x5c51ae(_0x2081de);}};let _0x2f1501='';const _0x49d580=_0x2a9b7c[_0x4de115(0x1e1,'cB0I')];return console[_0x24bd8e(0x285)](_0x3034f6,_0x49d580),_0x2f1501=_0x24bd8e(0x1b6)+_0x49d580+_0x4de115(0x2c2,'u#X^')+_0x3034f6+_0x4de115(0x1bb,'qz^p'),new Promise(_0x12afd5=>{const _0x3c7133=_0x24bd8e;_0x5ec48[_0x3c7133(0x257)](_0x12afd5,_0x2f1501);});}},'tx':{'musicUrl'(_0x570013,_0x143283){const _0xe269b9=_0x1cb06b,_0x25574f=_0x1df937,_0x39a9e5={'gDFXg':function(_0x334b7d,_0x309b52){return _0x334b7d(_0x309b52);}};let _0x545785='';const _0x3a0b9f=_0x570013[_0x25574f(0x22c,'TPG7')];return console[_0xe269b9(0x285)](_0x143283,_0x3a0b9f),_0x545785=_0xe269b9(0x1db)+_0x3a0b9f+_0xe269b9(0x223)+_0x143283+_0x25574f(0x1c2,'6IQ]'),new Promise(_0x3a0703=>{const _0x1f3f2d=_0xe269b9;_0x39a9e5[_0x1f3f2d(0x242)](_0x3a0703,_0x545785);});}},'wy':{'musicUrl'(_0x337e12,_0x68ec94){const _0x44f488=_0x1df937,_0x5ae59a=_0x1cb06b,_0x2eaaaa={'CxksB':function(_0x52fd29,_0x2ec24f){return _0x52fd29(_0x2ec24f);}};let _0xe28d70='';const _0x3e584d=_0x337e12[_0x5ae59a(0x28d)];return console[_0x5ae59a(0x285)](_0x68ec94,_0x3e584d),_0xe28d70=_0x44f488(0x274,'9rSY')+_0x3e584d+_0x5ae59a(0x223)+_0x68ec94+_0x44f488(0x22e,'2Tv^'),new Promise(_0x2ca1cb=>{const _0x1710a8=_0x5ae59a;_0x2eaaaa[_0x1710a8(0x1b5)](_0x2ca1cb,_0xe28d70);});}},'kw':{'musicUrl'(_0x533699,_0x1a0b62){const _0x8c16b7=_0x1cb06b,_0x143e90=_0x1df937,_0x1e81cd={'RUDbG':function(_0x5e07f4,_0x176981){return _0x5e07f4(_0x176981);}};let _0x1a4898='';const _0x261ec5=_0x533699[_0x143e90(0x2be,')3Po')];return console[_0x8c16b7(0x285)](_0x1a0b62,_0x261ec5),_0x1a4898=_0x143e90(0x268,'r9sd')+_0x261ec5+_0x8c16b7(0x223)+_0x1a0b62+_0x8c16b7(0x1ec),new Promise(_0x491f3c=>{const _0x321bbb=_0x143e90;_0x1e81cd[_0x321bbb(0x258,'tgcD')](_0x491f3c,_0x1a4898);});}},'mg':{'musicUrl'(_0x7ee26,_0x922b66){const _0x3876ff=_0x1cb06b,_0x56a276=_0x1df937,_0x32a609={'mkCqD':function(_0x3becd6,_0x120bbd){return _0x3becd6(_0x120bbd);}};let _0x595a92='';const _0xba25fa=_0x7ee26[_0x56a276(0x291,'Kvub')];return console[_0x3876ff(0x285)](_0x922b66,_0xba25fa),_0x595a92=_0x3876ff(0x1c4)+_0xba25fa+_0x56a276(0x1ce,'BH7#')+_0x922b66+_0x56a276(0x1d1,'BH7#'),new Promise(_0x29aa1b=>{const _0x108353=_0x56a276;_0x32a609[_0x108353(0x22a,'W2cP')](_0x29aa1b,_0x595a92);});}}},compareVersions=(_0x1c63a9,_0x9cfd3c)=>{const _0x218beb=_0x1df937,_0x8e27ae=_0x1cb06b,_0x45ee79={};_0x45ee79[_0x8e27ae(0x23d)]=function(_0x35f236,_0x5c5dad){return _0x35f236<_0x5c5dad;},_0x45ee79[_0x8e27ae(0x20c)]=function(_0x399141,_0x320597){return _0x399141>_0x320597;},_0x45ee79[_0x8e27ae(0x225)]=function(_0x1e2bed,_0x6a2d1f){return _0x1e2bed<_0x6a2d1f;};const _0x30087a=_0x45ee79,_0x2f6253=_0x1c63a9[_0x8e27ae(0x20a)]('.')[_0x218beb(0x1f4,'hwJV')](Number),_0x2a90c5=_0x9cfd3c[_0x218beb(0x1b7,'rkgL')]('.')[_0x218beb(0x201,'rkgL')](Number);for(let _0x466453=0x0;_0x30087a[_0x8e27ae(0x23d)](_0x466453,Math[_0x8e27ae(0x247)](_0x2f6253[_0x218beb(0x1ca,'%7jm')],_0x2a90c5[_0x218beb(0x1b4,'6xR2')]));_0x466453++){const _0x4fc18f=_0x2f6253[_0x466453]||0x0,_0x231644=_0x2a90c5[_0x466453]||0x0;if(_0x30087a[_0x8e27ae(0x20c)](_0x4fc18f,_0x231644))return 0x1;if(_0x30087a[_0x218beb(0x1ae,'[0@9')](_0x4fc18f,_0x231644))return-0x1;}return 0x0;},checkUpdate=async()=>{const _0x5cba70=_0x1cb06b,_0x1a8bd3=_0x1df937,_0x1b9637={'ljGem':function(_0x463b1c,_0x4debe9){return _0x463b1c+_0x4debe9;},'dTjIc':function(_0x3d8e3c,_0x3cf95c){return _0x3d8e3c+_0x3cf95c;},'UmjDo':_0x1a8bd3(0x254,'9rSY'),'XteFY':function(_0x2094dc,_0x4951f8,_0x33ceb4){return _0x2094dc(_0x4951f8,_0x33ceb4);},'MNrFU':_0x1a8bd3(0x2a7,'RFYd'),'KlEaK':_0x1a8bd3(0x252,'@^&F'),'ImyWG':_0x1a8bd3(0x2d3,'TPG7'),'QgGPn':_0x1a8bd3(0x2cb,'@^&F'),'lSMYO':_0x5cba70(0x1a2),'HJrxE':_0x5cba70(0x1be),'bzSmP':_0x5cba70(0x1d7),'HFkMJ':_0x1a8bd3(0x1ff,')53a'),'MwgEW':_0x5cba70(0x1a9),'CbRbd':_0x1a8bd3(0x211,'RFYd'),'ZTQnd':_0x5cba70(0x202),'rnLne':_0x1a8bd3(0x29e,'ov5a'),'EIXex':function(_0xeae2d4,_0x541267){return _0xeae2d4(_0x541267);},'woKqw':function(_0x488ff9,_0x1d9ff1){return _0x488ff9!==_0x1d9ff1;},'QmOaq':function(_0x54b0e2,_0x587504){return _0x54b0e2===_0x587504;},'FatxK':_0x5cba70(0x2ba),'kRDWt':_0x1a8bd3(0x25e,'tgcD'),'tVcgW':_0x1a8bd3(0x2ad,'tgcD'),'alEsi':_0x1a8bd3(0x21a,'Mj[o'),'gAMXF':function(_0x32b15b,_0x2fb711){return _0x32b15b<_0x2fb711;},'GvcDR':_0x1a8bd3(0x237,'RFYd'),'nFoix':_0x5cba70(0x1f8),'hfZeP':function(_0x5eb762,_0x28ddc1,_0x28560f,_0x11d278){return _0x5eb762(_0x28ddc1,_0x28560f,_0x11d278);},'QfvWE':_0x5cba70(0x2c7)};return new Promise((_0x103af9,_0x2c9f66)=>{const _0x2172bf=_0x5cba70,_0x163ff2=_0x1a8bd3,_0x2653f6={'sVrgP':function(_0x58506d,_0x36769a){const _0xd3d8e6=_0x4a54;return _0x1b9637[_0xd3d8e6(0x271)](_0x58506d,_0x36769a);},'CSeFS':function(_0x1b9ef0,_0x48da62){const _0x4c5123=_0x4a54;return _0x1b9637[_0x4c5123(0x203)](_0x1b9ef0,_0x48da62);},'pjYXc':_0x1b9637[_0x163ff2(0x1f7,'Mafd')],'jZHbP':function(_0x79253e,_0x23e11b,_0x46a793){const _0x5bd837=_0x4a54;return _0x1b9637[_0x5bd837(0x1f9)](_0x79253e,_0x23e11b,_0x46a793);},'znXdT':_0x1b9637[_0x2172bf(0x1cb)],'mRXpb':_0x1b9637[_0x163ff2(0x2aa,')3Po')],'DuFKl':_0x1b9637[_0x2172bf(0x256)],'ViZuZ':_0x1b9637[_0x2172bf(0x2c5)],'jUyst':_0x1b9637[_0x163ff2(0x2d2,')53a')],'lDtab':_0x1b9637[_0x2172bf(0x1eb)],'ySbjU':_0x1b9637[_0x2172bf(0x1ef)],'jRPwv':_0x1b9637[_0x2172bf(0x269)],'YvYVm':_0x1b9637[_0x2172bf(0x218)],'rgroF':_0x1b9637[_0x163ff2(0x1fe,'Mj[o')],'gqvxa':_0x1b9637[_0x163ff2(0x231,'tgcD')],'OwzYU':_0x1b9637[_0x163ff2(0x226,'T7O5')],'XSqJp':function(_0x6801e6,_0x119671){const _0x13d3e8=_0x163ff2;return _0x1b9637[_0x13d3e8(0x2bd,'(ZVF')](_0x6801e6,_0x119671);},'JeHrc':function(_0x12f050,_0x4027b4){const _0xd1eb47=_0x2172bf;return _0x1b9637[_0xd1eb47(0x1fd)](_0x12f050,_0x4027b4);},'jaNvZ':function(_0x385456,_0x25a962){const _0x1e0432=_0x163ff2;return _0x1b9637[_0x1e0432(0x2a4,'0JmL')](_0x385456,_0x25a962);},'PnRdQ':_0x1b9637[_0x2172bf(0x20e)],'zxHLe':_0x1b9637[_0x163ff2(0x270,'cB0I')],'fSujw':_0x1b9637[_0x163ff2(0x1c7,'[0@9')],'WlZMh':_0x1b9637[_0x163ff2(0x2b4,'fgLo')],'QGltg':function(_0x32d40c,_0x184820){const _0x2ca2d8=_0x2172bf;return _0x1b9637[_0x2ca2d8(0x1cc)](_0x32d40c,_0x184820);},'XmfEm':_0x1b9637[_0x2172bf(0x1ee)],'dXJri':_0x1b9637[_0x2172bf(0x24d)],'vmiVb':function(_0x9af6b2,_0x2821fc){const _0x407165=_0x163ff2;return _0x1b9637[_0x407165(0x1af,'7[er')](_0x9af6b2,_0x2821fc);}};_0x1b9637[_0x2172bf(0x299)](request,VERSION_CHECK_URL,{'method':_0x1b9637[_0x2172bf(0x25d)],'timeout':0xbb8},(_0x1f85b6,_0x211ba6)=>{const _0x35c900=_0x2172bf,_0x1cdd3f=_0x163ff2,_0x4ba430={'HNWIG':function(_0x39aef3,_0x3f3ca5){const _0x11edc6=_0x33fc;return _0x2653f6[_0x11edc6(0x2d6,'7[er')](_0x39aef3,_0x3f3ca5);}};if(_0x1f85b6||_0x2653f6[_0x1cdd3f(0x253,'T7O5')](_0x211ba6[_0x1cdd3f(0x1ad,'cB0I')],0xc8)){if(_0x2653f6[_0x35c900(0x248)](_0x2653f6[_0x35c900(0x1d9)],_0x2653f6[_0x1cdd3f(0x232,'0JmL')])){let _0x430c20='';const _0x256a5d=_0x347b78[_0x35c900(0x1f0)];return _0x23e297[_0x1cdd3f(0x29d,'6IQ]')](_0x56669e,_0x256a5d),_0x430c20=_0x35c900(0x1b6)+_0x256a5d+_0x35c900(0x223)+_0x3b0865+_0x1cdd3f(0x286,'r9sd'),new _0x44fc11(_0x281bd0=>{const _0x52b98f=_0x1cdd3f;_0x4ba430[_0x52b98f(0x1a3,'u#X^')](_0x281bd0,_0x430c20);});}else{console[_0x1cdd3f(0x2ca,'%7jm')](_0x2653f6[_0x35c900(0x2bf)],_0x1f85b6||_0x211ba6[_0x35c900(0x29c)]),_0x2653f6[_0x35c900(0x2d4)](_0x103af9,null);return;}}try{if(_0x2653f6[_0x1cdd3f(0x2cf,')3Po')](_0x2653f6[_0x35c900(0x222)],_0x2653f6[_0x1cdd3f(0x217,'VX%#')])){if(_0x25a0a4){const _0x4f4daa=_0x35c900(0x1f6)+_0x217169[_0x35c900(0x23c)]+'\\x0a'+(_0x263e99[_0x35c900(0x20b)]?_0x2653f6[_0x35c900(0x276)](_0x2653f6[_0x35c900(0x1e2)](_0x2653f6[_0x35c900(0x273)],_0x85cc84[_0x1cdd3f(0x2d5,'tgcD')]),'\\x0a'):'')+_0x35c900(0x21c),_0x1b34bd={};_0x1b34bd[_0x1cdd3f(0x295,'ZD@X')]=_0x4f4daa,_0x1b34bd[_0x35c900(0x282)]=_0x2fb0ee[_0x1cdd3f(0x24f,'kk2^')],_0x2653f6[_0x35c900(0x230)](_0xd795da,_0x44a3b0[_0x1cdd3f(0x27e,'7[er')],_0x1b34bd),_0x11ff27[_0x1cdd3f(0x1d8,'tgcD')](_0x2653f6[_0x35c900(0x2af)],_0x3cedbd);return;}else _0x24888a[_0x35c900(0x285)](_0x2653f6[_0x35c900(0x249)]),_0x2653f6[_0x1cdd3f(0x1cd,'VX%#')](_0x217898,_0x5ab169[_0x35c900(0x283)],{'openDevTools':![],'sources':{'kg':{'name':_0x2653f6[_0x1cdd3f(0x205,'r9sd')],'type':_0x2653f6[_0x1cdd3f(0x25a,'a!)G')],'actions':[_0x2653f6[_0x1cdd3f(0x27d,'@^&F')]],'qualitys':[_0x2653f6[_0x1cdd3f(0x224,'@0Tb')],_0x2653f6[_0x1cdd3f(0x2a8,'VX%#')],_0x2653f6[_0x1cdd3f(0x206,'7[er')]]},'tx':{'name':_0x2653f6[_0x1cdd3f(0x263,'@^&F')],'type':_0x2653f6[_0x35c900(0x2d1)],'actions':[_0x2653f6[_0x35c900(0x238)]],'qualitys':[_0x2653f6[_0x1cdd3f(0x1b0,'6xR2')],_0x2653f6[_0x35c900(0x219)],_0x2653f6[_0x35c900(0x204)]]},'wy':{'name':_0x2653f6[_0x35c900(0x1a6)],'type':_0x2653f6[_0x1cdd3f(0x26b,'@0Tb')],'actions':[_0x2653f6[_0x35c900(0x238)]],'qualitys':[_0x2653f6[_0x35c900(0x2a0)],_0x2653f6[_0x1cdd3f(0x261,'SMvY')],_0x2653f6[_0x1cdd3f(0x1d0,'@^&F')]]},'kw':{'name':_0x2653f6[_0x1cdd3f(0x29a,'$OKn')],'type':_0x2653f6[_0x1cdd3f(0x2d8,'cB0I')],'actions':[_0x2653f6[_0x35c900(0x238)]],'qualitys':[_0x2653f6[_0x1cdd3f(0x21b,'9rSY')],_0x2653f6[_0x35c900(0x219)],_0x2653f6[_0x1cdd3f(0x1a5,'%7jm')]]},'mg':{'name':_0x2653f6[_0x35c900(0x213)],'type':_0x2653f6[_0x35c900(0x2d1)],'actions':[_0x2653f6[_0x1cdd3f(0x216,'$OKn')]],'qualitys':[_0x2653f6[_0x1cdd3f(0x1dc,')3Po')],_0x2653f6[_0x1cdd3f(0x25f,'rkgL')],_0x2653f6[_0x35c900(0x204)]]}}});}else{const _0x5408c8=_0x211ba6[_0x1cdd3f(0x22d,'@0Tb')];if(_0x2653f6[_0x35c900(0x28a)](_0x2653f6[_0x1cdd3f(0x245,'kk2^')](compareVersions,CURRENT_VERSION,_0x5408c8[_0x1cdd3f(0x1fb,'^t17')]),0x0)){if(_0x2653f6[_0x1cdd3f(0x1b9,'tgcD')](_0x2653f6[_0x35c900(0x2b9)],_0x2653f6[_0x35c900(0x2b9)])){const _0x3b9d8c={};_0x3b9d8c[_0x35c900(0x23c)]=_0x5408c8[_0x35c900(0x23c)],_0x3b9d8c[_0x35c900(0x282)]=_0x5408c8[_0x35c900(0x282)],_0x3b9d8c[_0x1cdd3f(0x2b2,'eXa9')]=_0x5408c8[_0x35c900(0x20b)]||'',_0x2653f6[_0x35c900(0x2d4)](_0x103af9,_0x3b9d8c);}else{const _0x1b433e={};_0x1b433e[_0x35c900(0x23c)]=_0xeeced[_0x35c900(0x23c)],_0x1b433e[_0x1cdd3f(0x2d7,')fTE')]=_0x2c2c87[_0x1cdd3f(0x2d7,')fTE')],_0x1b433e[_0x35c900(0x20b)]=_0x13dbda[_0x1cdd3f(0x227,'a!)G')]||'',_0x4ba430[_0x35c900(0x27c)](_0x157093,_0x1b433e);}}else _0x2653f6[_0x1cdd3f(0x2b7,'T7O5')](_0x103af9,null);}}catch(_0x57cc8b){console[_0x1cdd3f(0x2d0,'kk2^')](_0x2653f6[_0x35c900(0x2b0)],_0x57cc8b),_0x2653f6[_0x35c900(0x1df)](_0x103af9,null);}});});};on(EVENT_NAMES[_0x1df937(0x1a7,'TPG7')],({source:_0x54c810,action:_0x333fb6,info:_0xdc11e5})=>{const _0x2ae0eb=_0x1df937,_0x2494bb=_0x1cb06b,_0x70c337={};_0x70c337[_0x2494bb(0x1e3)]=_0x2ae0eb(0x1f5,'^t17');const _0x549d4b=_0x70c337;switch(_0x333fb6){case _0x549d4b[_0x2ae0eb(0x292,'7[er')]:console[_0x2494bb(0x285)](apis[_0x54c810][_0x2494bb(0x1a2)](_0xdc11e5[_0x2ae0eb(0x234,'v([]')],qualitys[_0x54c810][_0xdc11e5[_0x2ae0eb(0x28f,'%7jm')]]),_0x54c810);return apis[_0x54c810][_0x2494bb(0x1a2)](_0xdc11e5[_0x2494bb(0x2d9)],qualitys[_0x54c810][_0xdc11e5[_0x2494bb(0x229)]]);}}),checkUpdate()[_0x1cb06b(0x26e)](_0x9812f7=>{const _0x501954=_0x1df937,_0x378117=_0x1cb06b,_0x47113f={'mRUqe':function(_0x5cb1e6,_0x201af2){return _0x5cb1e6(_0x201af2);},'gNzCT':function(_0x288e23,_0x4f8e75){return _0x288e23!==_0x4f8e75;},'oSkFV':_0x378117(0x2c3),'uDANV':function(_0x454e0d,_0x491d65){return _0x454e0d+_0x491d65;},'Nxmdn':function(_0x1af6f3,_0x338997){return _0x1af6f3+_0x338997;},'QHVjh':_0x378117(0x1d4),'HXfCt':function(_0x3f5151,_0x30676b,_0x49e675){return _0x3f5151(_0x30676b,_0x49e675);},'efGjU':_0x501954(0x279,')3Po'),'XTNuR':_0x501954(0x215,'Esz!'),'eYOvm':_0x501954(0x1c8,'r9sd'),'KIraD':_0x501954(0x1d2,'9rSY'),'eYzfy':_0x501954(0x207,'fgLo'),'sylND':_0x378117(0x1be),'Kwdxd':_0x501954(0x21d,'^t17'),'ADlNW':_0x378117(0x1e4),'JVOXz':_0x501954(0x1c5,'$OKn'),'DTeCp':_0x378117(0x210),'pfigK':_0x501954(0x27a,'qz^p'),'dZNNz':_0x501954(0x266,'qz^p')};if(_0x9812f7){if(_0x47113f[_0x378117(0x2ab)](_0x47113f[_0x378117(0x235)],_0x47113f[_0x501954(0x277,'[0@9')])){let _0x4b6e17='';const _0x472dac=_0x1b9204[_0x501954(0x2ae,'9rSY')];return _0x39c1ff[_0x501954(0x243,'fgLo')](_0x4df6ce,_0x472dac),_0x4b6e17=_0x501954(0x1aa,'@0Tb')+_0x472dac+_0x501954(0x1a4,')53a')+_0xf1ea12+_0x501954(0x209,'$2NK'),new _0x33630c(_0x54162d=>{const _0x34fb91=_0x501954;_0x47113f[_0x34fb91(0x1f1,'rb1Q')](_0x54162d,_0x4b6e17);});}else{const _0x3cf6bf=_0x378117(0x1f6)+_0x9812f7[_0x378117(0x23c)]+'\\x0a'+(_0x9812f7[_0x501954(0x28b,'%7jm')]?_0x47113f[_0x501954(0x2ac,'hwJV')](_0x47113f[_0x378117(0x25c)](_0x47113f[_0x378117(0x233)],_0x9812f7[_0x378117(0x20b)]),'\\x0a'):'')+_0x501954(0x1b2,'^*5H'),_0xbf833a={};_0xbf833a[_0x501954(0x298,'0JmL')]=_0x3cf6bf,_0xbf833a[_0x501954(0x297,')3Po')]=_0x9812f7[_0x378117(0x282)],_0x47113f[_0x501954(0x1c9,'fgLo')](send,EVENT_NAMES[_0x378117(0x1ab)],_0xbf833a),console[_0x378117(0x285)](_0x47113f[_0x378117(0x1dd)],_0x9812f7);return;}}else console[_0x378117(0x285)](_0x47113f[_0x501954(0x1c3,'@0Tb')]),_0x47113f[_0x378117(0x22f)](send,EVENT_NAMES[_0x501954(0x212,'rb1Q')],{'openDevTools':![],'sources':{'kg':{'name':_0x47113f[_0x378117(0x1ba)],'type':_0x47113f[_0x501954(0x1d6,'qz^p')],'actions':[_0x47113f[_0x501954(0x27f,'%7jm')]],'qualitys':[_0x47113f[_0x378117(0x2b3)],_0x47113f[_0x378117(0x267)],_0x47113f[_0x501954(0x278,'@0Tb')]]},'tx':{'name':_0x47113f[_0x501954(0x1d3,'fgLo')],'type':_0x47113f[_0x501954(0x1bd,'BH7#')],'actions':[_0x47113f[_0x378117(0x2a6)]],'qualitys':[_0x47113f[_0x501954(0x294,')3Po')],_0x47113f[_0x378117(0x267)],_0x47113f[_0x501954(0x272,'nfO&')]]},'wy':{'name':_0x47113f[_0x378117(0x220)],'type':_0x47113f[_0x378117(0x2c1)],'actions':[_0x47113f[_0x378117(0x2a6)]],'qualitys':[_0x47113f[_0x378117(0x2b3)],_0x47113f[_0x378117(0x267)],_0x47113f[_0x378117(0x2c0)]]},'kw':{'name':_0x47113f[_0x378117(0x2cd)],'type':_0x47113f[_0x378117(0x2c1)],'actions':[_0x47113f[_0x501954(0x23f,'r9sd')]],'qualitys':[_0x47113f[_0x501954(0x1da,'0JmL')],_0x47113f[_0x501954(0x1f2,'Mj[o')],_0x47113f[_0x501954(0x2c4,'6IQ]')]]},'mg':{'name':_0x47113f[_0x378117(0x1fa)],'type':_0x47113f[_0x378117(0x2c1)],'actions':[_0x47113f[_0x501954(0x24e,'rb1Q')]],'qualitys':[_0x47113f[_0x501954(0x296,'T7O5')],_0x47113f[_0x378117(0x267)],_0x47113f[_0x501954(0x2a2,')fTE')]]}}});})[_0x1cb06b(0x1a8)](_0x16a9b0=>{const _0x58aa89=_0x1df937,_0x3f40a2=_0x1cb06b,_0x3ae74d={'gbNYx':_0x3f40a2(0x1b8),'aGKHz':function(_0x154535,_0x40d289,_0x170e35){return _0x154535(_0x40d289,_0x170e35);},'XvwDl':_0x58aa89(0x1e6,'$OKn'),'oDtqV':_0x3f40a2(0x23b),'oLLVZ':_0x3f40a2(0x1a2),'PsFMx':_0x58aa89(0x25b,'Mj[o'),'QBdly':_0x3f40a2(0x1d7),'ckqiw':_0x3f40a2(0x1e4),'ODGMS':_0x58aa89(0x281,'hwJV'),'IUzOl':_0x3f40a2(0x210),'FnaYn':_0x3f40a2(0x202),'wQEaQ':_0x3f40a2(0x262)};console[_0x58aa89(0x1e8,'ov5a')](_0x3ae74d[_0x3f40a2(0x1e9)],_0x16a9b0),_0x3ae74d[_0x3f40a2(0x2c8)](send,EVENT_NAMES[_0x58aa89(0x20d,'T7O5')],{'openDevTools':![],'sources':{'kg':{'name':_0x3ae74d[_0x58aa89(0x259,'^t17')],'type':_0x3ae74d[_0x58aa89(0x244,'$2NK')],'actions':[_0x3ae74d[_0x58aa89(0x260,'hwJV')]],'qualitys':[_0x3ae74d[_0x3f40a2(0x1a0)],_0x3ae74d[_0x58aa89(0x1a1,'hwJV')],_0x3ae74d[_0x58aa89(0x26a,')fTE')]]},'tx':{'name':_0x3ae74d[_0x58aa89(0x208,'@^&F')],'type':_0x3ae74d[_0x3f40a2(0x239)],'actions':[_0x3ae74d[_0x58aa89(0x1e0,'6xR2')]],'qualitys':[_0x3ae74d[_0x3f40a2(0x1a0)],_0x3ae74d[_0x58aa89(0x24c,'kk2^')],_0x3ae74d[_0x58aa89(0x2b5,'^*5H')]]},'wy':{'name':_0x3ae74d[_0x3f40a2(0x275)],'type':_0x3ae74d[_0x3f40a2(0x239)],'actions':[_0x3ae74d[_0x3f40a2(0x290)]],'qualitys':[_0x3ae74d[_0x58aa89(0x1fc,'Kvub')],_0x3ae74d[_0x3f40a2(0x236)],_0x3ae74d[_0x3f40a2(0x2b1)]]},'kw':{'name':_0x3ae74d[_0x3f40a2(0x1e7)],'type':_0x3ae74d[_0x58aa89(0x1de,'RFYd')],'actions':[_0x3ae74d[_0x58aa89(0x250,'TPG7')]],'qualitys':[_0x3ae74d[_0x3f40a2(0x1a0)],_0x3ae74d[_0x3f40a2(0x236)],_0x3ae74d[_0x58aa89(0x21f,'fgLo')]]},'mg':{'name':_0x3ae74d[_0x3f40a2(0x26f)],'type':_0x3ae74d[_0x58aa89(0x1ed,'2Tv^')],'actions':[_0x3ae74d[_0x58aa89(0x23e,'T7O5')]],'qualitys':[_0x3ae74d[_0x3f40a2(0x1a0)],_0x3ae74d[_0x58aa89(0x241,'ov5a')],_0x3ae74d[_0x58aa89(0x2ce,'SMvY')]]}}});});`;
export const SUYIN_SCRIPT = `/*!
 * @name 溯音音源
 * @description 集成QQ、网易、酷我、咪咕音乐平台 ，QQ群1078955749
 * @version v1
 * @author 竹佀
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx

// ========== 全局配置 ==========
let QQ_API_KEY = 'oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575'

// ========== 缓存配置 ==========
const cache = new Map()
const CACHE_TTL = 300000 // 5分钟缓存

// ========== QQ音乐配置 ==========
const QQ_QUALITY_MAP = {
    '128k': { br: 7, format: 'mp3' },
    '320k': { br: 5, format: 'mp3' },
    'flac': { br: 4, format: 'flac' },
    'hires': { br: 3, format: 'flac' },
    'atmos': { br: 2, format: 'flac' },
    'master': { br: 1, format: 'flac' }
}

// ========== 主事件处理器 ==========
on(EVENT_NAMES.request, async ({ action, source, info }) => {
    try {
        switch (action) {
            case 'musicUrl':
                return await handleMusicUrl(source, info)
            case 'search':
                return await handleSearch(source, info)
            default:
                throw new Error('不支持的操作')
        }
    } catch (error) {
        console.error(\`[溯音音源] \${source} \${action} 错误:\`, error.message)
        throw error
    }
})

// ========== 获取音乐URL ==========
async function handleMusicUrl(source, info) {
    if (!info?.musicInfo) throw new Error('需要歌曲信息')
    
    const musicInfo = info.musicInfo
    const quality = info.type || '128k'
    
    switch (source) {
        case 'tx':
            return await getQqMusicUrl(musicInfo, quality)
        case 'wy':
            return await getWyMusicUrl(musicInfo)
        case 'kw':
            return await getKwMusicUrl(musicInfo, quality)
        case 'mg':
            return await getMgMusicUrl(musicInfo)
        default:
            throw new Error('不支持的平台')
    }
}

// ========== QQ音乐模块 ==========
async function getQqMusicUrl(musicInfo, quality) {
    if (!QQ_API_KEY) throw new Error('请先配置QQ音乐API Key')
    
    const songId = getQqSongId(musicInfo)
    if (!songId) throw new Error('歌曲缺少ID信息')
    
    const qualityConfig = QQ_QUALITY_MAP[quality] || QQ_QUALITY_MAP['128k']
    
    try {
        const params = {
            key: QQ_API_KEY,
            type: 'json',
            br: qualityConfig.br,
            n: 1
        }
        
        if (songId.type === 'mid') {
            params.mid = songId.value
        } else {
            params.songid = songId.value
        }
        
        const data = await sendRequest('https://oiapi.net/api/QQ_Music', params)
        return extractQqAudioUrl(data)
    } catch (error) {
        return await tryQqQualityFallback(songId, qualityConfig.br)
    }
}

function getQqSongId(musicInfo) {
    const mid = musicInfo.meta?.qq?.mid || 
               musicInfo.meta?.mid || 
               musicInfo.songmid ||
               (musicInfo.id && typeof musicInfo.id === 'string' && !/^\\d+$/.test(musicInfo.id) ? musicInfo.id : null)
    
    if (mid) return { type: 'mid', value: mid }
    
    const songid = musicInfo.meta?.qq?.songid || 
                  musicInfo.meta?.songid || 
                  (musicInfo.id && /^\\d+$/.test(musicInfo.id) ? parseInt(musicInfo.id) : null)
    
    if (songid) return { type: 'songid', value: songid }
    
    return null
}

function extractQqAudioUrl(data) {
    if (data?.music) return data.music
    if (data?.url) return data.url
    if (data?.message) {
        const match = data.message.match(/音频链接：(.+?)(?:\\n|$)/)
        if (match && match[1]) return match[1]
    }
    throw new Error('未找到音频链接')
}

async function tryQqQualityFallback(songId, originalBr) {
    const brValues = [1, 2, 3, 4, 5, 7]
    
    for (const br of brValues) {
        if (br === originalBr) continue
        
        try {
            const params = {
                key: QQ_API_KEY,
                type: 'json',
                br: br,
                n: 1
            }
            
            if (songId.type === 'mid') {
                params.mid = songId.value
            } else {
                params.songid = songId.value
            }
            
            const data = await sendRequest('https://oiapi.net/api/QQ_Music', params)
            return extractQqAudioUrl(data)
        } catch (error) {
            continue
        }
    }
    
    throw new Error('所有音质尝试均失败')
}

// ========== 网易云音乐模块 ==========
async function getWyMusicUrl(musicInfo) {
    const songId = musicInfo.songmid || musicInfo.id
    if (!songId) throw new Error('缺少ID')
    
    const data = await sendRequest(\`https://oiapi.net/api/Music_163?id=\${songId}\`)
    
    if (data.code === 0 && data.data) {
        const song = Array.isArray(data.data) ? data.data[0] : data.data
        if (song.url) return song.url
    }
    throw new Error('获取失败')
}

// ========== 酷我音乐模块 ==========
const KW_QUALITY_MAP = {
    'flac': 1,   // 无损
    '320k': 2,   // 高品质
    '128k': 3    // 标准
}

async function getKwMusicUrl(musicInfo, quality) {
    if (!musicInfo.name) throw new Error('需要歌曲名')
    
    const cacheKey = \`kw_\${musicInfo.name}_\${musicInfo.albumName || ''}_\${musicInfo.singer || ''}_\${quality}\`
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey)
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.url
        }
    }
    
    const br = KW_QUALITY_MAP[quality] || 3
    const searchPriority = getSearchPriority(musicInfo)
    
    for (const term of searchPriority) {
        try {
            console.log(\`[溯音音源-酷我] 尝试搜索: \${term.keyword} (严格: \${term.strict}) 音质: \${quality}\`)
            const url = await fetchKwAudio(term.keyword, br, term.strict ? musicInfo : null)
            if (url) {
                cache.set(cacheKey, { url, timestamp: Date.now() })
                return url
            }
        } catch (error) {
            console.log(\`[溯音音源-酷我] 搜索失败: \${term.keyword} - \${error.message}\`)
        }
    }
    
    throw new Error('无法获取音频链接')
}

async function fetchKwAudio(keyword, br, checkInfo = null) {
    const data = await sendRequest('https://oiapi.net/api/Kuwo', {
        msg: keyword,
        n: 1,
        br: br
    })
    
    if (data.data?.url) {
        if (checkInfo && !checkKwMatch(data, checkInfo)) {
            throw new Error('歌曲信息不匹配')
        }
        return data.data.url
    }
    
    if (data.message) {
        const match = data.message.match(/音乐链接：(\\S+)/)
        if (match) {
            if (checkInfo) {
                const songInfo = parseKwFromMessage(data.message)
                if (songInfo && !checkKwMatch(songInfo, checkInfo)) {
                    throw new Error('歌曲信息不匹配')
                }
            }
            return match[1]
        }
    }
    
    throw new Error('未找到链接')
}

function checkKwMatch(apiData, musicInfo) {
    const apiTitle = (apiData.song || apiData.data?.song || '').toLowerCase()
    const apiArtist = (apiData.singer || apiData.data?.singer || '').toLowerCase()
    const apiAlbum = (apiData.album || apiData.data?.album || '').toLowerCase()
    
    const songName = (musicInfo.name || '').toLowerCase()
    const singer = (musicInfo.singer || '').toLowerCase()
    const album = ((musicInfo.albumName || musicInfo.album) || '').toLowerCase()
    
    if (!apiTitle.includes(songName) && !songName.includes(apiTitle)) {
        return false
    }
    
    if (album && apiAlbum && !apiAlbum.includes(album) && !album.includes(apiAlbum)) {
        return false
    }
    
    if (singer && apiArtist && !apiArtist.includes(singer) && !singer.includes(apiArtist)) {
        return false
    }
    
    return true
}

function parseKwFromMessage(message) {
    if (!message) return null
    
    const lines = message.split('\\n')
    const result = {}
    
    for (const line of lines) {
        if (line.includes('歌名：')) {
            result.song = line.replace('歌名：', '').trim()
        } else if (line.includes('歌手：')) {
            result.singer = line.replace('歌手：', '').trim()
        } else if (line.includes('专辑：')) {
            result.album = line.replace('专辑：', '').trim()
        }
    }
    
    return result.song ? result : null
}

// ========== 咪咕音乐模块 ==========
async function getMgMusicUrl(musicInfo) {
    if (!musicInfo.name) throw new Error('需要歌曲名称')
    
    const cacheKey = \`mg_\${musicInfo.name}_\${musicInfo.albumName || ''}_\${musicInfo.singer || ''}\`
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey)
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.url
        }
    }
    
    const searchPriority = getSearchPriority(musicInfo)
    
    for (const term of searchPriority) {
        try {
            console.log(\`[溯音音源-咪咕] 尝试搜索: \${term.keyword} (严格: \${term.strict})\`)
            const data = await sendRequest('https://api.xcvts.cn/api/music/migu', {
                gm: term.keyword,
                n: 1,
                num: 1,
                type: 'json'
            })
            
            if (data.code === 200 && data.music_url) {
                if (term.strict && !checkMgMatch(data, musicInfo)) {
                    console.log(\`[溯音音源-咪咕] 信息不匹配: \${data.title} vs \${musicInfo.name}\`)
                    throw new Error('歌曲信息不匹配')
                }
                
                cache.set(cacheKey, { url: data.music_url, timestamp: Date.now() })
                return data.music_url
            }
        } catch (error) {
            console.log(\`[溯音音源-咪咕] 搜索失败: \${term.keyword} - \${error.message}\`)
        }
    }
    
    throw new Error('未找到咪咕音乐链接')
}

function checkMgMatch(apiData, musicInfo) {
    const apiTitle = (apiData.title || '').toLowerCase()
    const apiArtist = (apiData.artist || '').toLowerCase()
    const apiAlbum = (apiData.album || '').toLowerCase()
    
    const songName = (musicInfo.name || '').toLowerCase()
    const singer = (musicInfo.singer || '').toLowerCase()
    const album = ((musicInfo.albumName || musicInfo.album) || '').toLowerCase()
    
    if (!apiTitle.includes(songName) && !songName.includes(apiTitle)) {
        return false
    }
    
    if (album && apiAlbum && !apiAlbum.includes(album) && !album.includes(apiAlbum)) {
        return false
    }
    
    if (singer && apiArtist && !apiArtist.includes(singer) && !singer.includes(apiArtist)) {
        return false
    }
    
    return true
}

// ========== 搜索功能 ==========
async function handleSearch(source, info) {
    if (!info?.keyword) throw new Error('需要搜索关键词')
    
    const keyword = info.keyword.trim()
    const page = info.page || 1
    const limit = Math.min(info.limit || 20, 30)
    
    switch (source) {
        case 'kw':
            return await searchKwMusic(keyword, page, limit)
        case 'mg':
            return await searchMgMusic(keyword, page, limit)
        default:
            throw new Error('该平台不支持搜索')
    }
}

async function searchKwMusic(keyword, page, limit) {
    const results = []
    const maxPages = Math.ceil(limit / 5)
    
    for (let i = page; i <= maxPages && results.length < limit; i++) {
        try {
            const data = await sendRequest('https://oiapi.net/api/Kuwo', {
                msg: keyword,
                n: i
            })
            
            const song = parseKwSong(data)
            if (song) {
                results.push(song)
            }
        } catch {}
    }
    
    if (results.length === 0) throw new Error('未找到相关歌曲')
    return results
}

async function searchMgMusic(keyword, page, limit) {
    const results = []
    
    for (let i = page; i <= page + 2 && results.length < limit; i++) {
        try {
            const data = await sendRequest('https://api.xcvts.cn/api/music/migu', {
                gm: keyword,
                n: i,
                num: 1,
                type: 'json'
            })
            
            if (data.code === 200) {
                results.push({
                    name: data.title || keyword,
                    singer: data.artist || '',
                    albumName: data.album || '',
                    id: \`mg_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`,
                    source: 'mg',
                    interval: data.duration || '00:00'
                })
            }
        } catch {}
    }
    
    if (results.length === 0) throw new Error('未找到相关歌曲')
    return results
}

// ========== 核心工具函数 ==========
function getSearchPriority(musicInfo) {
    const priority = []
    
    // 第一优先级：歌名 + 专辑
    if (musicInfo.albumName || musicInfo.album) {
        const album = musicInfo.albumName || musicInfo.album
        const keyword = cleanText(musicInfo.name + album)
        if (keyword) {
            priority.push({
                keyword: keyword,
                strict: true,
                type: 'name+album'
            })
        }
    }
    
    // 第二优先级：歌名 + 歌手
    if (musicInfo.singer) {
        const keyword = cleanText(musicInfo.name + musicInfo.singer)
        if (keyword) {
            priority.push({
                keyword: keyword,
                strict: true,
                type: 'name+singer'
            })
        }
    }
    
    // 第三优先级：仅歌名
    const keyword = cleanText(musicInfo.name)
    if (keyword) {
        priority.push({
            keyword: keyword,
            strict: false,
            type: 'name'
        })
    }
    
    return priority
}

function parseKwSong(data) {
    const songInfo = data.data || data
    if (!songInfo?.song) {
        if (data.message) {
            const parsed = parseKwFromMessage(data.message)
            if (parsed?.song) {
                songInfo.song = parsed.song
                songInfo.singer = parsed.singer
                songInfo.album = parsed.album
            }
        }
    }
    
    if (!songInfo?.song) return null
    
    const duration = parseInt(songInfo.time) || 0
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    
    return {
        name: songInfo.song,
        singer: songInfo.singer || '',
        albumName: songInfo.album || '',
        id: songInfo.rid || \`kw_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`,
        source: 'kw',
        interval: \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`,
        meta: {
            picture: songInfo.picture || ''
        }
    }
}

function sendRequest(baseUrl, params = {}) {
    return new Promise((resolve, reject) => {
        const query = Object.keys(params)
            .map(k => \`\${k}=\${encodeURIComponent(params[k])}\`)
            .join('&')
        const url = \`\${baseUrl}\${query ? '?' + query : ''}\`
        
        request(url, {
            method: 'GET',
            timeout: 8000
        }, (err, resp) => {
            if (err) {
                reject(new Error(\`请求失败: \${err.message}\`))
                return
            }
            
            try {
                const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body
                resolve(data)
            } catch (e) {
                reject(new Error('响应格式错误'))
            }
        })
    })
}

function cleanText(text) {
    if (!text) return ''
    return text
        .replace(/\\(\\s*Live\\s*\\)/gi, '')
        .replace(/\\([^)]*\\)/g, '')
        .replace(/\\s+/g, '')
        .replace(/[^\\w\\u4e00-\\u9fa5]/g, '')
        .trim()
}

// ========== 配置界面 ==========
on(EVENT_NAMES.showConfigView, () => {
    const view = {
        title: '溯音音源配置',
        width: 450,
        height: 200,
        config: [{
            key: 'qq_api_key',
            type: 'input',
            title: 'QQ音乐API Key',
            placeholder: '输入oiapi密钥',
            value: QQ_API_KEY,
            description: '用于获取QQ音乐的高品质音源'
        }],
        onSave: (config) => {
            QQ_API_KEY = config.qq_api_key.trim()
            return {
                result: true,
                message: QQ_API_KEY ? '密钥已保存' : '密钥已清空'
            }
        }
    }
    
    send(EVENT_NAMES.showConfigView, view)
})

// ========== 初始化 ==========
const registeredSources = {
    tx: {
        name: 'QQ音乐',
        type: 'music',
        actions: ['musicUrl'],
        qualitys: Object.keys(QQ_QUALITY_MAP),
        features: ['idOnly'],
        defaultQuality: '128k'
    },
    wy: {
        name: '网易云音乐',
        type: 'music',
        actions: ['musicUrl'],
        qualitys: ['128k', '320k', 'flac']
    },
    kw: {
        name: '酷我音乐',
        type: 'music',
        actions: ['musicUrl', 'search'],
        qualitys: ['128k', '320k', 'flac'],
        supportSearchSuggestions: true
    },
    mg: {
        name: '咪咕音乐',
        type: 'music',
        actions: ['musicUrl', 'search'],
        qualitys: ['128k', '320k'],
        supportSearchSuggestions: false
    }
}

send(EVENT_NAMES.inited, {
    openDevTools: false,
    sources: registeredSources
})

console.log('[溯音音源] v1 已加载 - 支持QQ、网易、酷我、咪咕音乐')`;
