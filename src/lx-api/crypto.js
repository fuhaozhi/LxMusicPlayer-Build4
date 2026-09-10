/**
 * 纯 JS 加密/编码工具集 —— 为 lx-music 自定义音源脚本环境提供 utils.crypto 所需能力
 * （Android 端由 QuickJS 原生模块提供，此处用纯 JS 实现，可在 iOS RN(JSC/Hermes) 与 Node 中运行）
 *
 * 实现：Base64(UTF-8 安全) / MD5 / AES-128-CBC|ECB(PKCS7) / RSA 公钥加密(NoPadding, BigInt) / randomBytes
 */
// ---------- Base64 ----------
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function utf8Encode(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
            const next = str.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
                i++;
            }
        }
        if (code < 0x80)
            bytes.push(code);
        else if (code < 0x800)
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        else if (code < 0x10000)
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        else
            bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return new Uint8Array(bytes);
}
function utf8Decode(bytes) {
    let result = '';
    let i = 0;
    while (i < bytes.length) {
        const byte = bytes[i];
        if (byte < 0x80) {
            result += String.fromCharCode(byte);
            i++;
        }
        else if (byte >= 0xc0 && byte < 0xe0) {
            result += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
            i += 2;
        }
        else if (byte >= 0xe0 && byte < 0xf0) {
            result += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
            i += 3;
        }
        else {
            const cp = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
            result += String.fromCodePoint(cp);
            i += 4;
        }
    }
    return result;
}
/** 字符串 -> Base64（UTF-8 安全，输出与 Android Base64.NO_WRAP 一致） */
export function strToBase64(str) {
    const bytes = utf8Encode(str);
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        out += B64_CHARS[b0 >> 2];
        out += B64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
        out += i + 1 < bytes.length ? B64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
        out += i + 2 < bytes.length ? B64_CHARS[b2 & 0x3f] : '=';
    }
    return out;
}
/** Base64 -> 字节数组 JSON 字符串（如 "[1,2,3]"，与 Android b642buf 返回格式一致） */
export function base64ToByteArrayJson(b64) {
    const bytes = base64ToBytes(b64);
    return '[' + Array.from(bytes).join(',') + ']';
}
export function base64ToBytes(b64) {
    b64 = b64.replace(/[^A-Za-z0-9+/]/g, '');
    const bytes = [];
    for (let i = 0; i < b64.length; i += 4) {
        const c0 = B64_CHARS.indexOf(b64[i]);
        const c1 = B64_CHARS.indexOf(b64[i + 1]);
        const c2 = B64_CHARS.indexOf(b64[i + 2]);
        const c3 = B64_CHARS.indexOf(b64[i + 3]);
        bytes.push((c0 << 2) | (c1 >> 4));
        if (c2 !== -1)
            bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
        if (c3 !== -1)
            bytes.push(((c2 & 0x03) << 6) | c3);
    }
    return new Uint8Array(bytes);
}
export function bytesToBase64(bytes) {
    let out = '';
    const b = Array.from(bytes);
    for (let i = 0; i < b.length; i += 3) {
        const b0 = b[i];
        const b1 = i + 1 < b.length ? b[i + 1] : 0;
        const b2 = i + 2 < b.length ? b[i + 2] : 0;
        out += B64_CHARS[b0 >> 2];
        out += B64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
        out += i + 1 < b.length ? B64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
        out += i + 2 < b.length ? B64_CHARS[b2 & 0x3f] : '=';
    }
    return out;
}
export function utf8BytesToString(bytes) {
    return utf8Decode(bytes);
}
export function stringToUtf8Bytes(str) {
    return utf8Encode(str);
}
// ---------- MD5 ----------
const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K = [];
for (let i = 0; i < 64; i++)
    MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
