/**
 * 纯 JS 加密/编码工具集 —— 为 lx-music 自定义音源脚本环境提供 utils.crypto 所需能力
 * （Android 端由 QuickJS 原生模块提供，此处用纯 JS 实现，可在 iOS RN(JSC/Hermes) 与 Node 中运行）
 *
 * 实现：Base64(UTF-8 安全) / MD5 / AES-128-CBC|ECB(PKCS7) / RSA 公钥加密(NoPadding, BigInt) / randomBytes
 */
/** 字符串 -> Base64（UTF-8 安全，输出与 Android Base64.NO_WRAP 一致） */
export declare function strToBase64(str: string): string;
/** Base64 -> 字节数组 JSON 字符串（如 "[1,2,3]"，与 Android b642buf 返回格式一致） */
export declare function base64ToByteArrayJson(b64: string): string;
export declare function base64ToBytes(b64: string): Uint8Array;
export declare function bytesToBase64(bytes: ArrayLike<number>): string;
export declare function utf8BytesToString(bytes: ArrayLike<number>): string;
export declare function stringToUtf8Bytes(str: string): Uint8Array;
/** 计算字符串的 MD5（与 Android URLDecoder 后取 UTF-8 MD5 的逻辑对齐） */
export declare function md5(str: string): string;
/**
 * AES-128 加密（CBC / ECB），输入输出均为 base64 字符串（与 Android AES.encrypt 行为对齐）
 * @param dataB64 明文 base64
 * @param keyB64  密钥 base64（128bit）
 * @param ivB64   IV base64（CBC 必填；ECB 传空字符串）
 * @param mode    'AES/CBC/PKCS7Padding' | 'AES'
 */
export declare function aesEncrypt(dataB64: string, keyB64: string, ivB64: string, mode: string): string;
/**
 * RSA 公钥加密（RSA/ECB/NoPadding，PKCS#1 v1.5 类型 2 填充，与 Android RSA 对齐）
 * @param dataB64 明文 base64
 * @param keyPem  公钥 PEM 字符串（去除头尾标记亦可）
 */
export declare function rsaEncrypt(dataB64: string, keyPem: string): string;
export declare function randomBytes(size: number): Uint8Array;
