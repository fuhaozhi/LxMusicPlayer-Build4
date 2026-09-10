const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
};
function normalizeHeaders(headers) {
    const result = {};
    if (!headers)
        return result;
    const forEach = headers.forEach?.bind(headers) ?? headers.map?.bind(headers);
    if (forEach) {
        forEach((value, key) => {
            result[key] = value;
        });
    }
    else if (typeof headers === 'object') {
        for (const [key, value] of Object.entries(headers)) {
            if (value != null)
                result[key] = String(value);
        }
    }
    return result;
}
async function handleRequestData(method, headers, options) {
    const finalHeaders = { Accept: 'application/json', ...headers };
    const m = method.toLowerCase();
    let body = options.body;
    if (m === 'post' && !finalHeaders['Content-Type']) {
        if (options.form) {
            finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
            body = Object.entries(options.form)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
                .join('&');
        }
        else if (options.formData) {
            finalHeaders['Content-Type'] = 'multipart/form-data';
            body = options.formData;
        }
        else {
            finalHeaders['Content-Type'] = 'application/json';
        }
    }
    if (finalHeaders['Content-Type'] === 'application/json' && body != null && typeof body !== 'string') {
        body = JSON.stringify(body);
    }
    return { method: m, headers: { ...DEFAULT_HEADERS, ...finalHeaders }, body };
}
/**
 * 发起网络请求。与项目内 fetchData 语义一致：
 * - 默认超时 13s（options.timeout 可覆盖）
 * - 返回 Promise<HostResponse>，body 已解析（JSON/文本/Uint8Array）
 * - 附带 abort() 用于取消
 */
export function fetchData(url, options = {}) {
    const timeout = options.timeout ?? 13000;
    const controller = new AbortController();
    let timer = null;
    const request = (async () => {
        const method = (options.method ?? 'get').toUpperCase();
        const { method: reqMethod, headers, body } = await handleRequestData(method, options.headers ?? {}, options);
        if (typeof globalThis.fetch !== 'function') {
            throw new Error('fetch is not available in this environment');
        }
        timer = setTimeout(() => controller.abort(), timeout);
        try {
            const resp = await globalThis.fetch(url, {
                method: reqMethod,
                headers,
                body,
                signal: controller.signal,
            });
            let text;
            if (options.binary) {
                const buffer = await resp.arrayBuffer();
                const respBody = new Uint8Array(buffer);
                return {
                    headers: normalizeHeaders(resp.headers),
                    body: respBody,
                    statusCode: resp.status,
                    statusMessage: resp.statusText,
                    url: resp.url,
                    ok: resp.ok,
                };
            }
            text = await resp.text();
            let parsedBody = text;
            try {
                parsedBody = JSON.parse(text);
            }
            catch {
                // 非 JSON 保持原文
            }
            return {
                headers: normalizeHeaders(resp.headers),
                body: parsedBody,
                statusCode: resp.status,
                statusMessage: resp.statusText,
                url: resp.url,
                ok: resp.ok,
            };
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    })();
    return {
        request,
        abort: () => controller.abort(),
    };
}