function md5RotateLeft(x, c) {
    return (x << c) | (x >>> (32 - c));
}
/** 计算字符串的 MD5（与 Android URLDecoder 后取 UTF-8 MD5 的逻辑对齐） */
export function md5(str) {
    const bytes = utf8Encode(str);
    const bitLen = bytes.length * 8;
    const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, bitLen >>> 0, true);
    dv.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);
    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    for (let i = 0; i < padded.length; i += 64) {
        const m = [];
        for (let j = 0; j < 16; j++)
            m[j] = dv.getUint32(i + j * 4, true);
        let a = a0, b = b0, c = c0, d = d0;
        for (let j = 0; j < 64; j++) {
            let f, g;
            if (j < 16) {
                f = (b & c) | (~b & d);
                g = j;
            }
            else if (j < 32) {
                f = (d & b) | (~d & c);
                g = (5 * j + 1) % 16;
            }
            else if (j < 48) {
                f = b ^ c ^ d;
                g = (3 * j + 5) % 16;
            }
            else {
                f = c ^ (b | ~d);
                g = (7 * j) % 16;
            }
            const tmp = d;
            d = c;
            c = b;
            b = b + md5RotateLeft((a + f + MD5_K[j] + m[g]) >>> 0, MD5_S[j]);
            a = tmp;
        }
        a0 = (a0 + a) >>> 0;
        b0 = (b0 + b) >>> 0;
        c0 = (c0 + c) >>> 0;
        d0 = (d0 + d) >>> 0;
    }
    // 摘要按 RFC1321 要求以"每个 32 位字的字节小端序(LSB first)"输出。
    // 压缩算出的 a0..d0 是标准小端字（如 0x98500190 对应字节 90 50 01 98），
    // 直接用 toString(16) 会把字当大端打印（98500190），导致摘要字节序错误。
    const hexLE = (n) => {
        const b = n >>> 0;
        const bytes = [b & 0xff, (b >>> 8) & 0xff, (b >>> 16) & 0xff, (b >>> 24) & 0xff];
        return bytes.map((x) => x.toString(16).padStart(2, '0')).join('');
    };
    return hexLE(a0) + hexLE(b0) + hexLE(c0) + hexLE(d0);
}
// ---------- AES-128 ----------
const AES_SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];
function aesKeyExpansion(key) {
    const w = [];
    for (let i = 0; i < 4; i++)
        w[i] = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]];
    let rcon = 1;
    for (let i = 4; i < 44; i++) {
        let temp = w[i - 1].slice();
        if (i % 4 === 0) {
            temp = [temp[1], temp[2], temp[3], temp[0]].map(b => AES_SBOX[b]);
            temp[0] ^= rcon;
            rcon = ((rcon << 1) ^ (rcon & 0x80 ? 0x1b : 0)) & 0xff;
        }
        w[i] = [w[i - 4][0] ^ temp[0], w[i - 4][1] ^ temp[1], w[i - 4][2] ^ temp[2], w[i - 4][3] ^ temp[3]];
    }
    return w;
}
function aesAddRoundKey(state, w, round) {
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            state[r][c] ^= w[round * 4 + c][r];
}
function aesSubBytes(state) {
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++)
            state[r][c] = AES_SBOX[state[r][c]];
}
function aesShiftRows(state) {
    for (let r = 1; r < 4; r++) {
        const row = [state[r][0], state[r][1], state[r][2], state[r][3]];
        for (let c = 0; c < 4; c++)
            state[r][c] = row[(c + r) % 4];
    }
}
function aesMixColumns(state) {
    // 标准 AES 列混合矩阵：
    //   out0 = 2a0 ^ 3a1 ^ 1a2 ^ 1a3
    //   out1 = 1a0 ^ 2a1 ^ 3a2 ^ 1a3
    //   out2 = 1a0 ^ 1a1 ^ 2a2 ^ 3a3
    //   out3 = 3a0 ^ 1a1 ^ 1a2 ^ 2a3
    for (let c = 0; c < 4; c++) {
        const a = [state[0][c], state[1][c], state[2][c], state[3][c]];
        state[0][c] = gmul(a[0], 2) ^ gmul(a[1], 3) ^ a[2] ^ a[3];
        state[1][c] = a[0] ^ gmul(a[1], 2) ^ gmul(a[2], 3) ^ a[3];
        state[2][c] = a[0] ^ a[1] ^ gmul(a[2], 2) ^ gmul(a[3], 3);
        state[3][c] = gmul(a[0], 3) ^ a[1] ^ a[2] ^ gmul(a[3], 2);
    }
}
function gmul(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
        if (b & 1)
            p ^= a;
        const hi = a & 0x80;
        a = (a << 1) & 0xff;
        if (hi)
            a ^= 0x1b;
        b >>= 1;
    }
    return p;
}
function aesEncryptBlock(block, w) {
    const state = [];
    for (let r = 0; r < 4; r++)
        state[r] = [block[r], block[r + 4], block[r + 8], block[r + 12]];
    aesAddRoundKey(state, w, 0);
    for (let round = 1; round < 10; round++) {
        aesSubBytes(state);
        aesShiftRows(state);
        aesMixColumns(state);
        aesAddRoundKey(state, w, round);
    }
    aesSubBytes(state);
    aesShiftRows(state);
    aesAddRoundKey(state, w, 10);
    const out = new Uint8Array(16);
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++)
            out[r + 4 * c] = state[r][c];
    return out;
}
function aesPkcs7Pad(data) {
    const padLen = 16 - (data.length % 16);
    const out = new Uint8Array(data.length + padLen);
    out.set(data);
    for (let i = data.length; i < out.length; i++)
        out[i] = padLen;
    return out;
}
/**
 * AES-128 加密（CBC / ECB），输入输出均为 base64 字符串（与 Android AES.encrypt 行为对齐）
 * @param dataB64 明文 base64
 * @param keyB64  密钥 base64（128bit）
 * @param ivB64   IV base64（CBC 必填；ECB 传空字符串）
 * @param mode    'AES/CBC/PKCS7Padding' | 'AES'
 */
