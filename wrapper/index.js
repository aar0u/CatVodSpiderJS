// !!!!! Do not use in release mode. Just a native inject fake wrapper for test spider. !!!!!
// !!!!! Do not use in release mode. Just a native inject fake wrapper for test spider. !!!!!
// !!!!! Do not use in release mode. Just a native inject fake wrapper for test spider. !!!!!
import crypto from 'node:crypto';
import fs from 'node:fs';
import {dirname} from 'node:path';
import {createRequire} from 'node:module';
import {Uri, _} from '../js/catvod-assets/js/lib/cat.js';

const confs = {};
const PROXY_URL = 'http://127.0.0.1:7890';
const DEFAULT_TIMEOUT = 5000;
const require = createRequire(import.meta.url);
let PROXY_DISPATCHER = null;
let UNDISPATCHER_READY = false;

function initDispatchers() {
    if (UNDISPATCHER_READY) return;

    UNDISPATCHER_READY = true;
    try {
        const {ProxyAgent} = require('undici');
        PROXY_DISPATCHER = new ProxyAgent(PROXY_URL);
    } catch (error) {
        PROXY_DISPATCHER = null;
    }
}

function normalizeHeaders(rawHeaders) {
    const headers = {};
    for (const [key, value] of rawHeaders.entries()) {
        headers[key] = value;
    }
    return headers;
}

function getDispatcher(useProxy) {
    if (!useProxy) return null;

    initDispatchers();
    return PROXY_DISPATCHER;
}

function appendFormUrlEncoded(pairs, key, value) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
        for (const item of value) {
            appendFormUrlEncoded(pairs, `${key}[]`, item);
        }
        return;
    }

    if (typeof value === 'object' && !(value instanceof Date)) {
        for (const [subKey, subValue] of Object.entries(value)) {
            appendFormUrlEncoded(pairs, `${key}[${subKey}]`, subValue);
        }
        return;
    }

    pairs.push([key, String(value)]);
}

function toFormUrlEncoded(data) {
    if (data == null) return '';
    if (typeof data === 'string') return data;

    const pairs = [];
    for (const [key, value] of Object.entries(data || {})) {
        appendFormUrlEncoded(pairs, key, value);
    }

    return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

function appendFormData(formData, key, value) {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
        for (const item of value) {
            appendFormData(formData, `${key}[]`, item);
        }
        return;
    }

    if (value instanceof Uint8Array) {
        formData.append(key, new Blob([value]));
        return;
    }

    if (typeof value === 'object' && !(value instanceof Date)) {
        for (const [subKey, subValue] of Object.entries(value)) {
            appendFormData(formData, `${key}[${subKey}]`, subValue);
        }
        return;
    }

    formData.append(key, String(value));
}

function toFormData(data) {
    if (data == null || data instanceof FormData) return data;
    const formData = new FormData();
    if (typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
            appendFormData(formData, key, value);
        }
        return formData;
    }
    return data;
}

function initLocalStorage(storage) {
    if (!_.has(confs, storage)) {
        if (!fs.existsSync('local')) {
            fs.mkdirSync('local');
        }

        const storagePath = 'local/js_' + storage;

        if (!fs.existsSync(storagePath)) {
            fs.writeFileSync(storagePath, '{}');
            confs[storage] = {};
        } else {
            confs[storage] = JSON.parse(fs.readFileSync(storagePath).toString());
        }
    }
}

function localGet(storage, key) {
    initLocalStorage(storage);
    return _.get(confs[storage], key, '');
}

function localSet(storage, key, value) {
    initLocalStorage(storage);
    confs[storage][key] = value;
    fs.writeFileSync('local/js_' + storage, JSON.stringify(confs[storage]));
}