export function aesEncrypt(dataB64, keyB64, ivB64, mode) {
    const data = base64ToBytes(dataB64);
    const key = base64ToBytes(keyB64);
    const w = aesKeyExpansion(key);
    const isCBC = mode.includes('CBC');
    const iv = isCBC ? base64ToBytes(ivB64) : new Uint8Array(16);
    const padded = aesPkcs7Pad(data);
    const out = new Uint8Array(padded.length);
    const prev = iv.slice();
    for (let i = 0; i < padded.length; i += 16) {
        const block = padded.slice(i, i + 16);
        if (isCBC)
            for (let j = 0; j < 16; j++)
                block[j] ^= prev[j];
        const enc = aesEncryptBlock(block, w);
        out.set(enc, i);
        if (isCBC)
            prev.set(enc);
    }
    return bytesToBase64(out);
}
// ---------- RSA 公钥加密（RSA/ECB/NoPadding，PKCS#1 v1.5 明文填充） ----------
function pemToBytes(pem) {
    const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    return base64ToBytes(base64);
}
function derDecodeSeq(bytes) {
    let i = 0;
    if (bytes[i] !== 0x30)
        throw new Error('Invalid DER sequence');
    i++;
    let len = bytes[i];
    i++;
    if (len & 0x80) {
        const numBytes = len & 0x7f;
        len = 0;
        for (let j = 0; j < numBytes; j++)
            len = len * 256 + bytes[i + j];
        i += numBytes;
    }
    return { contentStart: i, contentEnd: i + len };
}
function derReadInteger(bytes, offset) {
    if (bytes[offset] !== 0x02)
        throw new Error('Invalid DER integer');
    let len = bytes[offset + 1];
    let i = offset + 2;
    if (len & 0x80) {
        const numBytes = len & 0x7f;
        len = 0;
        for (let j = 0; j < numBytes; j++)
            len = len * 256 + bytes[i + j];
        i += numBytes;
    }
    let hex = '';
    let start = i;
    if (bytes[i] === 0x00)
        start = i + 1;
    for (let j = start; j < i + len; j++)
        hex += bytes[j].toString(16).padStart(2, '0');
    return { value: BigInt('0x' + (hex || '0')), next: i + len };
}
function rsaParsePublicKey(pem) {
    const der = derDecodeSeq(pemToBytes(pem));
    const seq = derDecodeSeq(der.contentStart === 0 ? new Uint8Array(der.contentEnd) : pemToBytes(pem));
    // 简化：直接解析首个序列中的两个整数（n, e）
    let pos = seq.contentStart;
    const n = derReadInteger(pemToBytes(pem), pos);
    pos = n.next;
    const e = derReadInteger(pemToBytes(pem), pos);
    return { n: n.value, e: e.value };
}
/**
 * RSA 公钥加密（RSA/ECB/NoPadding，PKCS#1 v1.5 类型 2 填充，与 Android RSA 对齐）
 * @param dataB64 明文 base64
 * @param keyPem  公钥 PEM 字符串（去除头尾标记亦可）
 */
export function rsaEncrypt(dataB64, keyPem) {
    const { n, e } = rsaParsePublicKey(keyPem);
    const data = base64ToBytes(dataB64);
    const k = Math.ceil(n.toString(16).length / 2);
    if (data.length > k - 11)
        throw new Error('data too long for RSA key');
    const padded = new Uint8Array(k);
    padded[0] = 0x00;
    padded[1] = 0x02;
    for (let i = 2; i < k - data.length - 1; i++)
        padded[i] = Math.floor(Math.random() * 255) + 1;
    padded[k - data.length - 1] = 0x00;
    padded.set(data, k - data.length);
    let m = 0n;
    for (const byte of padded)
        m = (m << 8n) | BigInt(byte);
    const c = modPow(m, e, n);
    const hex = c.toString(16).padStart(k * 2, '0');
    return bytesToBase64(hexToBytes(hex));
}
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++)
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    return bytes;
}
function modPow(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp & 1n)
            result = (result * base) % mod;
        exp >>= 1n;
        base = (base * base) % mod;
    }
    return result;
}
// ---------- randomBytes ----------
export function randomBytes(size) {
    const bytes = new Uint8Array(size);
    const gcr = globalThis.crypto;
    if (gcr && typeof gcr.getRandomValues === 'function') {
        gcr.getRandomValues(bytes);
    }
    else {
        for (let i = 0; i < size; i++)
            bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
}