async function request(url, opt = {}) {
    let timeoutId = null;
    try {
        let data = opt.data || null;
        const postType = opt.postType || null;
        const returnBuffer = opt.buffer || 0;
        const timeout = opt.timeout || DEFAULT_TIMEOUT;
        const redirect = (opt.redirect || 1) === 1;
        const headers = opt.headers || {};

        if (postType == 'form') {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            data = toFormUrlEncoded(data);
        } else if (postType == 'form-data') {
            data = toFormData(data);
        } else if (data != null && !['get', 'head'].includes((opt.method || 'get').toLowerCase())) {
            if (typeof data === 'object' && !(data instanceof Uint8Array)) {
                headers['Content-Type'] = headers['Content-Type'] || 'application/json';
                data = JSON.stringify(data);
            }
        }

        const controller = new AbortController();
        timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);

        const dispatcher = getDispatcher(opt.proxy);
        const requestInit = {
            method: opt.method || 'get',
            headers,
            body: data,
            redirect: redirect ? 'follow' : 'manual',
            signal: controller.signal,
        };
        if (dispatcher) requestInit.dispatcher = dispatcher;

        const response = await fetch(url, requestInit);

        const resHeader = normalizeHeaders(response.headers);

        if (returnBuffer == 3) {
            const stream = opt.stream || {};
            if (stream.onResp) await stream.onResp({code: response.status, headers: resHeader});

            if (stream.onData && response.body) {
                const reader = response.body.getReader();
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    await stream.onData(Buffer.from(value));
                }
            }

            if (stream.onDone) await stream.onDone();
            return 'stream...';
        }

        if (returnBuffer == 1 || returnBuffer == 2) {
            const responseBuffer = Buffer.from(await response.arrayBuffer());
            if (returnBuffer == 1) {
                return {code: response.status, headers: resHeader, content: responseBuffer};
            }
            return {code: response.status, headers: resHeader, content: responseBuffer.toString('base64')};
        }

        const content = await response.text();
        return {code: response.status, headers: resHeader, content};
    } catch (error) {
        if (error.name === 'AbortError') {
            return {headers: {}, content: ''};
        }
        return {headers: {}, content: ''};
    } finally {
        clearTimeout(timeoutId);
    }
}

function base64EncodeBuf(buff, urlsafe = false) {
    return buff.toString(urlsafe ? 'base64url' : 'base64');
}

function base64Encode(text, urlsafe = false) {
    return base64EncodeBuf(Buffer.from(text, 'utf8'), urlsafe);
}

function base64DecodeBuf(text) {
    return Buffer.from(text, 'base64');
}

function base64Decode(text) {
    return base64DecodeBuf(text).toString('utf8');
}

function md5(text) {
    return crypto.createHash('md5').update(Buffer.from(text, 'utf8')).digest('hex');
}

function aes(mode, encrypt, input, inBase64, key, iv, outBase64) {
    if (iv.length == 0) iv = null;
    try {
        if (mode.startsWith('AES/CBC')) {
            switch (key.length) {
                case 16:
                    mode = 'aes-128-cbc';
                    break;
                case 32:
                    mode = 'aes-256-cbc';
                    break;
            }
        } else if (mode.startsWith('AES/ECB')) {
            switch (key.length) {
                case 16:
                    mode = 'aes-128-ecb';
                    break;
                case 32:
                    mode = 'aes-256-ecb';
                    break;
            }
        }
        const inBuf = inBase64 ? base64DecodeBuf(input) : Buffer.from(input, 'utf8');
        let keyBuf = Buffer.from(key);
        if (keyBuf.length < 16) keyBuf = Buffer.concat([keyBuf], 16);
        let ivBuf = iv == null ? Buffer.alloc(0) : Buffer.from(iv);
        if (iv != null && ivBuf.length < 16) ivBuf = Buffer.concat([ivBuf], 16);
        const cipher = encrypt ? crypto.createCipheriv(mode, keyBuf, ivBuf) : crypto.createDecipheriv(mode, keyBuf, ivBuf);
        const outBuf = Buffer.concat([cipher.update(inBuf), cipher.final()]);
        return outBase64 ? base64EncodeBuf(outBuf) : outBuf.toString('utf8');
    } catch (error) {
        console.log(error);
    }
    return '';
}

function des(mode, encrypt, input, inBase64, key, iv, outBase64) {
    try {
        if (mode.startsWith('DESede/CBC')) {
            // https://stackoverflow.com/questions/29831300/convert-desede-ecb-nopadding-algorithm-written-in-java-into-nodejs-using-crypto
            switch (key.length) {
                case 16:
                    mode = 'des-ede-cbc';
                    break;
                case 24:
                    mode = 'des-ede3-cbc';
                    break;
            }
        }
        const inBuf = inBase64 ? base64DecodeBuf(input) : Buffer.from(input, 'utf8');
        let keyBuf = Buffer.from(key);
        if (keyBuf.length < 16) keyBuf = Buffer.concat([keyBuf], 16);
        let ivBuf = iv == null ? Buffer.alloc(0) : Buffer.from(iv);
        if (iv != null && ivBuf.length < 8) ivBuf = Buffer.concat([ivBuf], 8);
        const cipher = encrypt ? crypto.createCipheriv(mode, keyBuf, ivBuf) : crypto.createDecipheriv(mode, keyBuf, ivBuf);
        const outBuf = Buffer.concat([cipher.update(inBuf), cipher.final()]);
        return outBase64 ? base64EncodeBuf(outBuf) : outBuf.toString('utf8');
    } catch (error) {
        console.log(error);
    }
    return '';
}

// pkcs8 only
function rsa(mode, pub, encrypt, input, inBase64, key, outBase64) {
    try {
        let pd = undefined;
        const keyObj = pub ? crypto.createPublicKey(key) : crypto.createPrivateKey(key);
        if (!keyObj.asymmetricKeyDetails || !keyObj.asymmetricKeyDetails.modulusLength) return '';
        const moduleLen = keyObj.asymmetricKeyDetails.modulusLength;
        let blockLen = moduleLen / 8;
        switch (mode) {
            case 'RSA/PKCS1':
                pd = crypto.constants.RSA_PKCS1_PADDING;
                blockLen = encrypt ? blockLen - 11 : blockLen;
                break;
            case 'RSA/None/NoPadding':
                pd = crypto.constants.RSA_NO_PADDING;
                break;
            case 'RSA/None/OAEPPadding':
                pd = crypto.constants.RSA_PKCS1_OAEP_PADDING;
                blockLen = encrypt ? blockLen - 41 : blockLen;
                break;
            default:
                throw Error('not support ' + mode);
        }
        let inBuf = inBase64 ? base64DecodeBuf(input) : Buffer.from(input, 'utf8');
        let bufIdx = 0;
        let outBuf = Buffer.alloc(0);
        while (bufIdx < inBuf.length) {
            const bufEndIdx = Math.min(bufIdx + blockLen, inBuf.length);
            let tmpInBuf = inBuf.subarray(bufIdx, bufEndIdx);
            if (pd == crypto.constants.RSA_NO_PADDING) {
                if (tmpInBuf.length < blockLen) {
                    tmpInBuf = Buffer.concat([Buffer.alloc(128 - tmpInBuf.length), tmpInBuf]);
                }
            }
            let tmpBuf;
            if (pub) {
                tmpBuf = encrypt ? crypto.publicEncrypt({
                    key: keyObj, padding: pd
                }, tmpInBuf) : crypto.publicDecrypt({key: keyObj, padding: pd}, tmpInBuf);
            } else {
                tmpBuf = encrypt ? crypto.privateEncrypt({
                    key: keyObj, padding: pd
                }, tmpInBuf) : crypto.privateDecrypt({key: keyObj, padding: pd}, tmpInBuf);
            }
            bufIdx = bufEndIdx;
            outBuf = Buffer.concat([outBuf, tmpBuf]);
        }
        return outBase64 ? base64EncodeBuf(outBuf) : outBuf.toString('utf8');
    } catch (error) {
        console.log(error);
    }
    return '';
}

var charStr = 'abacdefghjklmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ0123456789';

function randStr(len, withNum) {
    var _str = '';
    let containsNum = withNum === undefined ? true : withNum;
    for (var i = 0; i < len; i++) {
        let idx = _.random(0, containsNum ? charStr.length - 1 : charStr.length - 11);
        _str += charStr[idx];
    }
    return _str;
}

globalThis.local = {
    get: async function (storage, key) {
        return localGet(storage, key);
    }, set: async function (storage, key, val) {
        localSet(storage, key, val);
    },
};

globalThis.md5X = md5;
globalThis.rsaX = rsa;
globalThis.aesX = aes;
globalThis.desX = des;

globalThis.req = request;


/**
 * Constructor for the JSProxyStream class.
 *
 * @constructor
 */
globalThis.JSProxyStream = function () {
    /**
     * Set proxy stream http code & headers
     *
     * @param {Number} code - http status code
     * @param {Map} headers - http response headers
     */
    this.head = async function (code, headers) {
    };
    /**
     * Writes the given buffer.
     *
     * @param {ArrayBuffer} buf - the buffer to write
     * @return {Number} 1 if the write was successful, 0 stream read is paused, -1 strean was closed
     */
    this.write = async function (buf) {
        return 1;
    };
    /**
     * Stream will be closed.
     */
    this.done = async function () {
    };
    /**
     * Stream will be closed cause by error happened.
     */
    this.error = async function (err) {
    };
};


/**
 * Creates a new JSFile object with the specified path.
 *
 * @param {string} path - The path to the file.
 * @return {JSFile} - The JSFile object.
 */
globalThis.JSFile = function (path) {
    this._path = path;
    this.fd = null;
    /**
     * Returns the raw path of the object.
     *
     * @return {string}  The raw path of the file. Runtime path is not same with _path.
     */
    this.path = async function () {
        return this._path;
    };
    /**
     * Opens a file with the specified mode.
     *
     * @param {string} mode - The mode in which to open the file. Can be 'r' for read, 'w' for write, or 'a' for append.
     * @return {boolean} Returns true if the file was successfully opened, false otherwise.
     */
    this.open = async function (mode) {
        const file = this;
        return await new Promise((resolve, reject) => {
            if (mode == 'w' || mode == 'a') {
                const directoryPath = dirname(file._path);
                if (!fs.existsSync(directoryPath)) {
                    fs.mkdirSync(directoryPath, {recursive: true});
                }
            }
            fs.open(file._path, mode, null, (e, f) => {
                if (!e) file.fd = f;
                if (file.fd) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Reads data from a file asynchronously.
     *
     * @param {number} length - The number of bytes to read.
     * @param {number} position - The position in the file to start reading from.
     * @return {ArrayBuffer} The data read from the file.
     */
    this.read = async function (length, position) {
        const file = this;
        return await new Promise((resolve, reject) => {
            let arraybuffer = new ArrayBuffer(length);
            let arr = new Int8Array(arraybuffer);
            fs.read(file.fd, arr, 0, length, position, (err, bytesRead, buffer) => {
                if (length > bytesRead) {
                    arraybuffer = buffer.slice(0, bytesRead).buffer;
                }
                resolve(arraybuffer);
            });
        });
    };

    /**
     * Writes data from an ArrayBuffer to a file at a given position.
     *
     * @param {ArrayBuffer} arraybuffer - The ArrayBuffer containing the data to write.
     * @param {number} position - The position within the file to start writing.
     * @return {boolean} Returns true if the write operation was successful.
     */
    this.write = async function (arraybuffer, position) {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.write(file.fd, new Int8Array(arraybuffer), 0, arraybuffer.byteLength, position, (err, written, buffer) => {
                if (!err) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Flush buffers to disk.
     */
    this.flush = async function () {
        return;
    };

    /**
     * Closes the file descriptor.
     *
     * @return {Promise<void>} A promise that resolves once the file descriptor is closed.
     */
    this.close = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.close(file.fd, (err) => {
                resolve();
            });
        });
    };

    /**
     * Moves the file to a new path.
     *
     * @param {string} newPath - The new path where the file will be moved.
     * @return {Promise<boolean>} A promise that resolves with `true` if the file was successfully moved, otherwise returns false.
     */
    this.move = async function (newPath) {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.rename(file._path, newPath, (err) => {
                if (!err) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Copies the file to a new path.
     *
     * @param {string} newPath - The path of the new location where the file will be copied.
     * @return {Promise<boolean>} A promise that resolves with `true` if the file is successfully copied, and `false` otherwise.
     */
    this.copy = async function (newPath) {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.copyFile(file._path, newPath, (err) => {
                if (!err) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Deletes the file associated with this object.
     *
     */
    this.delete = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.rm(file._path, (err) => {
                resolve();
            });
        });
    };

    /**
     * Checks if the file exists.
     *
     * @return {Promise<boolean>} A promise that resolves to a boolean value indicating whether the file exists or not.
     */
    this.exist = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.exists(file._path, (stat) => {
                resolve(stat);
            });
        });
    };

    /**
     * @returns the file length
     */
    this.size = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.stat(file._path, (err, stat) => {
                if (err) {
                    resolve(0);
                } else {
                    resolve(stat.size);
                }
            });
        });
    };
};

globalThis.js2Proxy = function (dynamic, siteType, site, url, headers) {
    let hd = Object.keys(headers).length == 0 ? '_' : encodeURIComponent(JSON.stringify(headers));
    return (dynamic ? 'js2p://_WEB_/' : 'http://127.0.0.1:13333/jp/') + randStr(6) + '/' + siteType + '/' + site + '/' + hd + '/' + encodeURIComponent(url);
};

export default {};