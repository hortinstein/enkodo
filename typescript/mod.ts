// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function deferred() {
    let methods;
    let state = "pending";
    const promise = new Promise((resolve, reject)=>{
        methods = {
            async resolve (value) {
                await value;
                state = "fulfilled";
                resolve(value);
            },
            reject (reason) {
                state = "rejected";
                reject(reason);
            }
        };
    });
    Object.defineProperty(promise, "state", {
        get: ()=>state
    });
    return Object.assign(promise, methods);
}
class MuxAsyncIterator {
    iteratorCount = 0;
    yields = [];
    throws = [];
    signal = deferred();
    add(iterable) {
        ++this.iteratorCount;
        this.callIteratorNext(iterable[Symbol.asyncIterator]());
    }
    async callIteratorNext(iterator) {
        try {
            const { value , done  } = await iterator.next();
            if (done) {
                --this.iteratorCount;
            } else {
                this.yields.push({
                    iterator,
                    value
                });
            }
        } catch (e) {
            this.throws.push(e);
        }
        this.signal.resolve();
    }
    async *iterate() {
        while(this.iteratorCount > 0){
            await this.signal;
            for(let i = 0; i < this.yields.length; i++){
                const { iterator , value  } = this.yields[i];
                yield value;
                this.callIteratorNext(iterator);
            }
            if (this.throws.length) {
                for (const e of this.throws){
                    throw e;
                }
                this.throws.length = 0;
            }
            this.yields.length = 0;
            this.signal = deferred();
        }
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
}
const noop = ()=>{};
class AsyncIterableClone {
    currentPromise;
    resolveCurrent = noop;
    consumed;
    consume = noop;
    constructor(){
        this.currentPromise = new Promise((resolve)=>{
            this.resolveCurrent = resolve;
        });
        this.consumed = new Promise((resolve)=>{
            this.consume = resolve;
        });
    }
    reset() {
        this.currentPromise = new Promise((resolve)=>{
            this.resolveCurrent = resolve;
        });
        this.consumed = new Promise((resolve)=>{
            this.consume = resolve;
        });
    }
    async next() {
        const res = await this.currentPromise;
        this.consume();
        this.reset();
        return res;
    }
    async push(res) {
        this.resolveCurrent(res);
        await this.consumed;
    }
    [Symbol.asyncIterator]() {
        return this;
    }
}
const { Deno: Deno1  } = globalThis;
const noColor = typeof Deno1?.noColor === "boolean" ? Deno1.noColor : true;
let enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code) {
    return enabled ? `${code.open}${str.replace(code.regexp, code.open)}${code.close}` : str;
}
function bold(str) {
    return run(str, code([
        1
    ], 22));
}
function red(str) {
    return run(str, code([
        31
    ], 39));
}
function green(str) {
    return run(str, code([
        32
    ], 39));
}
function white(str) {
    return run(str, code([
        37
    ], 39));
}
function gray(str) {
    return brightBlack(str);
}
function brightBlack(str) {
    return run(str, code([
        90
    ], 39));
}
function bgRed(str) {
    return run(str, code([
        41
    ], 49));
}
function bgGreen(str) {
    return run(str, code([
        42
    ], 49));
}
const ANSI_PATTERN = new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
].join("|"), "g");
function stripColor(string) {
    return string.replace(ANSI_PATTERN, "");
}
var DiffType;
(function(DiffType) {
    DiffType["removed"] = "removed";
    DiffType["common"] = "common";
    DiffType["added"] = "added";
})(DiffType || (DiffType = {}));
const REMOVED = 1;
const COMMON = 2;
const ADDED = 3;
function createCommon(A, B, reverse) {
    const common = [];
    if (A.length === 0 || B.length === 0) return [];
    for(let i = 0; i < Math.min(A.length, B.length); i += 1){
        if (A[reverse ? A.length - i - 1 : i] === B[reverse ? B.length - i - 1 : i]) {
            common.push(A[reverse ? A.length - i - 1 : i]);
        } else {
            return common;
        }
    }
    return common;
}
function diff(A, B) {
    const prefixCommon = createCommon(A, B);
    const suffixCommon = createCommon(A.slice(prefixCommon.length), B.slice(prefixCommon.length), true).reverse();
    A = suffixCommon.length ? A.slice(prefixCommon.length, -suffixCommon.length) : A.slice(prefixCommon.length);
    B = suffixCommon.length ? B.slice(prefixCommon.length, -suffixCommon.length) : B.slice(prefixCommon.length);
    const swapped = B.length > A.length;
    [A, B] = swapped ? [
        B,
        A
    ] : [
        A,
        B
    ];
    const M = A.length;
    const N = B.length;
    if (!M && !N && !suffixCommon.length && !prefixCommon.length) return [];
    if (!N) {
        return [
            ...prefixCommon.map((c)=>({
                    type: DiffType.common,
                    value: c
                })),
            ...A.map((a)=>({
                    type: swapped ? DiffType.added : DiffType.removed,
                    value: a
                })),
            ...suffixCommon.map((c)=>({
                    type: DiffType.common,
                    value: c
                }))
        ];
    }
    const offset = N;
    const delta = M - N;
    const size = M + N + 1;
    const fp = new Array(size).fill({
        y: -1
    });
    const routes = new Uint32Array((M * N + size + 1) * 2);
    const diffTypesPtrOffset = routes.length / 2;
    let ptr = 0;
    let p = -1;
    function backTrace(A, B, current, swapped) {
        const M = A.length;
        const N = B.length;
        const result = [];
        let a = M - 1;
        let b = N - 1;
        let j = routes[current.id];
        let type = routes[current.id + diffTypesPtrOffset];
        while(true){
            if (!j && !type) break;
            const prev = j;
            if (type === 1) {
                result.unshift({
                    type: swapped ? DiffType.removed : DiffType.added,
                    value: B[b]
                });
                b -= 1;
            } else if (type === 3) {
                result.unshift({
                    type: swapped ? DiffType.added : DiffType.removed,
                    value: A[a]
                });
                a -= 1;
            } else {
                result.unshift({
                    type: DiffType.common,
                    value: A[a]
                });
                a -= 1;
                b -= 1;
            }
            j = routes[prev];
            type = routes[prev + diffTypesPtrOffset];
        }
        return result;
    }
    function createFP(slide, down, k, M) {
        if (slide && slide.y === -1 && down && down.y === -1) {
            return {
                y: 0,
                id: 0
            };
        }
        if (down && down.y === -1 || k === M || (slide && slide.y) > (down && down.y) + 1) {
            const prev = slide.id;
            ptr++;
            routes[ptr] = prev;
            routes[ptr + diffTypesPtrOffset] = ADDED;
            return {
                y: slide.y,
                id: ptr
            };
        } else {
            const prev1 = down.id;
            ptr++;
            routes[ptr] = prev1;
            routes[ptr + diffTypesPtrOffset] = REMOVED;
            return {
                y: down.y + 1,
                id: ptr
            };
        }
    }
    function snake(k, slide, down, _offset, A, B) {
        const M = A.length;
        const N = B.length;
        if (k < -N || M < k) return {
            y: -1,
            id: -1
        };
        const fp = createFP(slide, down, k, M);
        while(fp.y + k < M && fp.y < N && A[fp.y + k] === B[fp.y]){
            const prev = fp.id;
            ptr++;
            fp.id = ptr;
            fp.y += 1;
            routes[ptr] = prev;
            routes[ptr + diffTypesPtrOffset] = COMMON;
        }
        return fp;
    }
    while(fp[delta + offset].y < N){
        p = p + 1;
        for(let k = -p; k < delta; ++k){
            fp[k + offset] = snake(k, fp[k - 1 + offset], fp[k + 1 + offset], offset, A, B);
        }
        for(let k1 = delta + p; k1 > delta; --k1){
            fp[k1 + offset] = snake(k1, fp[k1 - 1 + offset], fp[k1 + 1 + offset], offset, A, B);
        }
        fp[delta + offset] = snake(delta, fp[delta - 1 + offset], fp[delta + 1 + offset], offset, A, B);
    }
    return [
        ...prefixCommon.map((c)=>({
                type: DiffType.common,
                value: c
            })),
        ...backTrace(A, B, fp[delta + offset], swapped),
        ...suffixCommon.map((c)=>({
                type: DiffType.common,
                value: c
            }))
    ];
}
function diffstr(A, B) {
    function tokenize(string, { wordDiff =false  } = {}) {
        if (wordDiff) {
            const tokens = string.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/);
            const words = /^[a-zA-Z\u{C0}-\u{FF}\u{D8}-\u{F6}\u{F8}-\u{2C6}\u{2C8}-\u{2D7}\u{2DE}-\u{2FF}\u{1E00}-\u{1EFF}]+$/u;
            for(let i = 0; i < tokens.length - 1; i++){
                if (!tokens[i + 1] && tokens[i + 2] && words.test(tokens[i]) && words.test(tokens[i + 2])) {
                    tokens[i] += tokens[i + 2];
                    tokens.splice(i + 1, 2);
                    i--;
                }
            }
            return tokens.filter((token)=>token);
        } else {
            const tokens1 = [], lines = string.split(/(\n|\r\n)/);
            if (!lines[lines.length - 1]) {
                lines.pop();
            }
            for(let i1 = 0; i1 < lines.length; i1++){
                if (i1 % 2) {
                    tokens1[tokens1.length - 1] += lines[i1];
                } else {
                    tokens1.push(lines[i1]);
                }
            }
            return tokens1;
        }
    }
    function createDetails(line, tokens) {
        return tokens.filter(({ type  })=>type === line.type || type === DiffType.common).map((result, i, t)=>{
            if (result.type === DiffType.common && t[i - 1] && t[i - 1]?.type === t[i + 1]?.type && /\s+/.test(result.value)) {
                result.type = t[i - 1].type;
            }
            return result;
        });
    }
    const diffResult = diff(tokenize(`${A}\n`), tokenize(`${B}\n`));
    const added = [], removed = [];
    for (const result of diffResult){
        if (result.type === DiffType.added) {
            added.push(result);
        }
        if (result.type === DiffType.removed) {
            removed.push(result);
        }
    }
    const aLines = added.length < removed.length ? added : removed;
    const bLines = aLines === removed ? added : removed;
    for (const a of aLines){
        let tokens = [], b;
        while(bLines.length){
            b = bLines.shift();
            tokens = diff(tokenize(a.value, {
                wordDiff: true
            }), tokenize(b?.value ?? "", {
                wordDiff: true
            }));
            if (tokens.some(({ type , value  })=>type === DiffType.common && value.trim().length)) {
                break;
            }
        }
        a.details = createDetails(a, tokens);
        if (b) {
            b.details = createDetails(b, tokens);
        }
    }
    return diffResult;
}
const CAN_NOT_DISPLAY = "[Cannot display]";
class AssertionError extends Error {
    constructor(message){
        super(message);
        this.name = "AssertionError";
    }
}
function _format(v) {
    const { Deno: Deno1  } = globalThis;
    return typeof Deno1?.inspect === "function" ? Deno1.inspect(v, {
        depth: Infinity,
        sorted: true,
        trailingComma: true,
        compact: false,
        iterableLimit: Infinity
    }) : `"${String(v).replace(/(?=["\\])/g, "\\")}"`;
}
function createColor(diffType, { background =false  } = {}) {
    switch(diffType){
        case DiffType.added:
            return (s)=>background ? bgGreen(white(s)) : green(bold(s));
        case DiffType.removed:
            return (s)=>background ? bgRed(white(s)) : red(bold(s));
        default:
            return white;
    }
}
function createSign(diffType) {
    switch(diffType){
        case DiffType.added:
            return "+   ";
        case DiffType.removed:
            return "-   ";
        default:
            return "    ";
    }
}
function buildMessage(diffResult, { stringDiff =false  } = {}) {
    const messages = [], diffMessages = [];
    messages.push("");
    messages.push("");
    messages.push(`    ${gray(bold("[Diff]"))} ${red(bold("Actual"))} / ${green(bold("Expected"))}`);
    messages.push("");
    messages.push("");
    diffResult.forEach((result)=>{
        const c = createColor(result.type);
        const line = result.details?.map((detail)=>detail.type !== DiffType.common ? createColor(detail.type, {
                background: true
            })(detail.value) : detail.value).join("") ?? result.value;
        diffMessages.push(c(`${createSign(result.type)}${line}`));
    });
    messages.push(...stringDiff ? [
        diffMessages.join("")
    ] : diffMessages);
    messages.push("");
    return messages;
}
function isKeyedCollection(x) {
    return [
        Symbol.iterator,
        "size"
    ].every((k)=>k in x);
}
function equal(c, d) {
    const seen = new Map();
    return function compare(a, b) {
        if (a && b && (a instanceof RegExp && b instanceof RegExp || a instanceof URL && b instanceof URL)) {
            return String(a) === String(b);
        }
        if (a instanceof Date && b instanceof Date) {
            const aTime = a.getTime();
            const bTime = b.getTime();
            if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
                return true;
            }
            return a.getTime() === b.getTime();
        }
        if (Object.is(a, b)) {
            return true;
        }
        if (a && typeof a === "object" && b && typeof b === "object") {
            if (a && b && a.constructor !== b.constructor) {
                return false;
            }
            if (a instanceof WeakMap || b instanceof WeakMap) {
                if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
                throw new TypeError("cannot compare WeakMap instances");
            }
            if (a instanceof WeakSet || b instanceof WeakSet) {
                if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
                throw new TypeError("cannot compare WeakSet instances");
            }
            if (seen.get(a) === b) {
                return true;
            }
            if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
                return false;
            }
            if (isKeyedCollection(a) && isKeyedCollection(b)) {
                if (a.size !== b.size) {
                    return false;
                }
                let unmatchedEntries = a.size;
                for (const [aKey, aValue] of a.entries()){
                    for (const [bKey, bValue] of b.entries()){
                        if (aKey === aValue && bKey === bValue && compare(aKey, bKey) || compare(aKey, bKey) && compare(aValue, bValue)) {
                            unmatchedEntries--;
                        }
                    }
                }
                return unmatchedEntries === 0;
            }
            const merged = {
                ...a,
                ...b
            };
            for (const key of [
                ...Object.getOwnPropertyNames(merged),
                ...Object.getOwnPropertySymbols(merged)
            ]){
                if (!compare(a && a[key], b && b[key])) {
                    return false;
                }
                if (key in a && !(key in b) || key in b && !(key in a)) {
                    return false;
                }
            }
            seen.set(a, b);
            if (a instanceof WeakRef || b instanceof WeakRef) {
                if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
                return compare(a.deref(), b.deref());
            }
            return true;
        }
        return false;
    }(c, d);
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new AssertionError(msg);
    }
}
function assertEquals(actual, expected, msg) {
    if (equal(actual, expected)) {
        return;
    }
    let message = "";
    const actualString = _format(actual);
    const expectedString = _format(expected);
    try {
        const stringDiff = typeof actual === "string" && typeof expected === "string";
        const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, {
            stringDiff
        }).join("\n");
        message = `Values are not equal:\n${diffMsg}`;
    } catch  {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
    }
    if (msg) {
        message = msg;
    }
    throw new AssertionError(message);
}
function assertNotEquals(actual, expected, msg) {
    if (!equal(actual, expected)) {
        return;
    }
    let actualString;
    let expectedString;
    try {
        actualString = String(actual);
    } catch  {
        actualString = "[Cannot display]";
    }
    try {
        expectedString = String(expected);
    } catch  {
        expectedString = "[Cannot display]";
    }
    if (!msg) {
        msg = `actual: ${actualString} expected: ${expectedString}`;
    }
    throw new AssertionError(msg);
}
function assertStrictEquals(actual, expected, msg) {
    if (actual === expected) {
        return;
    }
    let message;
    if (msg) {
        message = msg;
    } else {
        const actualString = _format(actual);
        const expectedString = _format(expected);
        if (actualString === expectedString) {
            const withOffset = actualString.split("\n").map((l)=>`    ${l}`).join("\n");
            message = `Values have the same structure but are not reference-equal:\n\n${red(withOffset)}\n`;
        } else {
            try {
                const stringDiff = typeof actual === "string" && typeof expected === "string";
                const diffResult = stringDiff ? diffstr(actual, expected) : diff(actualString.split("\n"), expectedString.split("\n"));
                const diffMsg = buildMessage(diffResult, {
                    stringDiff
                }).join("\n");
                message = `Values are not strictly equal:\n${diffMsg}`;
            } catch  {
                message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
            }
        }
    }
    throw new AssertionError(message);
}
function assertNotStrictEquals(actual, expected, msg) {
    if (actual !== expected) {
        return;
    }
    throw new AssertionError(msg ?? `Expected "actual" to be strictly unequal to: ${_format(actual)}\n`);
}
function assertMatch(actual, expected, msg) {
    if (!expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
function assertNotMatch(actual, expected, msg) {
    if (expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
function unreachable() {
    throw new AssertionError("unreachable");
}
class DenoStdInternalError extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert1(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
function concat(...buf) {
    let length = 0;
    for (const b of buf){
        length += b.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const b1 of buf){
        output.set(b1, index);
        index += b1.length;
    }
    return output;
}
function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
async function writeAll(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += await w.write(arr.subarray(nwritten));
    }
}
function writeAllSync(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
function notImplemented(msg) {
    const message = msg ? `Not implemented: ${msg}` : "Not implemented";
    throw new Error(message);
}
const _TextDecoder = TextDecoder;
const _TextEncoder = TextEncoder;
function intoCallbackAPIWithIntercept(func, interceptor, cb, ...args) {
    func(...args).then((value)=>cb && cb(null, interceptor(value)), (err)=>cb && cb(err));
}
function normalizeEncoding(enc) {
    if (enc == null || enc === "utf8" || enc === "utf-8") return "utf8";
    return slowCases(enc);
}
function slowCases(enc) {
    switch(enc.length){
        case 4:
            if (enc === "UTF8") return "utf8";
            if (enc === "ucs2" || enc === "UCS2") return "utf16le";
            enc = `${enc}`.toLowerCase();
            if (enc === "utf8") return "utf8";
            if (enc === "ucs2") return "utf16le";
            break;
        case 3:
            if (enc === "hex" || enc === "HEX" || `${enc}`.toLowerCase() === "hex") {
                return "hex";
            }
            break;
        case 5:
            if (enc === "ascii") return "ascii";
            if (enc === "ucs-2") return "utf16le";
            if (enc === "UTF-8") return "utf8";
            if (enc === "ASCII") return "ascii";
            if (enc === "UCS-2") return "utf16le";
            enc = `${enc}`.toLowerCase();
            if (enc === "utf-8") return "utf8";
            if (enc === "ascii") return "ascii";
            if (enc === "ucs-2") return "utf16le";
            break;
        case 6:
            if (enc === "base64") return "base64";
            if (enc === "latin1" || enc === "binary") return "latin1";
            if (enc === "BASE64") return "base64";
            if (enc === "LATIN1" || enc === "BINARY") return "latin1";
            enc = `${enc}`.toLowerCase();
            if (enc === "base64") return "base64";
            if (enc === "latin1" || enc === "binary") return "latin1";
            break;
        case 7:
            if (enc === "utf16le" || enc === "UTF16LE" || `${enc}`.toLowerCase() === "utf16le") {
                return "utf16le";
            }
            break;
        case 8:
            if (enc === "utf-16le" || enc === "UTF-16LE" || `${enc}`.toLowerCase() === "utf-16le") {
                return "utf16le";
            }
            break;
        default:
            if (enc === "") return "utf8";
    }
}
function validateIntegerRange(value, name, min = -2147483648, max = 2147483647) {
    if (!Number.isInteger(value)) {
        throw new Error(`${name} must be 'an integer' but was ${value}`);
    }
    if (value < min || value > max) {
        throw new Error(`${name} must be >= ${min} && <= ${max}. Value was ${value}`);
    }
}
function once(callback) {
    let called = false;
    return function(...args) {
        if (called) return;
        called = true;
        callback.apply(this, args);
    };
}
const kCustomPromisifiedSymbol = Symbol.for("nodejs.util.promisify.custom");
const kCustomPromisifyArgsSymbol = Symbol.for("nodejs.util.promisify.customArgs");
class NodeInvalidArgTypeError extends TypeError {
    code = "ERR_INVALID_ARG_TYPE";
    constructor(argumentName, type, received){
        super(`The "${argumentName}" argument must be of type ${type}. Received ${typeof received}`);
    }
}
function promisify(original) {
    if (typeof original !== "function") {
        throw new NodeInvalidArgTypeError("original", "Function", original);
    }
    if (original[kCustomPromisifiedSymbol]) {
        const fn = original[kCustomPromisifiedSymbol];
        if (typeof fn !== "function") {
            throw new NodeInvalidArgTypeError("util.promisify.custom", "Function", fn);
        }
        return Object.defineProperty(fn, kCustomPromisifiedSymbol, {
            value: fn,
            enumerable: false,
            writable: false,
            configurable: true
        });
    }
    const argumentNames = original[kCustomPromisifyArgsSymbol];
    function fn1(...args) {
        return new Promise((resolve, reject)=>{
            original.call(this, ...args, (err, ...values)=>{
                if (err) {
                    return reject(err);
                }
                if (argumentNames !== undefined && values.length > 1) {
                    const obj = {};
                    for(let i = 0; i < argumentNames.length; i++){
                        obj[argumentNames[i]] = values[i];
                    }
                    resolve(obj);
                } else {
                    resolve(values[0]);
                }
            });
        });
    }
    Object.setPrototypeOf(fn1, Object.getPrototypeOf(original));
    Object.defineProperty(fn1, kCustomPromisifiedSymbol, {
        value: fn1,
        enumerable: false,
        writable: false,
        configurable: true
    });
    return Object.defineProperties(fn1, Object.getOwnPropertyDescriptors(original));
}
promisify.custom = kCustomPromisifiedSymbol;
class NodeFalsyValueRejectionError extends Error {
    reason;
    code = "ERR_FALSY_VALUE_REJECTION";
    constructor(reason){
        super("Promise was rejected with falsy value");
        this.reason = reason;
    }
}
class NodeInvalidArgTypeError1 extends TypeError {
    code = "ERR_INVALID_ARG_TYPE";
    constructor(argumentName){
        super(`The ${argumentName} argument must be of type function.`);
    }
}
function callbackify(original) {
    if (typeof original !== "function") {
        throw new NodeInvalidArgTypeError1('"original"');
    }
    const callbackified = function(...args) {
        const maybeCb = args.pop();
        if (typeof maybeCb !== "function") {
            throw new NodeInvalidArgTypeError1("last");
        }
        const cb = (...args)=>{
            maybeCb.apply(this, args);
        };
        original.apply(this, args).then((ret)=>{
            queueMicrotask(cb.bind(this, null, ret));
        }, (rej)=>{
            rej = rej || new NodeFalsyValueRejectionError(rej);
            queueMicrotask(cb.bind(this, rej));
        });
    };
    const descriptors = Object.getOwnPropertyDescriptors(original);
    if (typeof descriptors.length.value === "number") {
        descriptors.length.value++;
    }
    if (typeof descriptors.name.value === "string") {
        descriptors.name.value += "Callbackified";
    }
    Object.defineProperties(callbackified, descriptors);
    return callbackified;
}
const _toString = Object.prototype.toString;
const _isObjectLike = (value)=>value !== null && typeof value === "object";
const _isFunctionLike = (value)=>value !== null && typeof value === "function";
function isAnyArrayBuffer(value) {
    return _isObjectLike(value) && (_toString.call(value) === "[object ArrayBuffer]" || _toString.call(value) === "[object SharedArrayBuffer]");
}
function isArrayBufferView(value) {
    return ArrayBuffer.isView(value);
}
function isArgumentsObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Arguments]";
}
function isArrayBuffer(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object ArrayBuffer]";
}
function isAsyncFunction(value) {
    return _isFunctionLike(value) && _toString.call(value) === "[object AsyncFunction]";
}
function isBigInt64Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object BigInt64Array]";
}
function isBigUint64Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object BigUint64Array]";
}
function isBooleanObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Boolean]";
}
function isBoxedPrimitive(value) {
    return isBooleanObject(value) || isStringObject(value) || isNumberObject(value) || isSymbolObject(value) || isBigIntObject(value);
}
function isDataView(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object DataView]";
}
function isDate(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Date]";
}
function isFloat32Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Float32Array]";
}
function isFloat64Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Float64Array]";
}
function isGeneratorFunction(value) {
    return _isFunctionLike(value) && _toString.call(value) === "[object GeneratorFunction]";
}
function isGeneratorObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Generator]";
}
function isInt8Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Int8Array]";
}
function isInt16Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Int16Array]";
}
function isInt32Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Int32Array]";
}
function isMap(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Map]";
}
function isMapIterator(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Map Iterator]";
}
function isModuleNamespaceObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Module]";
}
function isNativeError(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Error]";
}
function isNumberObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Number]";
}
function isBigIntObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object BigInt]";
}
function isPromise(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Promise]";
}
function isRegExp(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object RegExp]";
}
function isSet(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Set]";
}
function isSetIterator(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Set Iterator]";
}
function isSharedArrayBuffer(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object SharedArrayBuffer]";
}
function isStringObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object String]";
}
function isSymbolObject(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Symbol]";
}
function isTypedArray(value) {
    const reTypedTag = /^\[object (?:Float(?:32|64)|(?:Int|Uint)(?:8|16|32)|Uint8Clamped)Array\]$/;
    return _isObjectLike(value) && reTypedTag.test(_toString.call(value));
}
function isUint8Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Uint8Array]";
}
function isUint8ClampedArray(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Uint8ClampedArray]";
}
function isUint16Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Uint16Array]";
}
function isUint32Array(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object Uint32Array]";
}
function isWeakMap(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object WeakMap]";
}
function isWeakSet(value) {
    return _isObjectLike(value) && _toString.call(value) === "[object WeakSet]";
}
const mod = {
    isAnyArrayBuffer: isAnyArrayBuffer,
    isArrayBufferView: isArrayBufferView,
    isArgumentsObject: isArgumentsObject,
    isArrayBuffer: isArrayBuffer,
    isAsyncFunction: isAsyncFunction,
    isBigInt64Array: isBigInt64Array,
    isBigUint64Array: isBigUint64Array,
    isBooleanObject: isBooleanObject,
    isBoxedPrimitive: isBoxedPrimitive,
    isDataView: isDataView,
    isDate: isDate,
    isFloat32Array: isFloat32Array,
    isFloat64Array: isFloat64Array,
    isGeneratorFunction: isGeneratorFunction,
    isGeneratorObject: isGeneratorObject,
    isInt8Array: isInt8Array,
    isInt16Array: isInt16Array,
    isInt32Array: isInt32Array,
    isMap: isMap,
    isMapIterator: isMapIterator,
    isModuleNamespaceObject: isModuleNamespaceObject,
    isNativeError: isNativeError,
    isNumberObject: isNumberObject,
    isBigIntObject: isBigIntObject,
    isPromise: isPromise,
    isRegExp: isRegExp,
    isSet: isSet,
    isSetIterator: isSetIterator,
    isSharedArrayBuffer: isSharedArrayBuffer,
    isStringObject: isStringObject,
    isSymbolObject: isSymbolObject,
    isTypedArray: isTypedArray,
    isUint8Array: isUint8Array,
    isUint8ClampedArray: isUint8ClampedArray,
    isUint16Array: isUint16Array,
    isUint32Array: isUint32Array,
    isWeakMap: isWeakMap,
    isWeakSet: isWeakSet
};
const classRegExp = /^([A-Z][a-z0-9]*)+$/;
const kTypes = [
    "string",
    "function",
    "number",
    "object",
    "Function",
    "Object",
    "boolean",
    "bigint",
    "symbol"
];
class NodeErrorAbstraction extends Error {
    code;
    constructor(name, code, message){
        super(message);
        this.code = code;
        this.name = name;
        this.stack = this.stack && `${name} [${this.code}]${this.stack.slice(20)}`;
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
}
class NodeError extends NodeErrorAbstraction {
    constructor(code, message){
        super(Error.prototype.name, code, message);
    }
}
class NodeTypeError extends NodeErrorAbstraction {
    constructor(code, message){
        super(TypeError.prototype.name, code, message);
        Object.setPrototypeOf(this, TypeError.prototype);
    }
}
class ERR_INVALID_ARG_TYPE extends NodeTypeError {
    constructor(name, expected, actual){
        expected = Array.isArray(expected) ? expected : [
            expected
        ];
        let msg = "The ";
        if (name.endsWith(" argument")) {
            msg += `${name} `;
        } else {
            const type = name.includes(".") ? "property" : "argument";
            msg += `"${name}" ${type} `;
        }
        msg += "must be ";
        const types = [];
        const instances = [];
        const other = [];
        for (const value of expected){
            if (kTypes.includes(value)) {
                types.push(value.toLocaleLowerCase());
            } else if (classRegExp.test(value)) {
                instances.push(value);
            } else {
                other.push(value);
            }
        }
        if (instances.length > 0) {
            const pos = types.indexOf("object");
            if (pos !== -1) {
                types.splice(pos, 1);
                instances.push("Object");
            }
        }
        if (types.length > 0) {
            if (types.length > 2) {
                const last = types.pop();
                msg += `one of type ${types.join(", ")}, or ${last}`;
            } else if (types.length === 2) {
                msg += `one of type ${types[0]} or ${types[1]}`;
            } else {
                msg += `of type ${types[0]}`;
            }
            if (instances.length > 0 || other.length > 0) {
                msg += " or ";
            }
        }
        if (instances.length > 0) {
            if (instances.length > 2) {
                const last1 = instances.pop();
                msg += `an instance of ${instances.join(", ")}, or ${last1}`;
            } else {
                msg += `an instance of ${instances[0]}`;
                if (instances.length === 2) {
                    msg += ` or ${instances[1]}`;
                }
            }
            if (other.length > 0) {
                msg += " or ";
            }
        }
        if (other.length > 0) {
            if (other.length > 2) {
                const last2 = other.pop();
                msg += `one of ${other.join(", ")}, or ${last2}`;
            } else if (other.length === 2) {
                msg += `one of ${other[0]} or ${other[1]}`;
            } else {
                if (other[0].toLowerCase() !== other[0]) {
                    msg += "an ";
                }
                msg += `${other[0]}`;
            }
        }
        super("ERR_INVALID_ARG_TYPE", `${msg}.${invalidArgTypeHelper(actual)}`);
    }
}
const NumberIsSafeInteger = Number.isSafeInteger;
const DEFAULT_INSPECT_OPTIONS = {
    showHidden: false,
    depth: 2,
    colors: false,
    customInspect: true,
    showProxy: false,
    maxArrayLength: 100,
    maxStringLength: Infinity,
    breakLength: 80,
    compact: 3,
    sorted: false,
    getters: false
};
inspect.defaultOptions = DEFAULT_INSPECT_OPTIONS;
inspect.custom = Symbol.for("Deno.customInspect");
function inspect(object, ...opts) {
    if (typeof object === "string" && !object.includes("'")) {
        return `'${object}'`;
    }
    opts = {
        ...DEFAULT_INSPECT_OPTIONS,
        ...opts
    };
    return Deno.inspect(object, {
        depth: opts.depth,
        iterableLimit: opts.maxArrayLength,
        compact: !!opts.compact,
        sorted: !!opts.sorted,
        showProxy: !!opts.showProxy
    });
}
function isArray(value) {
    return Array.isArray(value);
}
function isBoolean(value) {
    return typeof value === "boolean" || value instanceof Boolean;
}
function isNull(value) {
    return value === null;
}
function isNullOrUndefined(value) {
    return value === null || value === undefined;
}
function isNumber(value) {
    return typeof value === "number" || value instanceof Number;
}
function isString(value) {
    return typeof value === "string" || value instanceof String;
}
function isSymbol(value) {
    return typeof value === "symbol";
}
function isUndefined(value) {
    return value === undefined;
}
function isObject(value) {
    return value !== null && typeof value === "object";
}
function isError(e) {
    return e instanceof Error;
}
function isFunction(value) {
    return typeof value === "function";
}
function isRegExp1(value) {
    return value instanceof RegExp;
}
function isPrimitive(value) {
    return value === null || typeof value !== "object" && typeof value !== "function";
}
class ERR_INVALID_ARG_VALUE extends NodeTypeError {
    constructor(name, value, reason){
        super("ERR_INVALID_ARG_VALUE", `The argument '${name}' ${reason}. Received ${inspect(value)}`);
    }
}
function invalidArgTypeHelper(input) {
    if (input == null) {
        return ` Received ${input}`;
    }
    if (typeof input === "function" && input.name) {
        return ` Received function ${input.name}`;
    }
    if (typeof input === "object") {
        if (input.constructor && input.constructor.name) {
            return ` Received an instance of ${input.constructor.name}`;
        }
        return ` Received ${inspect(input, {
            depth: -1
        })}`;
    }
    let inspected = inspect(input, {
        colors: false
    });
    if (inspected.length > 25) {
        inspected = `${inspected.slice(0, 25)}...`;
    }
    return ` Received type ${typeof input} (${inspected})`;
}
class ERR_OUT_OF_RANGE extends RangeError {
    code = "ERR_OUT_OF_RANGE";
    constructor(str, range, received){
        super(`The value of "${str}" is out of range. It must be ${range}. Received ${received}`);
        const { name  } = this;
        this.name = `${name} [${this.code}]`;
        this.stack;
        this.name = name;
    }
}
class ERR_AMBIGUOUS_ARGUMENT extends NodeTypeError {
    constructor(x, y){
        super("ERR_AMBIGUOUS_ARGUMENT", `The "${x}" argument is ambiguous. ${y}`);
    }
}
const windows = [
    [
        -4093,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -4092,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -4091,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -4090,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -4089,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -4088,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -4084,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -4083,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -4082,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -4081,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -4079,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -4078,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -4077,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -4076,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -4075,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -4074,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -4036,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -4073,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4072,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -4071,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -4070,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -4069,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -4068,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -4067,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -4066,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -4065,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -4064,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -4063,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -4062,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -4061,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -4060,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -4059,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -4058,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -4057,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -4056,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -4035,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -4055,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -4054,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -4053,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -4052,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -4051,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -4050,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -4049,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -4048,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -4047,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -4046,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -4045,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -4044,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -4034,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -4043,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -4042,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -4041,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -4040,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -4039,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -4038,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -4037,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -4033,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -4032,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -4031,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -4030,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -4029,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -4028,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -4027,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ]
];
const darwin = [
    [
        -7,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -13,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -48,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -49,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -47,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -35,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -37,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -9,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -16,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -89,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -53,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -61,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -54,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -39,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -17,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -14,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -27,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -65,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -22,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -5,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -56,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -21,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -62,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -24,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -40,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -63,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -50,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -51,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -23,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -55,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -19,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -2,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -12,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -4056,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -42,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -28,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -78,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -57,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -20,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -66,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -38,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -45,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -1,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -32,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -100,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -43,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -41,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -34,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -30,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -58,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -29,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -3,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -60,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -26,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -18,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -6,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -31,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -64,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -4030,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -25,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -79,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -92,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ]
];
const linux = [
    [
        -7,
        [
            "E2BIG",
            "argument list too long"
        ]
    ],
    [
        -13,
        [
            "EACCES",
            "permission denied"
        ]
    ],
    [
        -98,
        [
            "EADDRINUSE",
            "address already in use"
        ]
    ],
    [
        -99,
        [
            "EADDRNOTAVAIL",
            "address not available"
        ]
    ],
    [
        -97,
        [
            "EAFNOSUPPORT",
            "address family not supported"
        ]
    ],
    [
        -11,
        [
            "EAGAIN",
            "resource temporarily unavailable"
        ]
    ],
    [
        -3000,
        [
            "EAI_ADDRFAMILY",
            "address family not supported"
        ]
    ],
    [
        -3001,
        [
            "EAI_AGAIN",
            "temporary failure"
        ]
    ],
    [
        -3002,
        [
            "EAI_BADFLAGS",
            "bad ai_flags value"
        ]
    ],
    [
        -3013,
        [
            "EAI_BADHINTS",
            "invalid value for hints"
        ]
    ],
    [
        -3003,
        [
            "EAI_CANCELED",
            "request canceled"
        ]
    ],
    [
        -3004,
        [
            "EAI_FAIL",
            "permanent failure"
        ]
    ],
    [
        -3005,
        [
            "EAI_FAMILY",
            "ai_family not supported"
        ]
    ],
    [
        -3006,
        [
            "EAI_MEMORY",
            "out of memory"
        ]
    ],
    [
        -3007,
        [
            "EAI_NODATA",
            "no address"
        ]
    ],
    [
        -3008,
        [
            "EAI_NONAME",
            "unknown node or service"
        ]
    ],
    [
        -3009,
        [
            "EAI_OVERFLOW",
            "argument buffer overflow"
        ]
    ],
    [
        -3014,
        [
            "EAI_PROTOCOL",
            "resolved protocol is unknown"
        ]
    ],
    [
        -3010,
        [
            "EAI_SERVICE",
            "service not available for socket type"
        ]
    ],
    [
        -3011,
        [
            "EAI_SOCKTYPE",
            "socket type not supported"
        ]
    ],
    [
        -114,
        [
            "EALREADY",
            "connection already in progress"
        ]
    ],
    [
        -9,
        [
            "EBADF",
            "bad file descriptor"
        ]
    ],
    [
        -16,
        [
            "EBUSY",
            "resource busy or locked"
        ]
    ],
    [
        -125,
        [
            "ECANCELED",
            "operation canceled"
        ]
    ],
    [
        -4080,
        [
            "ECHARSET",
            "invalid Unicode character"
        ]
    ],
    [
        -103,
        [
            "ECONNABORTED",
            "software caused connection abort"
        ]
    ],
    [
        -111,
        [
            "ECONNREFUSED",
            "connection refused"
        ]
    ],
    [
        -104,
        [
            "ECONNRESET",
            "connection reset by peer"
        ]
    ],
    [
        -89,
        [
            "EDESTADDRREQ",
            "destination address required"
        ]
    ],
    [
        -17,
        [
            "EEXIST",
            "file already exists"
        ]
    ],
    [
        -14,
        [
            "EFAULT",
            "bad address in system call argument"
        ]
    ],
    [
        -27,
        [
            "EFBIG",
            "file too large"
        ]
    ],
    [
        -113,
        [
            "EHOSTUNREACH",
            "host is unreachable"
        ]
    ],
    [
        -4,
        [
            "EINTR",
            "interrupted system call"
        ]
    ],
    [
        -22,
        [
            "EINVAL",
            "invalid argument"
        ]
    ],
    [
        -5,
        [
            "EIO",
            "i/o error"
        ]
    ],
    [
        -106,
        [
            "EISCONN",
            "socket is already connected"
        ]
    ],
    [
        -21,
        [
            "EISDIR",
            "illegal operation on a directory"
        ]
    ],
    [
        -40,
        [
            "ELOOP",
            "too many symbolic links encountered"
        ]
    ],
    [
        -24,
        [
            "EMFILE",
            "too many open files"
        ]
    ],
    [
        -90,
        [
            "EMSGSIZE",
            "message too long"
        ]
    ],
    [
        -36,
        [
            "ENAMETOOLONG",
            "name too long"
        ]
    ],
    [
        -100,
        [
            "ENETDOWN",
            "network is down"
        ]
    ],
    [
        -101,
        [
            "ENETUNREACH",
            "network is unreachable"
        ]
    ],
    [
        -23,
        [
            "ENFILE",
            "file table overflow"
        ]
    ],
    [
        -105,
        [
            "ENOBUFS",
            "no buffer space available"
        ]
    ],
    [
        -19,
        [
            "ENODEV",
            "no such device"
        ]
    ],
    [
        -2,
        [
            "ENOENT",
            "no such file or directory"
        ]
    ],
    [
        -12,
        [
            "ENOMEM",
            "not enough memory"
        ]
    ],
    [
        -64,
        [
            "ENONET",
            "machine is not on the network"
        ]
    ],
    [
        -92,
        [
            "ENOPROTOOPT",
            "protocol not available"
        ]
    ],
    [
        -28,
        [
            "ENOSPC",
            "no space left on device"
        ]
    ],
    [
        -38,
        [
            "ENOSYS",
            "function not implemented"
        ]
    ],
    [
        -107,
        [
            "ENOTCONN",
            "socket is not connected"
        ]
    ],
    [
        -20,
        [
            "ENOTDIR",
            "not a directory"
        ]
    ],
    [
        -39,
        [
            "ENOTEMPTY",
            "directory not empty"
        ]
    ],
    [
        -88,
        [
            "ENOTSOCK",
            "socket operation on non-socket"
        ]
    ],
    [
        -95,
        [
            "ENOTSUP",
            "operation not supported on socket"
        ]
    ],
    [
        -1,
        [
            "EPERM",
            "operation not permitted"
        ]
    ],
    [
        -32,
        [
            "EPIPE",
            "broken pipe"
        ]
    ],
    [
        -71,
        [
            "EPROTO",
            "protocol error"
        ]
    ],
    [
        -93,
        [
            "EPROTONOSUPPORT",
            "protocol not supported"
        ]
    ],
    [
        -91,
        [
            "EPROTOTYPE",
            "protocol wrong type for socket"
        ]
    ],
    [
        -34,
        [
            "ERANGE",
            "result too large"
        ]
    ],
    [
        -30,
        [
            "EROFS",
            "read-only file system"
        ]
    ],
    [
        -108,
        [
            "ESHUTDOWN",
            "cannot send after transport endpoint shutdown"
        ]
    ],
    [
        -29,
        [
            "ESPIPE",
            "invalid seek"
        ]
    ],
    [
        -3,
        [
            "ESRCH",
            "no such process"
        ]
    ],
    [
        -110,
        [
            "ETIMEDOUT",
            "connection timed out"
        ]
    ],
    [
        -26,
        [
            "ETXTBSY",
            "text file is busy"
        ]
    ],
    [
        -18,
        [
            "EXDEV",
            "cross-device link not permitted"
        ]
    ],
    [
        -4094,
        [
            "UNKNOWN",
            "unknown error"
        ]
    ],
    [
        -4095,
        [
            "EOF",
            "end of file"
        ]
    ],
    [
        -6,
        [
            "ENXIO",
            "no such device or address"
        ]
    ],
    [
        -31,
        [
            "EMLINK",
            "too many links"
        ]
    ],
    [
        -112,
        [
            "EHOSTDOWN",
            "host is down"
        ]
    ],
    [
        -121,
        [
            "EREMOTEIO",
            "remote I/O error"
        ]
    ],
    [
        -25,
        [
            "ENOTTY",
            "inappropriate ioctl for device"
        ]
    ],
    [
        -4028,
        [
            "EFTYPE",
            "inappropriate file type or format"
        ]
    ],
    [
        -84,
        [
            "EILSEQ",
            "illegal byte sequence"
        ]
    ]
];
const { os  } = Deno.build;
const errorMap = new Map(os === "windows" ? windows : os === "darwin" ? darwin : os === "linux" ? linux : unreachable());
function getSystemErrorName(code) {
    if (typeof code !== "number") {
        throw new ERR_INVALID_ARG_TYPE("err", "number", code);
    }
    if (code >= 0 || !NumberIsSafeInteger(code)) {
        throw new ERR_OUT_OF_RANGE("err", "a negative integer", code);
    }
    return errorMap.get(code)?.[0];
}
function deprecate(fn, msg, _code) {
    return function(...args) {
        console.warn(msg);
        return fn.apply(undefined, args);
    };
}
function inherits(ctor, superCtor) {
    if (ctor === undefined || ctor === null) {
        throw new ERR_INVALID_ARG_TYPE("ctor", "Function", ctor);
    }
    if (superCtor === undefined || superCtor === null) {
        throw new ERR_INVALID_ARG_TYPE("superCtor", "Function", superCtor);
    }
    if (superCtor.prototype === undefined) {
        throw new ERR_INVALID_ARG_TYPE("superCtor.prototype", "Object", superCtor.prototype);
    }
    Object.defineProperty(ctor, "super_", {
        value: superCtor,
        writable: true,
        configurable: true
    });
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}
const __default = {
    inspect,
    isArray,
    isBoolean,
    isNull,
    isNullOrUndefined,
    isNumber,
    isString,
    isSymbol,
    isUndefined,
    isObject,
    isError,
    isFunction,
    isRegExp: isRegExp1,
    isPrimitive,
    getSystemErrorName,
    deprecate,
    callbackify,
    promisify,
    inherits,
    types: mod,
    TextDecoder: _TextDecoder,
    TextEncoder: _TextEncoder
};
class ERR_INVALID_CALLBACK extends NodeTypeError {
    constructor(object){
        super("ERR_INVALID_CALLBACK", `Callback must be a function. Received ${JSON.stringify(object)}`);
    }
}
class ERR_INVALID_OPT_VALUE_ENCODING extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_OPT_VALUE_ENCODING", `The value "${x}" is invalid for option "encoding"`);
    }
}
class ERR_METHOD_NOT_IMPLEMENTED extends NodeError {
    constructor(x){
        super("ERR_METHOD_NOT_IMPLEMENTED", `The ${x} method is not implemented`);
    }
}
class ERR_MISSING_ARGS extends NodeTypeError {
    constructor(...args){
        args = args.map((a)=>`"${a}"`);
        let msg = "The ";
        switch(args.length){
            case 1:
                msg += `${args[0]} argument`;
                break;
            case 2:
                msg += `${args[0]} and ${args[1]} arguments`;
                break;
            default:
                msg += args.slice(0, args.length - 1).join(", ");
                msg += `, and ${args[args.length - 1]} arguments`;
                break;
        }
        super("ERR_MISSING_ARGS", `${msg} must be specified`);
    }
}
class ERR_MULTIPLE_CALLBACK extends NodeError {
    constructor(){
        super("ERR_MULTIPLE_CALLBACK", `Callback called multiple times`);
    }
}
class ERR_STREAM_ALREADY_FINISHED extends NodeError {
    constructor(x){
        super("ERR_STREAM_ALREADY_FINISHED", `Cannot call ${x} after a stream was finished`);
    }
}
class ERR_STREAM_CANNOT_PIPE extends NodeError {
    constructor(){
        super("ERR_STREAM_CANNOT_PIPE", `Cannot pipe, not readable`);
    }
}
class ERR_STREAM_DESTROYED extends NodeError {
    constructor(x){
        super("ERR_STREAM_DESTROYED", `Cannot call ${x} after a stream was destroyed`);
    }
}
class ERR_STREAM_NULL_VALUES extends NodeTypeError {
    constructor(){
        super("ERR_STREAM_NULL_VALUES", `May not write null values to stream`);
    }
}
class ERR_STREAM_PREMATURE_CLOSE extends NodeError {
    constructor(){
        super("ERR_STREAM_PREMATURE_CLOSE", `Premature close`);
    }
}
class ERR_STREAM_PUSH_AFTER_EOF extends NodeError {
    constructor(){
        super("ERR_STREAM_PUSH_AFTER_EOF", `stream.push() after EOF`);
    }
}
class ERR_STREAM_UNSHIFT_AFTER_END_EVENT extends NodeError {
    constructor(){
        super("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", `stream.unshift() after end event`);
    }
}
class ERR_STREAM_WRITE_AFTER_END extends NodeError {
    constructor(){
        super("ERR_STREAM_WRITE_AFTER_END", `write after end`);
    }
}
class ERR_UNKNOWN_ENCODING extends NodeTypeError {
    constructor(x){
        super("ERR_UNKNOWN_ENCODING", `Unknown encoding: ${x}`);
    }
}
class ERR_INVALID_OPT_VALUE extends NodeTypeError {
    constructor(name, value){
        super("ERR_INVALID_OPT_VALUE", `The value "${value}" is invalid for option "${name}"`);
    }
}
function buildReturnPropertyType(value) {
    if (value && value.constructor && value.constructor.name) {
        return `instance of ${value.constructor.name}`;
    } else {
        return `type ${typeof value}`;
    }
}
class ERR_INVALID_RETURN_VALUE extends NodeTypeError {
    constructor(input, name, value){
        super("ERR_INVALID_RETURN_VALUE", `Expected ${input} to be returned from the "${name}" function but got ${buildReturnPropertyType(value)}.`);
    }
}
function createIterResult(value, done) {
    return {
        value,
        done
    };
}
let defaultMaxListeners = 10;
function validateMaxListeners(n, name) {
    if (!Number.isInteger(n) || n < 0) {
        throw new ERR_OUT_OF_RANGE(name, "a non-negative number", inspect(n));
    }
}
class EventEmitter {
    static captureRejectionSymbol = Symbol.for("nodejs.rejection");
    static errorMonitor = Symbol("events.errorMonitor");
    static get defaultMaxListeners() {
        return defaultMaxListeners;
    }
    static set defaultMaxListeners(value) {
        validateMaxListeners(value, "defaultMaxListeners");
        defaultMaxListeners = value;
    }
    maxListeners;
    _events;
    static _alreadyWarnedEvents;
    constructor(){
        this._events = new Map();
    }
    _addListener(eventName, listener, prepend) {
        this.checkListenerArgument(listener);
        this.emit("newListener", eventName, this.unwrapListener(listener));
        if (this._events.has(eventName)) {
            const listeners = this._events.get(eventName);
            if (prepend) {
                listeners.unshift(listener);
            } else {
                listeners.push(listener);
            }
        } else {
            this._events.set(eventName, [
                listener
            ]);
        }
        const max = this.getMaxListeners();
        if (max > 0 && this.listenerCount(eventName) > max) {
            const warning = new MaxListenersExceededWarning(this, eventName);
            this.warnIfNeeded(eventName, warning);
        }
        return this;
    }
    addListener(eventName, listener) {}
    emit(eventName, ...args) {
        if (this._events.has(eventName)) {
            if (eventName === "error" && this._events.get(EventEmitter.errorMonitor)) {
                this.emit(EventEmitter.errorMonitor, ...args);
            }
            const listeners = this._events.get(eventName).slice();
            for (const listener of listeners){
                try {
                    listener.apply(this, args);
                } catch (err) {
                    this.emit("error", err);
                }
            }
            return true;
        } else if (eventName === "error") {
            if (this._events.get(EventEmitter.errorMonitor)) {
                this.emit(EventEmitter.errorMonitor, ...args);
            }
            const errMsg = args.length > 0 ? args[0] : Error("Unhandled error.");
            throw errMsg;
        }
        return false;
    }
    eventNames() {
        return Array.from(this._events.keys());
    }
    getMaxListeners() {
        return this.maxListeners == null ? EventEmitter.defaultMaxListeners : this.maxListeners;
    }
    listenerCount(eventName) {
        if (this._events.has(eventName)) {
            return this._events.get(eventName).length;
        } else {
            return 0;
        }
    }
    static listenerCount(emitter, eventName) {
        return emitter.listenerCount(eventName);
    }
    _listeners(target, eventName, unwrap) {
        if (!target._events?.has(eventName)) {
            return [];
        }
        const eventListeners = target._events.get(eventName);
        return unwrap ? this.unwrapListeners(eventListeners) : eventListeners.slice(0);
    }
    unwrapListeners(arr) {
        const unwrappedListeners = new Array(arr.length);
        for(let i = 0; i < arr.length; i++){
            unwrappedListeners[i] = this.unwrapListener(arr[i]);
        }
        return unwrappedListeners;
    }
    unwrapListener(listener) {
        return listener["listener"] ?? listener;
    }
    listeners(eventName) {
        return this._listeners(this, eventName, true);
    }
    rawListeners(eventName) {
        return this._listeners(this, eventName, false);
    }
    off(eventName, listener) {
        return this.removeListener(eventName, listener);
    }
    on(eventName, listener) {
        return this._addListener(eventName, listener, false);
    }
    once(eventName, listener) {
        const wrapped = this.onceWrap(eventName, listener);
        this.on(eventName, wrapped);
        return this;
    }
    onceWrap(eventName, listener) {
        this.checkListenerArgument(listener);
        const wrapper = function(...args) {
            if (this.isCalled) {
                return;
            }
            this.context.removeListener(this.eventName, this.rawListener);
            this.isCalled = true;
            return this.listener.apply(this.context, args);
        };
        const wrapperContext = {
            eventName: eventName,
            listener: listener,
            rawListener: wrapper,
            context: this
        };
        const wrapped = wrapper.bind(wrapperContext);
        wrapperContext.rawListener = wrapped;
        wrapped.listener = listener;
        return wrapped;
    }
    prependListener(eventName, listener) {
        return this._addListener(eventName, listener, true);
    }
    prependOnceListener(eventName, listener) {
        const wrapped = this.onceWrap(eventName, listener);
        this.prependListener(eventName, wrapped);
        return this;
    }
    removeAllListeners(eventName) {
        if (this._events === undefined) {
            return this;
        }
        if (eventName) {
            if (this._events.has(eventName)) {
                const listeners = this._events.get(eventName).slice().reverse();
                for (const listener of listeners){
                    this.removeListener(eventName, this.unwrapListener(listener));
                }
            }
        } else {
            const eventList = this.eventNames();
            eventList.forEach((value)=>{
                this.removeAllListeners(value);
            });
        }
        return this;
    }
    removeListener(eventName, listener) {
        this.checkListenerArgument(listener);
        if (this._events.has(eventName)) {
            const arr = this._events.get(eventName);
            assert1(arr);
            let listenerIndex = -1;
            for(let i = arr.length - 1; i >= 0; i--){
                if (arr[i] == listener || arr[i] && arr[i]["listener"] == listener) {
                    listenerIndex = i;
                    break;
                }
            }
            if (listenerIndex >= 0) {
                arr.splice(listenerIndex, 1);
                this.emit("removeListener", eventName, listener);
                if (arr.length === 0) {
                    this._events.delete(eventName);
                }
            }
        }
        return this;
    }
    setMaxListeners(n) {
        if (n !== Infinity) {
            validateMaxListeners(n, "n");
        }
        this.maxListeners = n;
        return this;
    }
    static once(emitter, name) {
        return new Promise((resolve, reject)=>{
            if (emitter instanceof EventTarget) {
                emitter.addEventListener(name, (...args)=>{
                    resolve(args);
                }, {
                    once: true,
                    passive: false,
                    capture: false
                });
                return;
            } else if (emitter instanceof EventEmitter) {
                const eventListener = (...args)=>{
                    if (errorListener !== undefined) {
                        emitter.removeListener("error", errorListener);
                    }
                    resolve(args);
                };
                let errorListener;
                if (name !== "error") {
                    errorListener = (err)=>{
                        emitter.removeListener(name, eventListener);
                        reject(err);
                    };
                    emitter.once("error", errorListener);
                }
                emitter.once(name, eventListener);
                return;
            }
        });
    }
    static on(emitter, event) {
        const unconsumedEventValues = [];
        const unconsumedPromises = [];
        let error = null;
        let finished = false;
        const iterator = {
            next () {
                const value = unconsumedEventValues.shift();
                if (value) {
                    return Promise.resolve(createIterResult(value, false));
                }
                if (error) {
                    const p = Promise.reject(error);
                    error = null;
                    return p;
                }
                if (finished) {
                    return Promise.resolve(createIterResult(undefined, true));
                }
                return new Promise(function(resolve, reject) {
                    unconsumedPromises.push({
                        resolve,
                        reject
                    });
                });
            },
            return () {
                emitter.removeListener(event, eventHandler);
                emitter.removeListener("error", errorHandler);
                finished = true;
                for (const promise of unconsumedPromises){
                    promise.resolve(createIterResult(undefined, true));
                }
                return Promise.resolve(createIterResult(undefined, true));
            },
            throw (err) {
                error = err;
                emitter.removeListener(event, eventHandler);
                emitter.removeListener("error", errorHandler);
            },
            [Symbol.asyncIterator] () {
                return this;
            }
        };
        emitter.on(event, eventHandler);
        emitter.on("error", errorHandler);
        return iterator;
        function eventHandler(...args) {
            const promise = unconsumedPromises.shift();
            if (promise) {
                promise.resolve(createIterResult(args, false));
            } else {
                unconsumedEventValues.push(args);
            }
        }
        function errorHandler(err) {
            finished = true;
            const toError = unconsumedPromises.shift();
            if (toError) {
                toError.reject(err);
            } else {
                error = err;
            }
            iterator.return();
        }
    }
    checkListenerArgument(listener) {
        if (typeof listener !== "function") {
            throw new ERR_INVALID_ARG_TYPE("listener", "function", listener);
        }
    }
    warnIfNeeded(eventName, warning) {
        EventEmitter._alreadyWarnedEvents ||= new Set();
        if (EventEmitter._alreadyWarnedEvents.has(eventName)) {
            return;
        }
        EventEmitter._alreadyWarnedEvents.add(eventName);
        console.warn(warning);
        const maybeProcess = globalThis.process;
        if (maybeProcess instanceof EventEmitter) {
            maybeProcess.emit("warning", warning);
        }
    }
}
EventEmitter.prototype.addListener = EventEmitter.prototype.on;
class MaxListenersExceededWarning extends Error {
    count;
    constructor(emitter, type){
        const listenerCount = emitter.listenerCount(type);
        const message = "Possible EventEmitter memory leak detected. " + `${listenerCount} ${type == null ? "null" : type.toString()} listeners added to [${emitter.constructor.name}]. ` + " Use emitter.setMaxListeners() to increase limit";
        super(message);
        this.emitter = emitter;
        this.type = type;
        this.count = listenerCount;
        this.name = "MaxListenersExceededWarning";
    }
    emitter;
    type;
}
const captureRejectionSymbol = EventEmitter.captureRejectionSymbol;
EventEmitter.errorMonitor;
EventEmitter.listenerCount;
EventEmitter.on;
const once1 = EventEmitter.once;
const __default1 = Object.assign(EventEmitter, {
    EventEmitter
});
const osType = (()=>{
    const { Deno: Deno1  } = globalThis;
    if (typeof Deno1?.build?.os === "string") {
        return Deno1.build.os;
    }
    const { navigator  } = globalThis;
    if (navigator?.appVersion?.includes?.("Win") ?? false) {
        return "windows";
    }
    return "linux";
})();
const isWindows = osType === "windows";
const CHAR_FORWARD_SLASH = 47;
function assertPath(path) {
    if (typeof path !== "string") {
        throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
    }
}
function isPosixPathSeparator(code) {
    return code === 47;
}
function isPathSeparator(code) {
    return isPosixPathSeparator(code) || code === 92;
}
function isWindowsDeviceRoot(code) {
    return code >= 97 && code <= 122 || code >= 65 && code <= 90;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code;
    for(let i = 0, len = path.length; i <= len; ++i){
        if (i < len) code = path.charCodeAt(i);
        else if (isPathSeparator(code)) break;
        else code = CHAR_FORWARD_SLASH;
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) {} else if (lastSlash !== i - 1 && dots === 2) {
                if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.lastIndexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = "";
                            lastSegmentLength = 0;
                        } else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    } else if (res.length === 2 || res.length === 1) {
                        res = "";
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    if (res.length > 0) res += `${separator}..`;
                    else res = "..";
                    lastSegmentLength = 2;
                }
            } else {
                if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
                else res = path.slice(lastSlash + 1, i);
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        } else if (code === 46 && dots !== -1) {
            ++dots;
        } else {
            dots = -1;
        }
    }
    return res;
}
function _format1(sep, pathObject) {
    const dir = pathObject.dir || pathObject.root;
    const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
    if (!dir) return base;
    if (dir === pathObject.root) return dir + base;
    return dir + sep + base;
}
const WHITESPACE_ENCODINGS = {
    "\u0009": "%09",
    "\u000A": "%0A",
    "\u000B": "%0B",
    "\u000C": "%0C",
    "\u000D": "%0D",
    "\u0020": "%20"
};
function encodeWhitespace(string) {
    return string.replaceAll(/[\s]/g, (c)=>{
        return WHITESPACE_ENCODINGS[c] ?? c;
    });
}
const sep = "\\";
const delimiter = ";";
function resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1; i--){
        let path;
        const { Deno: Deno1  } = globalThis;
        if (i >= 0) {
            path = pathSegments[i];
        } else if (!resolvedDevice) {
            if (typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a drive-letter-less path without a CWD.");
            }
            path = Deno1.cwd();
        } else {
            if (typeof Deno1?.env?.get !== "function" || typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno1.env.get(`=${resolvedDevice}`) || Deno1.cwd();
            if (path === undefined || path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
                path = `${resolvedDevice}\\`;
            }
        }
        assertPath(path);
        const len = path.length;
        if (len === 0) continue;
        let rootEnd = 0;
        let device = "";
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        if (len > 1) {
            if (isPathSeparator(code)) {
                isAbsolute = true;
                if (isPathSeparator(path.charCodeAt(1))) {
                    let j = 2;
                    let last = j;
                    for(; j < len; ++j){
                        if (isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        last = j;
                        for(; j < len; ++j){
                            if (!isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j < len && j !== last) {
                            last = j;
                            for(; j < len; ++j){
                                if (isPathSeparator(path.charCodeAt(j))) break;
                            }
                            if (j === len) {
                                device = `\\\\${firstPart}\\${path.slice(last)}`;
                                rootEnd = j;
                            } else if (j !== last) {
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                } else {
                    rootEnd = 1;
                }
            } else if (isWindowsDeviceRoot(code)) {
                if (path.charCodeAt(1) === 58) {
                    device = path.slice(0, 2);
                    rootEnd = 2;
                    if (len > 2) {
                        if (isPathSeparator(path.charCodeAt(2))) {
                            isAbsolute = true;
                            rootEnd = 3;
                        }
                    }
                }
            }
        } else if (isPathSeparator(code)) {
            rootEnd = 1;
            isAbsolute = true;
        }
        if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            continue;
        }
        if (resolvedDevice.length === 0 && device.length > 0) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
            resolvedAbsolute = isAbsolute;
        }
        if (resolvedAbsolute && resolvedDevice.length > 0) break;
    }
    resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
    return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
function normalize(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = 0;
    let device;
    let isAbsolute = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            isAbsolute = true;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    const firstPart = path.slice(last, j);
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return `\\\\${firstPart}\\${path.slice(last)}\\`;
                        } else if (j !== last) {
                            device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                            rootEnd = j;
                        }
                    }
                }
            } else {
                rootEnd = 1;
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                device = path.slice(0, 2);
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        isAbsolute = true;
                        rootEnd = 3;
                    }
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return "\\";
    }
    let tail;
    if (rootEnd < len) {
        tail = normalizeString(path.slice(rootEnd), !isAbsolute, "\\", isPathSeparator);
    } else {
        tail = "";
    }
    if (tail.length === 0 && !isAbsolute) tail = ".";
    if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
        tail += "\\";
    }
    if (device === undefined) {
        if (isAbsolute) {
            if (tail.length > 0) return `\\${tail}`;
            else return "\\";
        } else if (tail.length > 0) {
            return tail;
        } else {
            return "";
        }
    } else if (isAbsolute) {
        if (tail.length > 0) return `${device}\\${tail}`;
        else return `${device}\\`;
    } else if (tail.length > 0) {
        return device + tail;
    } else {
        return device;
    }
}
function isAbsolute(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return false;
    const code = path.charCodeAt(0);
    if (isPathSeparator(code)) {
        return true;
    } else if (isWindowsDeviceRoot(code)) {
        if (len > 2 && path.charCodeAt(1) === 58) {
            if (isPathSeparator(path.charCodeAt(2))) return true;
        }
    }
    return false;
}
function join(...paths) {
    const pathsCount = paths.length;
    if (pathsCount === 0) return ".";
    let joined;
    let firstPart = null;
    for(let i = 0; i < pathsCount; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (joined === undefined) joined = firstPart = path;
            else joined += `\\${path}`;
        }
    }
    if (joined === undefined) return ".";
    let needsReplace = true;
    let slashCount = 0;
    assert1(firstPart != null);
    if (isPathSeparator(firstPart.charCodeAt(0))) {
        ++slashCount;
        const firstLen = firstPart.length;
        if (firstLen > 1) {
            if (isPathSeparator(firstPart.charCodeAt(1))) {
                ++slashCount;
                if (firstLen > 2) {
                    if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
                    else {
                        needsReplace = false;
                    }
                }
            }
        }
    }
    if (needsReplace) {
        for(; slashCount < joined.length; ++slashCount){
            if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
        }
        if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
    }
    return normalize(joined);
}
function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    const fromOrig = resolve(from);
    const toOrig = resolve(to);
    if (fromOrig === toOrig) return "";
    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();
    if (from === to) return "";
    let fromStart = 0;
    let fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 92) break;
    }
    for(; fromEnd - 1 > fromStart; --fromEnd){
        if (from.charCodeAt(fromEnd - 1) !== 92) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 0;
    let toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 92) break;
    }
    for(; toEnd - 1 > toStart; --toEnd){
        if (to.charCodeAt(toEnd - 1) !== 92) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 92) {
                    return toOrig.slice(toStart + i + 1);
                } else if (i === 2) {
                    return toOrig.slice(toStart + i);
                }
            }
            if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 92) {
                    lastCommonSep = i;
                } else if (i === 2) {
                    lastCommonSep = 3;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 92) lastCommonSep = i;
    }
    if (i !== length && lastCommonSep === -1) {
        return toOrig;
    }
    let out = "";
    if (lastCommonSep === -1) lastCommonSep = 0;
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 92) {
            if (out.length === 0) out += "..";
            else out += "\\..";
        }
    }
    if (out.length > 0) {
        return out + toOrig.slice(toStart + lastCommonSep, toEnd);
    } else {
        toStart += lastCommonSep;
        if (toOrig.charCodeAt(toStart) === 92) ++toStart;
        return toOrig.slice(toStart, toEnd);
    }
}
function toNamespacedPath(path) {
    if (typeof path !== "string") return path;
    if (path.length === 0) return "";
    const resolvedPath = resolve(path);
    if (resolvedPath.length >= 3) {
        if (resolvedPath.charCodeAt(0) === 92) {
            if (resolvedPath.charCodeAt(1) === 92) {
                const code = resolvedPath.charCodeAt(2);
                if (code !== 63 && code !== 46) {
                    return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
                }
            }
        } else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0))) {
            if (resolvedPath.charCodeAt(1) === 58 && resolvedPath.charCodeAt(2) === 92) {
                return `\\\\?\\${resolvedPath}`;
            }
        }
    }
    return path;
}
function dirname(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = -1;
    let end = -1;
    let matchedSlash = true;
    let offset = 0;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = offset = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return path;
                        }
                        if (j !== last) {
                            rootEnd = offset = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = offset = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return path;
    }
    for(let i = len - 1; i >= offset; --i){
        if (isPathSeparator(path.charCodeAt(i))) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) {
        if (rootEnd === -1) return ".";
        else end = rootEnd;
    }
    return path.slice(0, end);
}
function basename(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if (isWindowsDeviceRoot(drive)) {
            if (path.charCodeAt(1) === 58) start = 2;
        }
    }
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= start; --i){
            const code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= start; --i){
            if (isPathSeparator(path.charCodeAt(i))) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname(path) {
    assertPath(path);
    let start = 0;
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    if (path.length >= 2 && path.charCodeAt(1) === 58 && isWindowsDeviceRoot(path.charCodeAt(0))) {
        start = startPart = 2;
    }
    for(let i = path.length - 1; i >= start; --i){
        const code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format1("\\", pathObject);
}
function parse(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    const len = path.length;
    if (len === 0) return ret;
    let rootEnd = 0;
    let code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            rootEnd = j;
                        } else if (j !== last) {
                            rootEnd = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        if (len === 3) {
                            ret.root = ret.dir = path;
                            return ret;
                        }
                        rootEnd = 3;
                    }
                } else {
                    ret.root = ret.dir = path;
                    return ret;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        ret.root = ret.dir = path;
        return ret;
    }
    if (rootEnd > 0) ret.root = path.slice(0, rootEnd);
    let startDot = -1;
    let startPart = rootEnd;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= rootEnd; --i){
        code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            ret.base = ret.name = path.slice(startPart, end);
        }
    } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0 && startPart !== rootEnd) {
        ret.dir = path.slice(0, startPart - 1);
    } else ret.dir = ret.root;
    return ret;
}
function fromFileUrl(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
    if (url.hostname != "") {
        path = `\\\\${url.hostname}${path}`;
    }
    return path;
}
function toFileUrl(path) {
    if (!isAbsolute(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const [, hostname, pathname] = path.match(/^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/);
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
    if (hostname != null && hostname != "localhost") {
        url.hostname = hostname;
        if (!url.hostname) {
            throw new TypeError("Invalid hostname.");
        }
    }
    return url;
}
const mod1 = {
    sep: sep,
    delimiter: delimiter,
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    toNamespacedPath: toNamespacedPath,
    dirname: dirname,
    basename: basename,
    extname: extname,
    format: format,
    parse: parse,
    fromFileUrl: fromFileUrl,
    toFileUrl: toFileUrl
};
const sep1 = "/";
const delimiter1 = ":";
function resolve1(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--){
        let path;
        if (i >= 0) path = pathSegments[i];
        else {
            const { Deno: Deno1  } = globalThis;
            if (typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno1.cwd();
        }
        assertPath(path);
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
    if (resolvedAbsolute) {
        if (resolvedPath.length > 0) return `/${resolvedPath}`;
        else return "/";
    } else if (resolvedPath.length > 0) return resolvedPath;
    else return ".";
}
function normalize1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const isAbsolute = path.charCodeAt(0) === 47;
    const trailingSeparator = path.charCodeAt(path.length - 1) === 47;
    path = normalizeString(path, !isAbsolute, "/", isPosixPathSeparator);
    if (path.length === 0 && !isAbsolute) path = ".";
    if (path.length > 0 && trailingSeparator) path += "/";
    if (isAbsolute) return `/${path}`;
    return path;
}
function isAbsolute1(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47;
}
function join1(...paths) {
    if (paths.length === 0) return ".";
    let joined;
    for(let i = 0, len = paths.length; i < len; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `/${path}`;
        }
    }
    if (!joined) return ".";
    return normalize1(joined);
}
function relative1(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    from = resolve1(from);
    to = resolve1(to);
    if (from === to) return "";
    let fromStart = 1;
    const fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 47) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 1;
    const toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 47) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 47) {
                    return to.slice(toStart + i + 1);
                } else if (i === 0) {
                    return to.slice(toStart + i);
                }
            } else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 47) {
                    lastCommonSep = i;
                } else if (i === 0) {
                    lastCommonSep = 0;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 47) lastCommonSep = i;
    }
    let out = "";
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 47) {
            if (out.length === 0) out += "..";
            else out += "/..";
        }
    }
    if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
    else {
        toStart += lastCommonSep;
        if (to.charCodeAt(toStart) === 47) ++toStart;
        return to.slice(toStart);
    }
}
function toNamespacedPath1(path) {
    return path;
}
function dirname1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const hasRoot = path.charCodeAt(0) === 47;
    let end = -1;
    let matchedSlash = true;
    for(let i = path.length - 1; i >= 1; --i){
        if (path.charCodeAt(i) === 47) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return path.slice(0, end);
}
function basename1(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= 0; --i){
            const code = path.charCodeAt(i);
            if (code === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= 0; --i){
            if (path.charCodeAt(i) === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname1(path) {
    assertPath(path);
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for(let i = path.length - 1; i >= 0; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format1(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format1("/", pathObject);
}
function parse1(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    if (path.length === 0) return ret;
    const isAbsolute = path.charCodeAt(0) === 47;
    let start;
    if (isAbsolute) {
        ret.root = "/";
        start = 1;
    } else {
        start = 0;
    }
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= start; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            if (startPart === 0 && isAbsolute) {
                ret.base = ret.name = path.slice(1, end);
            } else {
                ret.base = ret.name = path.slice(startPart, end);
            }
        }
    } else {
        if (startPart === 0 && isAbsolute) {
            ret.name = path.slice(1, startDot);
            ret.base = path.slice(1, end);
        } else {
            ret.name = path.slice(startPart, startDot);
            ret.base = path.slice(startPart, end);
        }
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
    else if (isAbsolute) ret.dir = "/";
    return ret;
}
function fromFileUrl1(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function toFileUrl1(path) {
    if (!isAbsolute1(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(path.replace(/%/g, "%25").replace(/\\/g, "%5C"));
    return url;
}
const mod2 = {
    sep: sep1,
    delimiter: delimiter1,
    resolve: resolve1,
    normalize: normalize1,
    isAbsolute: isAbsolute1,
    join: join1,
    relative: relative1,
    toNamespacedPath: toNamespacedPath1,
    dirname: dirname1,
    basename: basename1,
    extname: extname1,
    format: format1,
    parse: parse1,
    fromFileUrl: fromFileUrl1,
    toFileUrl: toFileUrl1
};
const SEP = isWindows ? "\\" : "/";
const SEP_PATTERN = isWindows ? /[\\/]+/ : /\/+/;
function common(paths, sep = SEP) {
    const [first = "", ...remaining] = paths;
    if (first === "" || remaining.length === 0) {
        return first.substring(0, first.lastIndexOf(sep) + 1);
    }
    const parts = first.split(sep);
    let endOfPrefix = parts.length;
    for (const path of remaining){
        const compare = path.split(sep);
        for(let i = 0; i < endOfPrefix; i++){
            if (compare[i] !== parts[i]) {
                endOfPrefix = i;
            }
        }
        if (endOfPrefix === 0) {
            return "";
        }
    }
    const prefix = parts.slice(0, endOfPrefix).join(sep);
    return prefix.endsWith(sep) ? prefix : `${prefix}${sep}`;
}
const path = isWindows ? mod1 : mod2;
const { join: join2 , normalize: normalize2  } = path;
const regExpEscapeChars = [
    "!",
    "$",
    "(",
    ")",
    "*",
    "+",
    ".",
    "=",
    "?",
    "[",
    "\\",
    "^",
    "{",
    "|"
];
const rangeEscapeChars = [
    "-",
    "\\",
    "]"
];
function globToRegExp(glob, { extended =true , globstar: globstarOption = true , os =osType , caseInsensitive =false  } = {}) {
    if (glob == "") {
        return /(?!)/;
    }
    const sep = os == "windows" ? "(?:\\\\|/)+" : "/+";
    const sepMaybe = os == "windows" ? "(?:\\\\|/)*" : "/*";
    const seps = os == "windows" ? [
        "\\",
        "/"
    ] : [
        "/"
    ];
    const globstar = os == "windows" ? "(?:[^\\\\/]*(?:\\\\|/|$)+)*" : "(?:[^/]*(?:/|$)+)*";
    const wildcard = os == "windows" ? "[^\\\\/]*" : "[^/]*";
    const escapePrefix = os == "windows" ? "`" : "\\";
    let newLength = glob.length;
    for(; newLength > 1 && seps.includes(glob[newLength - 1]); newLength--);
    glob = glob.slice(0, newLength);
    let regExpString = "";
    for(let j = 0; j < glob.length;){
        let segment = "";
        const groupStack = [];
        let inRange = false;
        let inEscape = false;
        let endsWithSep = false;
        let i = j;
        for(; i < glob.length && !seps.includes(glob[i]); i++){
            if (inEscape) {
                inEscape = false;
                const escapeChars = inRange ? rangeEscapeChars : regExpEscapeChars;
                segment += escapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
                continue;
            }
            if (glob[i] == escapePrefix) {
                inEscape = true;
                continue;
            }
            if (glob[i] == "[") {
                if (!inRange) {
                    inRange = true;
                    segment += "[";
                    if (glob[i + 1] == "!") {
                        i++;
                        segment += "^";
                    } else if (glob[i + 1] == "^") {
                        i++;
                        segment += "\\^";
                    }
                    continue;
                } else if (glob[i + 1] == ":") {
                    let k = i + 1;
                    let value = "";
                    while(glob[k + 1] != null && glob[k + 1] != ":"){
                        value += glob[k + 1];
                        k++;
                    }
                    if (glob[k + 1] == ":" && glob[k + 2] == "]") {
                        i = k + 2;
                        if (value == "alnum") segment += "\\dA-Za-z";
                        else if (value == "alpha") segment += "A-Za-z";
                        else if (value == "ascii") segment += "\x00-\x7F";
                        else if (value == "blank") segment += "\t ";
                        else if (value == "cntrl") segment += "\x00-\x1F\x7F";
                        else if (value == "digit") segment += "\\d";
                        else if (value == "graph") segment += "\x21-\x7E";
                        else if (value == "lower") segment += "a-z";
                        else if (value == "print") segment += "\x20-\x7E";
                        else if (value == "punct") {
                            segment += "!\"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_‘{|}~";
                        } else if (value == "space") segment += "\\s\v";
                        else if (value == "upper") segment += "A-Z";
                        else if (value == "word") segment += "\\w";
                        else if (value == "xdigit") segment += "\\dA-Fa-f";
                        continue;
                    }
                }
            }
            if (glob[i] == "]" && inRange) {
                inRange = false;
                segment += "]";
                continue;
            }
            if (inRange) {
                if (glob[i] == "\\") {
                    segment += `\\\\`;
                } else {
                    segment += glob[i];
                }
                continue;
            }
            if (glob[i] == ")" && groupStack.length > 0 && groupStack[groupStack.length - 1] != "BRACE") {
                segment += ")";
                const type = groupStack.pop();
                if (type == "!") {
                    segment += wildcard;
                } else if (type != "@") {
                    segment += type;
                }
                continue;
            }
            if (glob[i] == "|" && groupStack.length > 0 && groupStack[groupStack.length - 1] != "BRACE") {
                segment += "|";
                continue;
            }
            if (glob[i] == "+" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("+");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "@" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("@");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "?") {
                if (extended && glob[i + 1] == "(") {
                    i++;
                    groupStack.push("?");
                    segment += "(?:";
                } else {
                    segment += ".";
                }
                continue;
            }
            if (glob[i] == "!" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("!");
                segment += "(?!";
                continue;
            }
            if (glob[i] == "{") {
                groupStack.push("BRACE");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "}" && groupStack[groupStack.length - 1] == "BRACE") {
                groupStack.pop();
                segment += ")";
                continue;
            }
            if (glob[i] == "," && groupStack[groupStack.length - 1] == "BRACE") {
                segment += "|";
                continue;
            }
            if (glob[i] == "*") {
                if (extended && glob[i + 1] == "(") {
                    i++;
                    groupStack.push("*");
                    segment += "(?:";
                } else {
                    const prevChar = glob[i - 1];
                    let numStars = 1;
                    while(glob[i + 1] == "*"){
                        i++;
                        numStars++;
                    }
                    const nextChar = glob[i + 1];
                    if (globstarOption && numStars == 2 && [
                        ...seps,
                        undefined
                    ].includes(prevChar) && [
                        ...seps,
                        undefined
                    ].includes(nextChar)) {
                        segment += globstar;
                        endsWithSep = true;
                    } else {
                        segment += wildcard;
                    }
                }
                continue;
            }
            segment += regExpEscapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
        }
        if (groupStack.length > 0 || inRange || inEscape) {
            segment = "";
            for (const c of glob.slice(j, i)){
                segment += regExpEscapeChars.includes(c) ? `\\${c}` : c;
                endsWithSep = false;
            }
        }
        regExpString += segment;
        if (!endsWithSep) {
            regExpString += i < glob.length ? sep : sepMaybe;
            endsWithSep = true;
        }
        while(seps.includes(glob[i]))i++;
        if (!(i > j)) {
            throw new Error("Assertion failure: i > j (potential infinite loop)");
        }
        j = i;
    }
    regExpString = `^${regExpString}$`;
    return new RegExp(regExpString, caseInsensitive ? "i" : "");
}
function isGlob(str) {
    const chars = {
        "{": "}",
        "(": ")",
        "[": "]"
    };
    const regex = /\\(.)|(^!|\*|\?|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
    if (str === "") {
        return false;
    }
    let match;
    while(match = regex.exec(str)){
        if (match[2]) return true;
        let idx = match.index + match[0].length;
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = str.indexOf(close, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }
        str = str.slice(idx);
    }
    return false;
}
function normalizeGlob(glob, { globstar =false  } = {}) {
    if (glob.match(/\0/g)) {
        throw new Error(`Glob contains invalid characters: "${glob}"`);
    }
    if (!globstar) {
        return normalize2(glob);
    }
    const s = SEP_PATTERN.source;
    const badParentPattern = new RegExp(`(?<=(${s}|^)\\*\\*${s})\\.\\.(?=${s}|$)`, "g");
    return normalize2(glob.replace(badParentPattern, "\0")).replace(/\0/g, "..");
}
function joinGlobs(globs, { extended =false , globstar =false  } = {}) {
    if (!globstar || globs.length == 0) {
        return join2(...globs);
    }
    if (globs.length === 0) return ".";
    let joined;
    for (const glob of globs){
        const path = glob;
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `${SEP}${path}`;
        }
    }
    if (!joined) return ".";
    return normalizeGlob(joined, {
        extended,
        globstar
    });
}
const path1 = isWindows ? mod1 : mod2;
const { basename: basename2 , delimiter: delimiter2 , dirname: dirname2 , extname: extname2 , format: format2 , fromFileUrl: fromFileUrl2 , isAbsolute: isAbsolute2 , join: join3 , normalize: normalize3 , parse: parse2 , relative: relative2 , resolve: resolve2 , sep: sep2 , toFileUrl: toFileUrl2 , toNamespacedPath: toNamespacedPath2  } = path1;
const mod3 = {
    SEP: SEP,
    SEP_PATTERN: SEP_PATTERN,
    win32: mod1,
    posix: mod2,
    basename: basename2,
    delimiter: delimiter2,
    dirname: dirname2,
    extname: extname2,
    format: format2,
    fromFileUrl: fromFileUrl2,
    isAbsolute: isAbsolute2,
    join: join3,
    normalize: normalize3,
    parse: parse2,
    relative: relative2,
    resolve: resolve2,
    sep: sep2,
    toFileUrl: toFileUrl2,
    toNamespacedPath: toNamespacedPath2,
    common,
    globToRegExp,
    isGlob,
    normalizeGlob,
    joinGlobs
};
const customInspect = Symbol.for("Deno.customInspect");
const notImplementedEvents = [
    "beforeExit",
    "disconnect",
    "message",
    "multipleResolves",
    "rejectionHandled",
    "SIGBREAK",
    "SIGBUS",
    "SIGFPE",
    "SIGHUP",
    "SIGILL",
    "SIGINT",
    "SIGSEGV",
    "SIGTERM",
    "SIGWINCH",
    "uncaughtException",
    "uncaughtExceptionMonitor",
    "unhandledRejection"
];
const arch = Deno.build.arch;
const argv = [
    "",
    "",
    ...Deno.args
];
Object.defineProperty(argv, "0", {
    get () {
        return Deno.execPath();
    }
});
Object.defineProperty(argv, "1", {
    get () {
        return fromFileUrl2(Deno.mainModule);
    }
});
const chdir = Deno.chdir;
const cwd = Deno.cwd;
const _env = {};
Object.defineProperty(_env, customInspect, {
    enumerable: false,
    configurable: true,
    get: function() {
        return Deno.env.toObject();
    }
});
const env = new Proxy(_env, {
    get (target, prop) {
        if (prop === customInspect) {
            return target[customInspect];
        }
        return Deno.env.get(String(prop));
    },
    ownKeys () {
        return Reflect.ownKeys(Deno.env.toObject());
    },
    getOwnPropertyDescriptor () {
        return {
            enumerable: true,
            configurable: true
        };
    },
    set (_target, prop, value) {
        Deno.env.set(String(prop), String(value));
        return value;
    }
});
const exit = Deno.exit;
function nextTick(cb, ...args) {
    if (args) {
        queueMicrotask(()=>cb.call(this, ...args));
    } else {
        queueMicrotask(cb);
    }
}
const pid = Deno.pid;
const platform = Deno.build.os === "windows" ? "win32" : Deno.build.os;
const version = `v${Deno.version.deno}`;
const versions = {
    node: Deno.version.deno,
    ...Deno.version
};
class Process extends __default1 {
    constructor(){
        super();
        window.addEventListener("unload", ()=>{
            super.emit("exit", 0);
        });
    }
    arch = arch;
    argv = argv;
    chdir = chdir;
    cwd = cwd;
    exit = exit;
    env = env;
    nextTick = nextTick;
    on(event, listener) {
        if (notImplementedEvents.includes(event)) {
            notImplemented();
        }
        super.on(event, listener);
        return this;
    }
    pid = pid;
    platform = platform;
    removeAllListeners(_event) {
        notImplemented();
    }
    removeListener(event, listener) {
        if (notImplementedEvents.includes(event)) {
            notImplemented();
        }
        super.removeListener("exit", listener);
        return this;
    }
    hrtime(time) {
        const milli = performance.now();
        const sec = Math.floor(milli / 1000);
        const nano = Math.floor(milli * 1_000_000 - sec * 1_000_000_000);
        if (!time) {
            return [
                sec,
                nano
            ];
        }
        const [prevSec, prevNano] = time;
        return [
            sec - prevSec,
            nano - prevNano
        ];
    }
    get stderr() {
        return {
            fd: Deno.stderr.rid,
            get isTTY () {
                return Deno.isatty(this.fd);
            },
            pipe (_destination, _options) {
                notImplemented();
            },
            write (_chunk, _callback) {
                notImplemented();
            },
            on (_event, _callback) {
                notImplemented();
            }
        };
    }
    get stdin() {
        return {
            fd: Deno.stdin.rid,
            get isTTY () {
                return Deno.isatty(this.fd);
            },
            read (_size) {
                notImplemented();
            },
            on (_event, _callback) {
                notImplemented();
            }
        };
    }
    get stdout() {
        return {
            fd: Deno.stdout.rid,
            get isTTY () {
                return Deno.isatty(this.fd);
            },
            pipe (_destination, _options) {
                notImplemented();
            },
            write (_chunk, _callback) {
                notImplemented();
            },
            on (_event, _callback) {
                notImplemented();
            }
        };
    }
    version = version;
    versions = versions;
}
const process = new Process();
Object.defineProperty(process, Symbol.toStringTag, {
    enumerable: false,
    writable: true,
    configurable: false,
    value: "process"
});
process.removeListener;
process.removeAllListeners;
process.stderr;
process.stdin;
process.stdout;
const hexTable = new TextEncoder().encode("0123456789abcdef");
function errInvalidByte(__byte) {
    return new TypeError(`Invalid byte '${String.fromCharCode(__byte)}'`);
}
function errLength() {
    return new RangeError("Odd length hex string");
}
function fromHexChar(__byte) {
    if (48 <= __byte && __byte <= 57) return __byte - 48;
    if (97 <= __byte && __byte <= 102) return __byte - 97 + 10;
    if (65 <= __byte && __byte <= 70) return __byte - 65 + 10;
    throw errInvalidByte(__byte);
}
function encode(src) {
    const dst = new Uint8Array(src.length * 2);
    for(let i = 0; i < dst.length; i++){
        const v = src[i];
        dst[i * 2] = hexTable[v >> 4];
        dst[i * 2 + 1] = hexTable[v & 0x0f];
    }
    return dst;
}
function decode(src) {
    const dst = new Uint8Array(src.length / 2);
    for(let i = 0; i < dst.length; i++){
        const a = fromHexChar(src[i * 2]);
        const b = fromHexChar(src[i * 2 + 1]);
        dst[i] = a << 4 | b;
    }
    if (src.length % 2 == 1) {
        fromHexChar(src[dst.length * 2]);
        throw errLength();
    }
    return dst;
}
const base64abc = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "/"
];
function encode1(data) {
    const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
    let result = "", i;
    const l = uint8.length;
    for(i = 2; i < l; i += 3){
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4 | uint8[i - 1] >> 4];
        result += base64abc[(uint8[i - 1] & 0x0f) << 2 | uint8[i] >> 6];
        result += base64abc[uint8[i] & 0x3f];
    }
    if (i === l + 1) {
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4];
        result += "==";
    }
    if (i === l) {
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4 | uint8[i - 1] >> 4];
        result += base64abc[(uint8[i - 1] & 0x0f) << 2];
        result += "=";
    }
    return result;
}
function decode1(b64) {
    const binString = atob(b64);
    const size = binString.length;
    const bytes = new Uint8Array(size);
    for(let i = 0; i < size; i++){
        bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
}
const notImplementedEncodings = [
    "ascii",
    "binary",
    "latin1",
    "ucs2",
    "utf16le"
];
function checkEncoding(encoding = "utf8", strict = true) {
    if (typeof encoding !== "string" || strict && encoding === "") {
        if (!strict) return "utf8";
        throw new TypeError(`Unkown encoding: ${encoding}`);
    }
    const normalized = normalizeEncoding(encoding);
    if (normalized === undefined) {
        throw new TypeError(`Unkown encoding: ${encoding}`);
    }
    if (notImplementedEncodings.includes(encoding)) {
        notImplemented(`"${encoding}" encoding`);
    }
    return normalized;
}
const encodingOps = {
    utf8: {
        byteLength: (string)=>new TextEncoder().encode(string).byteLength
    },
    ucs2: {
        byteLength: (string)=>string.length * 2
    },
    utf16le: {
        byteLength: (string)=>string.length * 2
    },
    latin1: {
        byteLength: (string)=>string.length
    },
    ascii: {
        byteLength: (string)=>string.length
    },
    base64: {
        byteLength: (string)=>base64ByteLength(string, string.length)
    },
    hex: {
        byteLength: (string)=>string.length >>> 1
    }
};
function base64ByteLength(str, bytes) {
    if (str.charCodeAt(bytes - 1) === 0x3d) bytes--;
    if (bytes > 1 && str.charCodeAt(bytes - 1) === 0x3d) bytes--;
    return bytes * 3 >>> 2;
}
class Buffer extends Uint8Array {
    static alloc(size, fill, encoding = "utf8") {
        if (typeof size !== "number") {
            throw new TypeError(`The "size" argument must be of type number. Received type ${typeof size}`);
        }
        const buf = new Buffer(size);
        if (size === 0) return buf;
        let bufFill;
        if (typeof fill === "string") {
            const clearEncoding = checkEncoding(encoding);
            if (typeof fill === "string" && fill.length === 1 && clearEncoding === "utf8") {
                buf.fill(fill.charCodeAt(0));
            } else bufFill = Buffer.from(fill, clearEncoding);
        } else if (typeof fill === "number") {
            buf.fill(fill);
        } else if (fill instanceof Uint8Array) {
            if (fill.length === 0) {
                throw new TypeError(`The argument "value" is invalid. Received ${fill.constructor.name} []`);
            }
            bufFill = fill;
        }
        if (bufFill) {
            if (bufFill.length > buf.length) {
                bufFill = bufFill.subarray(0, buf.length);
            }
            let offset = 0;
            while(offset < size){
                buf.set(bufFill, offset);
                offset += bufFill.length;
                if (offset + bufFill.length >= size) break;
            }
            if (offset !== size) {
                buf.set(bufFill.subarray(0, size - offset), offset);
            }
        }
        return buf;
    }
    static allocUnsafe(size) {
        return new Buffer(size);
    }
    static byteLength(string, encoding = "utf8") {
        if (typeof string != "string") return string.byteLength;
        encoding = normalizeEncoding(encoding) || "utf8";
        return encodingOps[encoding].byteLength(string);
    }
    static concat(list, totalLength) {
        if (totalLength == undefined) {
            totalLength = 0;
            for (const buf of list){
                totalLength += buf.length;
            }
        }
        const buffer = Buffer.allocUnsafe(totalLength);
        let pos = 0;
        for (const item of list){
            let buf1;
            if (!(item instanceof Buffer)) {
                buf1 = Buffer.from(item);
            } else {
                buf1 = item;
            }
            buf1.copy(buffer, pos);
            pos += buf1.length;
        }
        return buffer;
    }
    static from(value, offsetOrEncoding, length) {
        const offset = typeof offsetOrEncoding === "string" ? undefined : offsetOrEncoding;
        let encoding = typeof offsetOrEncoding === "string" ? offsetOrEncoding : undefined;
        if (typeof value == "string") {
            encoding = checkEncoding(encoding, false);
            if (encoding === "hex") {
                return new Buffer(decode(new TextEncoder().encode(value)).buffer);
            }
            if (encoding === "base64") return new Buffer(decode1(value).buffer);
            return new Buffer(new TextEncoder().encode(value).buffer);
        }
        return new Buffer(value, offset, length);
    }
    static isBuffer(obj) {
        return obj instanceof Buffer;
    }
    static isEncoding(encoding) {
        return typeof encoding === "string" && encoding.length !== 0 && normalizeEncoding(encoding) !== undefined;
    }
    copy(targetBuffer, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
        const sourceBuffer = this.subarray(sourceStart, sourceEnd).subarray(0, Math.max(0, targetBuffer.length - targetStart));
        if (sourceBuffer.length === 0) return 0;
        targetBuffer.set(sourceBuffer, targetStart);
        return sourceBuffer.length;
    }
    equals(otherBuffer) {
        if (!(otherBuffer instanceof Uint8Array)) {
            throw new TypeError(`The "otherBuffer" argument must be an instance of Buffer or Uint8Array. Received type ${typeof otherBuffer}`);
        }
        if (this === otherBuffer) return true;
        if (this.byteLength !== otherBuffer.byteLength) return false;
        for(let i = 0; i < this.length; i++){
            if (this[i] !== otherBuffer[i]) return false;
        }
        return true;
    }
    readBigInt64BE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigInt64(offset);
    }
    readBigInt64LE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigInt64(offset, true);
    }
    readBigUInt64BE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigUint64(offset);
    }
    readBigUInt64LE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigUint64(offset, true);
    }
    readDoubleBE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat64(offset);
    }
    readDoubleLE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat64(offset, true);
    }
    readFloatBE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat32(offset);
    }
    readFloatLE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getFloat32(offset, true);
    }
    readInt8(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt8(offset);
    }
    readInt16BE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt16(offset);
    }
    readInt16LE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt16(offset, true);
    }
    readInt32BE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt32(offset);
    }
    readInt32LE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getInt32(offset, true);
    }
    readUInt8(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint8(offset);
    }
    readUInt16BE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint16(offset);
    }
    readUInt16LE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint16(offset, true);
    }
    readUInt32BE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint32(offset);
    }
    readUInt32LE(offset = 0) {
        return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint32(offset, true);
    }
    slice(begin = 0, end = this.length) {
        return this.subarray(begin, end);
    }
    toJSON() {
        return {
            type: "Buffer",
            data: Array.from(this)
        };
    }
    toString(encoding = "utf8", start = 0, end = this.length) {
        encoding = checkEncoding(encoding);
        const b = this.subarray(start, end);
        if (encoding === "hex") return new TextDecoder().decode(encode(b));
        if (encoding === "base64") return encode1(b.buffer);
        return new TextDecoder(encoding).decode(b);
    }
    write(string, offset = 0, length = this.length) {
        return new TextEncoder().encodeInto(string, this.subarray(offset, offset + length)).written;
    }
    writeBigInt64BE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigInt64(offset, value);
        return offset + 4;
    }
    writeBigInt64LE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigInt64(offset, value, true);
        return offset + 4;
    }
    writeBigUInt64BE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigUint64(offset, value);
        return offset + 4;
    }
    writeBigUInt64LE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setBigUint64(offset, value, true);
        return offset + 4;
    }
    writeDoubleBE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat64(offset, value);
        return offset + 8;
    }
    writeDoubleLE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat64(offset, value, true);
        return offset + 8;
    }
    writeFloatBE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat32(offset, value);
        return offset + 4;
    }
    writeFloatLE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat32(offset, value, true);
        return offset + 4;
    }
    writeInt8(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt8(offset, value);
        return offset + 1;
    }
    writeInt16BE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt16(offset, value);
        return offset + 2;
    }
    writeInt16LE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt16(offset, value, true);
        return offset + 2;
    }
    writeInt32BE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value);
        return offset + 4;
    }
    writeInt32LE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setInt32(offset, value, true);
        return offset + 4;
    }
    writeUInt8(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint8(offset, value);
        return offset + 1;
    }
    writeUInt16BE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint16(offset, value);
        return offset + 2;
    }
    writeUInt16LE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint16(offset, value, true);
        return offset + 2;
    }
    writeUInt32BE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value);
        return offset + 4;
    }
    writeUInt32LE(value, offset = 0) {
        new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value, true);
        return offset + 4;
    }
}
const __default2 = {
    Buffer
};
const setTimeout1 = globalThis.setTimeout;
const clearTimeout = globalThis.clearTimeout;
const setInterval = globalThis.setInterval;
const clearInterval = globalThis.clearInterval;
const setImmediate = (cb, ...args)=>globalThis.setTimeout(cb, 0, ...args);
const clearImmediate = globalThis.clearTimeout;
const __default3 = {
    setTimeout: setTimeout1,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate
};
Object.defineProperty(globalThis, "global", {
    value: globalThis,
    writable: false,
    enumerable: false,
    configurable: true
});
Object.defineProperty(globalThis, "process", {
    value: process,
    enumerable: false,
    writable: true,
    configurable: true
});
Object.defineProperty(globalThis, "Buffer", {
    value: Buffer,
    enumerable: false,
    writable: true,
    configurable: true
});
Object.defineProperty(globalThis, "setImmediate", {
    value: __default3.setImmediate,
    enumerable: true,
    writable: true,
    configurable: true
});
Object.defineProperty(globalThis, "clearImmediate", {
    value: __default3.clearImmediate,
    enumerable: true,
    writable: true,
    configurable: true
});
function getConsoleWidth() {
    return Deno.consoleSize?.(Deno.stderr.rid).columns ?? 80;
}
const MathMax = Math.max;
const { Error: Error1  } = globalThis;
const { create: ObjectCreate , defineProperty: ObjectDefineProperty , getPrototypeOf: ObjectGetPrototypeOf , getOwnPropertyDescriptor: ObjectGetOwnPropertyDescriptor , keys: ObjectKeys  } = Object;
let blue = "";
let green1 = "";
let red1 = "";
let defaultColor = "";
const kReadableOperator = {
    deepStrictEqual: "Expected values to be strictly deep-equal:",
    strictEqual: "Expected values to be strictly equal:",
    strictEqualObject: 'Expected "actual" to be reference-equal to "expected":',
    deepEqual: "Expected values to be loosely deep-equal:",
    notDeepStrictEqual: 'Expected "actual" not to be strictly deep-equal to:',
    notStrictEqual: 'Expected "actual" to be strictly unequal to:',
    notStrictEqualObject: 'Expected "actual" not to be reference-equal to "expected":',
    notDeepEqual: 'Expected "actual" not to be loosely deep-equal to:',
    notIdentical: "Values have same structure but are not reference-equal:",
    notDeepEqualUnequal: "Expected values not to be loosely deep-equal:"
};
function copyError(source) {
    const keys = ObjectKeys(source);
    const target = ObjectCreate(ObjectGetPrototypeOf(source));
    for (const key of keys){
        const desc = ObjectGetOwnPropertyDescriptor(source, key);
        if (desc !== undefined) {
            ObjectDefineProperty(target, key, desc);
        }
    }
    ObjectDefineProperty(target, "message", {
        value: source.message
    });
    return target;
}
function inspectValue(val) {
    return inspect(val, {
        compact: false,
        customInspect: false,
        depth: 1000,
        maxArrayLength: Infinity,
        showHidden: false,
        showProxy: false,
        sorted: true,
        getters: true
    });
}
function createErrDiff(actual, expected, operator) {
    let other = "";
    let res = "";
    let end = "";
    let skipped = false;
    const actualInspected = inspectValue(actual);
    const actualLines = actualInspected.split("\n");
    const expectedLines = inspectValue(expected).split("\n");
    let i = 0;
    let indicator = "";
    if (operator === "strictEqual" && (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null || typeof actual === "function" && typeof expected === "function")) {
        operator = "strictEqualObject";
    }
    if (actualLines.length === 1 && expectedLines.length === 1 && actualLines[0] !== expectedLines[0]) {
        const c = inspect.defaultOptions.colors;
        const actualRaw = c ? stripColor(actualLines[0]) : actualLines[0];
        const expectedRaw = c ? stripColor(expectedLines[0]) : expectedLines[0];
        const inputLength = actualRaw.length + expectedRaw.length;
        if (inputLength <= 12) {
            if ((typeof actual !== "object" || actual === null) && (typeof expected !== "object" || expected === null) && (actual !== 0 || expected !== 0)) {
                return `${kReadableOperator[operator]}\n\n` + `${actualLines[0]} !== ${expectedLines[0]}\n`;
            }
        } else if (operator !== "strictEqualObject") {
            const maxLength = Deno.isatty(Deno.stderr.rid) ? getConsoleWidth() : 80;
            if (inputLength < maxLength) {
                while(actualRaw[i] === expectedRaw[i]){
                    i++;
                }
                if (i > 2) {
                    indicator = `\n  ${" ".repeat(i)}^`;
                    i = 0;
                }
            }
        }
    }
    let a = actualLines[actualLines.length - 1];
    let b = expectedLines[expectedLines.length - 1];
    while(a === b){
        if (i++ < 3) {
            end = `\n  ${a}${end}`;
        } else {
            other = a;
        }
        actualLines.pop();
        expectedLines.pop();
        if (actualLines.length === 0 || expectedLines.length === 0) {
            break;
        }
        a = actualLines[actualLines.length - 1];
        b = expectedLines[expectedLines.length - 1];
    }
    const maxLines = MathMax(actualLines.length, expectedLines.length);
    if (maxLines === 0) {
        const actualLines1 = actualInspected.split("\n");
        if (actualLines1.length > 50) {
            actualLines1[46] = `${blue}...${defaultColor}`;
            while(actualLines1.length > 47){
                actualLines1.pop();
            }
        }
        return `${kReadableOperator.notIdentical}\n\n${actualLines1.join("\n")}\n`;
    }
    if (i >= 5) {
        end = `\n${blue}...${defaultColor}${end}`;
        skipped = true;
    }
    if (other !== "") {
        end = `\n  ${other}${end}`;
        other = "";
    }
    let printedLines = 0;
    let identical = 0;
    const msg = kReadableOperator[operator] + `\n${green1}+ actual${defaultColor} ${red1}- expected${defaultColor}`;
    const skippedMsg = ` ${blue}...${defaultColor} Lines skipped`;
    let lines = actualLines;
    let plusMinus = `${green1}+${defaultColor}`;
    let maxLength1 = expectedLines.length;
    if (actualLines.length < maxLines) {
        lines = expectedLines;
        plusMinus = `${red1}-${defaultColor}`;
        maxLength1 = actualLines.length;
    }
    for(i = 0; i < maxLines; i++){
        if (maxLength1 < i + 1) {
            if (identical > 2) {
                if (identical > 3) {
                    if (identical > 4) {
                        if (identical === 5) {
                            res += `\n  ${lines[i - 3]}`;
                            printedLines++;
                        } else {
                            res += `\n${blue}...${defaultColor}`;
                            skipped = true;
                        }
                    }
                    res += `\n  ${lines[i - 2]}`;
                    printedLines++;
                }
                res += `\n  ${lines[i - 1]}`;
                printedLines++;
            }
            identical = 0;
            if (lines === actualLines) {
                res += `\n${plusMinus} ${lines[i]}`;
            } else {
                other += `\n${plusMinus} ${lines[i]}`;
            }
            printedLines++;
        } else {
            const expectedLine = expectedLines[i];
            let actualLine = actualLines[i];
            let divergingLines = actualLine !== expectedLine && (!actualLine.endsWith(",") || actualLine.slice(0, -1) !== expectedLine);
            if (divergingLines && expectedLine.endsWith(",") && expectedLine.slice(0, -1) === actualLine) {
                divergingLines = false;
                actualLine += ",";
            }
            if (divergingLines) {
                if (identical > 2) {
                    if (identical > 3) {
                        if (identical > 4) {
                            if (identical === 5) {
                                res += `\n  ${actualLines[i - 3]}`;
                                printedLines++;
                            } else {
                                res += `\n${blue}...${defaultColor}`;
                                skipped = true;
                            }
                        }
                        res += `\n  ${actualLines[i - 2]}`;
                        printedLines++;
                    }
                    res += `\n  ${actualLines[i - 1]}`;
                    printedLines++;
                }
                identical = 0;
                res += `\n${green1}+${defaultColor} ${actualLine}`;
                other += `\n${red1}-${defaultColor} ${expectedLine}`;
                printedLines += 2;
            } else {
                res += other;
                other = "";
                identical++;
                if (identical <= 2) {
                    res += `\n  ${actualLine}`;
                    printedLines++;
                }
            }
        }
        if (printedLines > 50 && i < maxLines - 2) {
            return `${msg}${skippedMsg}\n${res}\n${blue}...${defaultColor}${other}\n` + `${blue}...${defaultColor}`;
        }
    }
    return `${msg}${skipped ? skippedMsg : ""}\n${res}${other}${end}${indicator}`;
}
class AssertionError1 extends Error1 {
    constructor(options){
        if (typeof options !== "object" || options === null) {
            throw new ERR_INVALID_ARG_TYPE("options", "Object", options);
        }
        const { message , operator , stackStartFn , details , stackStartFunction  } = options;
        let { actual , expected  } = options;
        const limit = Error1.stackTraceLimit;
        Error1.stackTraceLimit = 0;
        if (message != null) {
            super(String(message));
        } else {
            if (Deno.isatty(Deno.stderr.rid)) {
                if (Deno.noColor) {
                    blue = "";
                    green1 = "";
                    defaultColor = "";
                    red1 = "";
                } else {
                    blue = "\u001b[34m";
                    green1 = "\u001b[32m";
                    defaultColor = "\u001b[39m";
                    red1 = "\u001b[31m";
                }
            }
            if (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null && "stack" in actual && actual instanceof Error1 && "stack" in expected && expected instanceof Error1) {
                actual = copyError(actual);
                expected = copyError(expected);
            }
            if (operator === "deepStrictEqual" || operator === "strictEqual") {
                super(createErrDiff(actual, expected, operator));
            } else if (operator === "notDeepStrictEqual" || operator === "notStrictEqual") {
                let base = kReadableOperator[operator];
                const res = inspectValue(actual).split("\n");
                if (operator === "notStrictEqual" && (typeof actual === "object" && actual !== null || typeof actual === "function")) {
                    base = kReadableOperator.notStrictEqualObject;
                }
                if (res.length > 50) {
                    res[46] = `${blue}...${defaultColor}`;
                    while(res.length > 47){
                        res.pop();
                    }
                }
                if (res.length === 1) {
                    super(`${base}${res[0].length > 5 ? "\n\n" : " "}${res[0]}`);
                } else {
                    super(`${base}\n\n${res.join("\n")}\n`);
                }
            } else {
                let res1 = inspectValue(actual);
                let other = inspectValue(expected);
                const knownOperator = kReadableOperator[operator ?? ""];
                if (operator === "notDeepEqual" && res1 === other) {
                    res1 = `${knownOperator}\n\n${res1}`;
                    if (res1.length > 1024) {
                        res1 = `${res1.slice(0, 1021)}...`;
                    }
                    super(res1);
                } else {
                    if (res1.length > 512) {
                        res1 = `${res1.slice(0, 509)}...`;
                    }
                    if (other.length > 512) {
                        other = `${other.slice(0, 509)}...`;
                    }
                    if (operator === "deepEqual") {
                        res1 = `${knownOperator}\n\n${res1}\n\nshould loosely deep-equal\n\n`;
                    } else {
                        const newOp = kReadableOperator[`${operator}Unequal`];
                        if (newOp) {
                            res1 = `${newOp}\n\n${res1}\n\nshould not loosely deep-equal\n\n`;
                        } else {
                            other = ` ${operator} ${other}`;
                        }
                    }
                    super(`${res1}${other}`);
                }
            }
        }
        Error1.stackTraceLimit = limit;
        this.generatedMessage = !message;
        ObjectDefineProperty(this, "name", {
            value: "AssertionError [ERR_ASSERTION]",
            enumerable: false,
            writable: true,
            configurable: true
        });
        this.code = "ERR_ASSERTION";
        if (details) {
            this.actual = undefined;
            this.expected = undefined;
            this.operator = undefined;
            for(let i = 0; i < details.length; i++){
                this["message " + i] = details[i].message;
                this["actual " + i] = details[i].actual;
                this["expected " + i] = details[i].expected;
                this["operator " + i] = details[i].operator;
                this["stack trace " + i] = details[i].stack;
            }
        } else {
            this.actual = actual;
            this.expected = expected;
            this.operator = operator;
        }
        Error1.captureStackTrace(this, stackStartFn || stackStartFunction);
        this.stack;
        this.name = "AssertionError";
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
    [inspect.custom](_recurseTimes, ctx) {
        const tmpActual = this.actual;
        const tmpExpected = this.expected;
        for (const name of [
            "actual",
            "expected"
        ]){
            if (typeof this[name] === "string") {
                const value = this[name];
                const lines = value.split("\n");
                if (lines.length > 10) {
                    lines.length = 10;
                    this[name] = `${lines.join("\n")}\n...`;
                } else if (value.length > 512) {
                    this[name] = `${value.slice(512)}...`;
                }
            }
        }
        const result = inspect(this, {
            ...ctx,
            customInspect: false,
            depth: 0
        });
        this.actual = tmpActual;
        this.expected = tmpExpected;
        return result;
    }
}
function createAssertionError(options) {
    const error = new AssertionError1(options);
    if (options.generatedMessage) {
        error.generatedMessage = true;
    }
    return error;
}
function toNode(fn, opts) {
    const { operator , message , actual , expected  } = opts || {};
    try {
        fn();
    } catch (e) {
        if (e instanceof AssertionError) {
            if (typeof message === "string") {
                throw new AssertionError1({
                    operator,
                    message,
                    actual,
                    expected
                });
            } else if (message instanceof Error) {
                throw message;
            } else {
                throw new AssertionError1({
                    operator,
                    message: e.message,
                    actual,
                    expected
                });
            }
        }
        throw e;
    }
}
function assert2(actual, message) {
    if (arguments.length === 0) {
        throw new AssertionError1({
            message: "No value argument passed to `assert.ok()`"
        });
    }
    toNode(()=>assert(actual), {
        message,
        actual,
        expected: true
    });
}
const ok = assert2;
function __throws(fn, error, message) {
    if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", "function", fn);
    }
    if (typeof error === "object" && error !== null && Object.getPrototypeOf(error) === Object.prototype && Object.keys(error).length === 0) {
        throw new ERR_INVALID_ARG_VALUE("error", error, "may not be an empty object");
    }
    if (typeof message === "string") {
        if (!(error instanceof RegExp) && typeof error !== "function" && !(error instanceof Error) && typeof error !== "object") {
            throw new ERR_INVALID_ARG_TYPE("error", [
                "Function",
                "Error",
                "RegExp",
                "Object"
            ], error);
        }
    } else {
        if (typeof error !== "undefined" && typeof error !== "string" && !(error instanceof RegExp) && typeof error !== "function" && !(error instanceof Error) && typeof error !== "object") {
            throw new ERR_INVALID_ARG_TYPE("error", [
                "Function",
                "Error",
                "RegExp",
                "Object"
            ], error);
        }
    }
    try {
        fn();
    } catch (e) {
        if (validateThrownError(e, error, message, {
            operator: __throws
        })) {
            return;
        }
    }
    if (message) {
        let msg = `Missing expected exception: ${message}`;
        if (typeof error === "function" && error?.name) {
            msg = `Missing expected exception (${error.name}): ${message}`;
        }
        throw new AssertionError1({
            message: msg,
            operator: "throws",
            actual: undefined,
            expected: error
        });
    } else if (typeof error === "string") {
        throw new AssertionError1({
            message: `Missing expected exception: ${error}`,
            operator: "throws",
            actual: undefined,
            expected: undefined
        });
    } else if (typeof error === "function" && error?.prototype !== undefined) {
        throw new AssertionError1({
            message: `Missing expected exception (${error.name}).`,
            operator: "throws",
            actual: undefined,
            expected: error
        });
    } else {
        throw new AssertionError1({
            message: "Missing expected exception.",
            operator: "throws",
            actual: undefined,
            expected: error
        });
    }
}
function doesNotThrow(fn, expected, message) {
    if (typeof fn !== "function") {
        throw new ERR_INVALID_ARG_TYPE("fn", "function", fn);
    } else if (!(expected instanceof RegExp) && typeof expected !== "function" && typeof expected !== "string" && typeof expected !== "undefined") {
        throw new ERR_INVALID_ARG_TYPE("expected", [
            "Function",
            "RegExp"
        ], fn);
    }
    try {
        fn();
    } catch (e) {
        gotUnwantedException(e, expected, message, doesNotThrow);
    }
    return;
}
function equal1(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    if (actual == expected) {
        return;
    }
    if (Number.isNaN(actual) && Number.isNaN(expected)) {
        return;
    }
    if (typeof message === "string") {
        throw new AssertionError1({
            message
        });
    } else if (message instanceof Error) {
        throw message;
    }
    toNode(()=>assertStrictEquals(actual, expected), {
        message: message || `${actual} == ${expected}`,
        operator: "==",
        actual,
        expected
    });
}
function notEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    if (Number.isNaN(actual) && Number.isNaN(expected)) {
        throw new AssertionError1({
            message: `${actual} != ${expected}`,
            operator: "!=",
            actual,
            expected
        });
    }
    if (actual != expected) {
        return;
    }
    if (typeof message === "string") {
        throw new AssertionError1({
            message
        });
    } else if (message instanceof Error) {
        throw message;
    }
    toNode(()=>assertNotStrictEquals(actual, expected), {
        message: message || `${actual} != ${expected}`,
        operator: "!=",
        actual,
        expected
    });
}
function strictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>assertStrictEquals(actual, expected), {
        message,
        operator: "strictEqual",
        actual,
        expected
    });
}
function notStrictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>assertNotStrictEquals(actual, expected), {
        message,
        actual,
        expected,
        operator: "notStrictEqual"
    });
}
function deepEqual() {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    throw new Error("Not implemented");
}
function notDeepEqual() {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    throw new Error("Not implemented");
}
function deepStrictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>assertEquals(actual, expected), {
        message,
        actual,
        expected,
        operator: "deepStrictEqual"
    });
}
function notDeepStrictEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "expected");
    }
    toNode(()=>assertNotEquals(actual, expected), {
        message,
        actual,
        expected,
        operator: "deepNotStrictEqual"
    });
}
function fail(message) {
    if (typeof message === "string" || message == null) {
        throw createAssertionError({
            message: message ?? "Failed",
            operator: "fail",
            generatedMessage: message == null
        });
    } else {
        throw message;
    }
}
function match(actual, regexp, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("actual", "regexp");
    }
    if (!(regexp instanceof RegExp)) {
        throw new ERR_INVALID_ARG_TYPE("regexp", "RegExp", regexp);
    }
    toNode(()=>assertMatch(actual, regexp), {
        message,
        actual,
        expected: regexp,
        operator: "match"
    });
}
function doesNotMatch(string, regexp, message) {
    if (arguments.length < 2) {
        throw new ERR_MISSING_ARGS("string", "regexp");
    }
    if (!(regexp instanceof RegExp)) {
        throw new ERR_INVALID_ARG_TYPE("regexp", "RegExp", regexp);
    }
    if (typeof string !== "string") {
        if (message instanceof Error) {
            throw message;
        }
        throw new AssertionError1({
            message: message || `The "string" argument must be of type string. Received type ${typeof string} (${inspect(string)})`,
            actual: string,
            expected: regexp,
            operator: "doesNotMatch"
        });
    }
    toNode(()=>assertNotMatch(string, regexp), {
        message,
        actual: string,
        expected: regexp,
        operator: "doesNotMatch"
    });
}
function strict(actual, message) {
    if (arguments.length === 0) {
        throw new AssertionError1({
            message: "No value argument passed to `assert.ok()`"
        });
    }
    assert2(actual, message);
}
function rejects(asyncFn, error, message) {
    let promise;
    if (typeof asyncFn === "function") {
        try {
            promise = asyncFn();
        } catch (err) {
            return Promise.reject(err);
        }
        if (!isValidThenable(promise)) {
            return Promise.reject(new ERR_INVALID_RETURN_VALUE("instance of Promise", "promiseFn", promise));
        }
    } else if (!isValidThenable(asyncFn)) {
        return Promise.reject(new ERR_INVALID_ARG_TYPE("promiseFn", [
            "function",
            "Promise"
        ], asyncFn));
    } else {
        promise = asyncFn;
    }
    function onFulfilled() {
        let message = "Missing expected rejection";
        if (typeof error === "string") {
            message += `: ${error}`;
        } else if (typeof error === "function" && error.prototype !== undefined) {
            message += ` (${error.name}).`;
        } else {
            message += ".";
        }
        return Promise.reject(createAssertionError({
            message,
            operator: "rejects",
            generatedMessage: true
        }));
    }
    function rejects_onRejected(e) {
        if (validateThrownError(e, error, message, {
            operator: rejects,
            validationFunctionName: "validate"
        })) {
            return;
        }
    }
    return promise.then(onFulfilled, rejects_onRejected);
}
function doesNotReject(asyncFn, error, message) {
    let promise;
    if (typeof asyncFn === "function") {
        try {
            const value = asyncFn();
            if (!isValidThenable(value)) {
                return Promise.reject(new ERR_INVALID_RETURN_VALUE("instance of Promise", "promiseFn", value));
            }
            promise = value;
        } catch (e) {
            return Promise.reject(e);
        }
    } else if (!isValidThenable(asyncFn)) {
        return Promise.reject(new ERR_INVALID_ARG_TYPE("promiseFn", [
            "function",
            "Promise"
        ], asyncFn));
    } else {
        promise = asyncFn;
    }
    return promise.then(()=>{}, (e)=>gotUnwantedException(e, error, message, doesNotReject));
}
function gotUnwantedException(e, expected, message, operator) {
    if (typeof expected === "string") {
        throw new AssertionError1({
            message: `Got unwanted exception: ${expected}\nActual message: "${e.message}"`,
            operator: operator.name
        });
    } else if (typeof expected === "function" && expected.prototype !== undefined) {
        if (e instanceof expected) {
            let msg = `Got unwanted exception: ${e.constructor?.name}`;
            if (message) {
                msg += ` ${String(message)}`;
            }
            throw new AssertionError1({
                message: msg,
                operator: operator.name
            });
        } else if (expected.prototype instanceof Error) {
            throw e;
        } else {
            const result = expected(e);
            if (result === true) {
                let msg1 = `Got unwanted rejection.\nActual message: "${e.message}"`;
                if (message) {
                    msg1 += ` ${String(message)}`;
                }
                throw new AssertionError1({
                    message: msg1,
                    operator: operator.name
                });
            }
        }
        throw e;
    } else {
        if (message) {
            throw new AssertionError1({
                message: `Got unwanted exception: ${message}\nActual message: "${e ? e.message : String(e)}"`,
                operator: operator.name
            });
        }
        throw new AssertionError1({
            message: `Got unwanted exception.\nActual message: "${e ? e.message : String(e)}"`,
            operator: operator.name
        });
    }
}
function validateThrownError(e, error, message, options) {
    if (typeof error === "string") {
        if (message != null) {
            throw new ERR_INVALID_ARG_TYPE("error", [
                "Object",
                "Error",
                "Function",
                "RegExp"
            ], error);
        } else if (typeof e === "object" && e !== null) {
            if (e.message === error) {
                throw new ERR_AMBIGUOUS_ARGUMENT("error/message", `The error message "${e.message}" is identical to the message.`);
            }
        } else if (e === error) {
            throw new ERR_AMBIGUOUS_ARGUMENT("error/message", `The error "${e}" is identical to the message.`);
        }
        message = error;
        error = undefined;
    }
    if (error instanceof Function && error.prototype !== undefined && error.prototype instanceof Error) {
        if (e instanceof error) {
            return true;
        }
        throw createAssertionError({
            message: `The error is expected to be an instance of "${error.name}". Received "${e?.constructor?.name}"\n\nError message:\n\n${e?.message}`,
            actual: e,
            expected: error,
            operator: options.operator.name,
            generatedMessage: true
        });
    }
    if (error instanceof Function) {
        const received = error(e);
        if (received === true) {
            return true;
        }
        throw createAssertionError({
            message: `The ${options.validationFunctionName ? `"${options.validationFunctionName}" validation` : "validation"} function is expected to return "true". Received ${inspect(received)}\n\nCaught error:\n\n${e}`,
            actual: e,
            expected: error,
            operator: options.operator.name,
            generatedMessage: true
        });
    }
    if (error instanceof RegExp) {
        if (error.test(String(e))) {
            return true;
        }
        throw createAssertionError({
            message: `The input did not match the regular expression ${error.toString()}. Input:\n\n'${String(e)}'\n`,
            actual: e,
            expected: error,
            operator: options.operator.name,
            generatedMessage: true
        });
    }
    if (typeof error === "object" && error !== null) {
        const keys = Object.keys(error);
        if (error instanceof Error) {
            keys.push("name", "message");
        }
        for (const k of keys){
            if (e == null) {
                throw createAssertionError({
                    message: message || "object is expected to thrown, but got null",
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            if (typeof e === "string") {
                throw createAssertionError({
                    message: message || `object is expected to thrown, but got string: ${e}`,
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            if (typeof e === "number") {
                throw createAssertionError({
                    message: message || `object is expected to thrown, but got number: ${e}`,
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            if (!(k in e)) {
                throw createAssertionError({
                    message: message || `A key in the expected object is missing: ${k}`,
                    actual: e,
                    expected: error,
                    operator: options.operator.name,
                    generatedMessage: message == null
                });
            }
            const actual = e[k];
            const expected = error[k];
            if (typeof actual === "string" && expected instanceof RegExp) {
                match(actual, expected);
            } else {
                deepStrictEqual(actual, expected);
            }
        }
        return true;
    }
    if (typeof error === "undefined") {
        return true;
    }
    throw createAssertionError({
        message: `Invalid expectation: ${error}`,
        operator: options.operator.name,
        generatedMessage: true
    });
}
function isValidThenable(maybeThennable) {
    if (!maybeThennable) {
        return false;
    }
    if (maybeThennable instanceof Promise) {
        return true;
    }
    const isThenable = typeof maybeThennable.then === "function" && typeof maybeThennable.catch === "function";
    return isThenable && typeof maybeThennable !== "function";
}
Object.assign(strict, {
    AssertionError: AssertionError1,
    deepEqual: deepStrictEqual,
    deepStrictEqual,
    doesNotMatch,
    doesNotReject,
    doesNotThrow,
    equal: strictEqual,
    fail,
    match,
    notDeepEqual: notDeepStrictEqual,
    notDeepStrictEqual,
    notEqual: notStrictEqual,
    notStrictEqual,
    ok,
    rejects,
    strict,
    strictEqual,
    throws: __throws
});
const __default4 = Object.assign(assert2, {
    AssertionError: AssertionError1,
    deepEqual,
    deepStrictEqual,
    doesNotMatch,
    doesNotReject,
    doesNotThrow,
    equal: equal1,
    fail,
    match,
    notDeepEqual,
    notDeepStrictEqual,
    notEqual,
    notStrictEqual,
    ok,
    rejects,
    strict,
    strictEqual,
    throws: __throws
});
const MAX_RANDOM_VALUES = 65536;
function generateRandomBytes(size) {
    if (size > 4294967295) {
        throw new RangeError(`The value of "size" is out of range. It must be >= 0 && <= ${4294967295}. Received ${size}`);
    }
    const bytes = Buffer.allocUnsafe(size);
    if (size > 65536) {
        for(let generated = 0; generated < size; generated += MAX_RANDOM_VALUES){
            crypto.getRandomValues(bytes.slice(generated, generated + 65536));
        }
    } else {
        crypto.getRandomValues(bytes);
    }
    return bytes;
}
function randomBytes(size, cb) {
    if (typeof cb === "function") {
        let err = null, bytes;
        try {
            bytes = generateRandomBytes(size);
        } catch (e) {
            if (e instanceof RangeError && e.message.includes('The value of "size" is out of range')) {
                throw e;
            } else {
                err = e;
            }
        }
        setTimeout(()=>{
            if (err) {
                cb(err);
            } else {
                cb(null, bytes);
            }
        }, 0);
    } else {
        return generateRandomBytes(size);
    }
}
let cachedTextDecoder = new TextDecoder("utf-8", {
    ignoreBOM: true,
    fatal: true
});
cachedTextDecoder.decode();
let cachegetUint8Memory0 = null;
function getUint8Memory0() {
    if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
        cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachegetUint8Memory0;
}
function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
const heap = new Array(32).fill(undefined);
heap.push(undefined, null, true, false);
let heap_next = heap.length;
function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
}
function getObject(idx) {
    return heap[idx];
}
function dropObject(idx) {
    if (idx < 36) return;
    heap[idx] = heap_next;
    heap_next = idx;
}
function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}
let WASM_VECTOR_LEN = 0;
let cachedTextEncoder = new TextEncoder("utf-8");
const encodeString = function(arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
};
function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length);
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }
    let len = arg.length;
    let ptr1 = malloc(len);
    const mem = getUint8Memory0();
    let offset = 0;
    for(; offset < len; offset++){
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr1 + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr1 = realloc(ptr1, len, len = offset + arg.length * 3);
        const view = getUint8Memory0().subarray(ptr1 + offset, ptr1 + len);
        const ret = encodeString(arg, view);
        offset += ret.written;
    }
    WASM_VECTOR_LEN = offset;
    return ptr1;
}
function create_hash(algorithm) {
    var ptr0 = passStringToWasm0(algorithm, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    var ret = wasm.create_hash(ptr0, len0);
    return DenoHash.__wrap(ret);
}
function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
    return instance.ptr;
}
function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1);
    getUint8Memory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
function update_hash(hash, data) {
    _assertClass(hash, DenoHash);
    var ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.update_hash(hash.ptr, ptr0, len0);
}
let cachegetInt32Memory0 = null;
function getInt32Memory0() {
    if (cachegetInt32Memory0 === null || cachegetInt32Memory0.buffer !== wasm.memory.buffer) {
        cachegetInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachegetInt32Memory0;
}
function getArrayU8FromWasm0(ptr, len) {
    return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}
function digest_hash(hash) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        _assertClass(hash, DenoHash);
        wasm.digest_hash(retptr, hash.ptr);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var v0 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v0;
    } finally{
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
const DenoHashFinalization = new FinalizationRegistry((ptr)=>wasm.__wbg_denohash_free(ptr));
class DenoHash {
    static __wrap(ptr) {
        const obj = Object.create(DenoHash.prototype);
        obj.ptr = ptr;
        DenoHashFinalization.register(obj, obj.ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.ptr;
        this.ptr = 0;
        DenoHashFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_denohash_free(ptr);
    }
}
const imports = {
    __wbindgen_placeholder__: {
        __wbindgen_string_new: function(arg0, arg1) {
            var ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_throw: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_rethrow: function(arg0) {
            throw takeObject(arg0);
        }
    }
};
const wasmModule = new WebAssembly.Module(decode1("AGFzbQEAAAAB64CAgAAQYAAAYAF/AGABfwF/YAF/AX5gAn9/AGACf38Bf2ADf39/AGADf39/AX9gBH\
9/f38Bf2AFf39/f38AYAV/f39/fwF/YAZ/f39/f38Bf2AFf39/fn8AYAd/f39+f39/AX9gAn9+AGAC\
fn8BfwKMgYCAAAMYX193YmluZGdlbl9wbGFjZWhvbGRlcl9fFV9fd2JpbmRnZW5fc3RyaW5nX25ldw\
AFGF9fd2JpbmRnZW5fcGxhY2Vob2xkZXJfXxBfX3diaW5kZ2VuX3Rocm93AAQYX193YmluZGdlbl9w\
bGFjZWhvbGRlcl9fEl9fd2JpbmRnZW5fcmV0aHJvdwABA8aBgIAAxAEGBgUEBAYCDAYEBA0EAQQEAQ\
cFBA4ECgQEBwQEBAQECwQEBAQEBAQEBAQEBAQEAQQEBAQEBAQEBAUHBAQEBAYGBgYEBAQPAQQEBAEE\
BAQEBgYGBgYEBAQEBAQGBAQGBAYEBAQEBAQEBAQGBAQEBAQEBAQEBgQEBAQEBAQECQUFAQEGBgYGBg\
QBBQAEBwcBBggBBgEBBwEBAQQBBwIBBwEBBQUCBQUGAQEBAQQABQIAAAUEAQMCAgICAgICAgICAgIC\
AAQBBIWAgIAAAXABcXEFg4CAgAABABEGiYCAgAABfwFBgIDAAAsHroGAgAAJBm1lbW9yeQIAE19fd2\
JnX2Rlbm9oYXNoX2ZyZWUAkAELY3JlYXRlX2hhc2gABQt1cGRhdGVfaGFzaACRAQtkaWdlc3RfaGFz\
aACNARFfX3diaW5kZ2VuX21hbGxvYwCeARJfX3diaW5kZ2VuX3JlYWxsb2MAoAEfX193YmluZGdlbl\
9hZGRfdG9fc3RhY2tfcG9pbnRlcgCwAQ9fX3diaW5kZ2VuX2ZyZWUArQEJnoGAgAABAEEBC3CnAcUB\
rwGmAbMBxgFdGGFNwQE4VVhlnwG9AXVTV2R0VDlZmQG/AWpWHjCTAcABT2I6WpoBa2AvR5UBuwFzLT\
KWAbwBclIaJ4MBwwFfGyyCAcIBXkM/RqsBuAF4QTQ2rAG5AXxEJCWqAbcBfkIoKqkBugF9PkV6MzV5\
IyZ7KSt3ogELITeKAb4BH44BO4sBpAGAAYEBtgGjAQqChIeAAMQBkVoCAX8ifiMAQYABayIDJAAgA0\
EAQYABEJ0BIQMgACkDOCEEIAApAzAhBSAAKQMoIQYgACkDICEHIAApAxghCCAAKQMQIQkgACkDCCEK\
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\
CnZzaiAeaiAiICVqIhsgAiAhc3EgIXNqIBtBGncgG0EVd3MgG0EHd3NqQfLxxbN8aiIeaiELIBwgCm\
ohCiAjIAlqIQkgICAIaiEIIB0gB2ogHmohByAbIAZqIQYgAiAFaiEFICEgBGohBCABQcAAaiIBIAxH\
DQALCyAAIAQ2AhwgACAFNgIYIAAgBjYCFCAAIAc2AhAgACAINgIMIAAgCTYCCCAAIAo2AgQgACALNg\
IAC7U7Agl/BH4jAEHgA2siAiQAIAIgATYCDCACIAA2AggCQAJAAkACQAJAAkACQAJAAkACQAJAAkAC\
QAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAk\
ACQAJAAkAgAUF9ag4HABITAhMDARMLIABBgIDAAEEDEI8BRQ0DIABBqIDAAEEDEI8BRQ0EIABB0IDA\
AEEDEI8BDRIgAkG6AWpCADcBACACQcIBakEAOwEAIAJBsAFqQRRqQgA3AgAgAkGwAWpBHGpCADcCAC\
ACQbABakEkakIANwIAIAJBsAFqQSxqQgA3AgAgAkGwAWpBNGpCADcCACACQbABakE8akEAOgAAIAJB\
7QFqQQA2AAAgAkHxAWpBADsAACACQfMBakEAOgAAIAJBwAA2ArABIAJBADsBtAEgAkEANgG2ASACQc\
gCaiACQbABakHEABCXARogAkHYAGoiAyACQcgCakE8aikCADcDACACQdAAaiIEIAJByAJqQTRqKQIA\
NwMAIAJByABqIgUgAkHIAmpBLGopAgA3AwAgAkHAAGoiBiACQcgCakEkaikCADcDACACQThqIgcgAk\
HIAmpBHGopAgA3AwAgAkEwaiIIIAJByAJqQRRqKQIANwMAIAJBIGpBCGoiCSACQdQCaikCADcDACAC\
IAIpAswCNwMgQeAAEAkiCkUNFSAKQQA2AgggCkIANwMAIAogAikDIDcCDCAKQRRqIAkpAwA3AgAgCk\
EcaiAIKQMANwIAIApBJGogBykDADcCACAKQSxqIAYpAwA3AgAgCkE0aiAFKQMANwIAIApBPGogBCkD\
ADcCACAKQcQAaiADKQMANwIAIApB1ABqQQApApibQDcCACAKQQApApCbQDcCTEHUgMAAIQRBACEDDC\
gLIABB+IDAAEEJEI8BRQ0EIABBqIHAAEEJEI8BRQ0FIABBvITAACABEI8BRQ0NIABB7ITAACABEI8B\
RQ0OIABBnIXAACABEI8BRQ0PIABBzIXAACABEI8BDREgAkG6AWpCADcBACACQcIBakEAOwEAIAJBxA\
FqQgA3AgAgAkHMAWpCADcCACACQdQBakIANwIAIAJB3AFqQgA3AgAgAkHkAWpCADcCACACQewBakEA\
OgAAIAJB7QFqQgA3AAAgAkH1AWpBADYAACACQfkBakEAOwAAIAJB+wFqQQA6AAAgAkHIADYCsAEgAk\
EAOwG0ASACQQA2AbYBIAJByAJqIAJBsAFqQcwAEJcBGiACQSBqIAJByAJqQQRyQcgAEJcBGkGYAhAJ\
IgpFDSIgCkEAQcwBEJ0BQcwBaiACQSBqQcgAEJcBGkHYhcAAIQRBACEDDCcLIABB/IHAAEEGEI8BRQ\
0FIABBqILAAEEGEI8BRQ0GIABB1ILAAEEGEI8BRQ0HIABBgIPAAEEGEI8BRQ0IIABB/IXAAEEGEI8B\
DRAgAkHlAmoiA0EAKQOQnUAiCzcAACACQd0CakEAKQOInUAiDDcAACACQdUCakEAKQOAnUAiDTcAAC\
ACQQApA/icQCIONwDNAkH4DhAJIgpFDSIgCkIANwMAIAogDjcDCCAKQRBqIA03AwAgCkEYaiAMNwMA\
IApBIGogCzcDACAKQShqQQBBwwAQnQEaIApBADoA8A4gCkGIAWogAykAADcAACAKQYMBaiACQcgCak\
EYaikAADcAACAKQfsAaiACQcgCakEQaikAADcAACAKQfMAaiACQdACaikAADcAACAKIAIpAMgCNwBr\
QYSGwAAhBEEAIQMMJgsgACkAAELz0IWb08WMmTRRDQggACkAAELz0IWb08XMmjZRDQkgACkAAELz0I\
Wb0+WMnDRRDQogACkAAELz0IWb06XNmDJSDQ8gAkG6AWpCADcBACACQcIBakEAOwEAIAJBxAFqQgA3\
AgAgAkHMAWpCADcCACACQdQBakIANwIAIAJB3AFqQgA3AgAgAkHkAWpCADcCACACQewBakEAOgAAIA\
JB7QFqQgA3AAAgAkH1AWpBADYAACACQfkBakEAOwAAIAJB+wFqQQA6AAAgAkHIADYCsAEgAkEAOwG0\
ASACQQA2AbYBIAJByAJqIAJBsAFqQcwAEJcBGiACQSBqIAJByAJqQQRyQcgAEJcBGkGYAhAJIgpFDR\
wgCkEAQcwBEJ0BQcwBaiACQSBqQcgAEJcBGkGYhMAAIQRBACEDDCULIAJBugFqIgpCADcBACACQcIB\
aiIEQQA7AQAgAkEQNgKwASACQQA7AbQBIAJBADYBtgEgAkHIAmpBEGoiBSACQbABakEQaiIGKAIANg\
IAIAJByAJqQQhqIgMgAkGwAWpBCGoiBykDADcDACACQSBqQQhqIgggAkHIAmpBDGoiCSkCADcDACAC\
IAIpA7ABNwPIAiACIAIpAswCNwMgIApCADcBACAEQQA7AQAgAkEQNgKwASACQQA7AbQBIAJBADYBtg\
EgBSAGKAIANgIAIAMgBykDADcDACACIAIpA7ABNwPIAiACQRBqQQhqIgQgCSkCADcDACACIAIpAswC\
NwMQIAMgCCkDADcDACACIAIpAyA3A8gCQdQAEAkiCkUNDyAKQQA2AgAgCiACKQPIAjcCBCAKQgA3Ah\
QgCiACKQMQNwJEIApBHGpCADcCACAKQSRqQgA3AgAgCkEsakIANwIAIApBNGpCADcCACAKQTxqQgA3\
AgAgCkEMaiADKQMANwIAIApBzABqIAQpAwA3AgBBhIDAACEEQQAhAwwkCyACQboBakIANwEAIAJBwg\
FqQQA7AQAgAkGwAWpBFGpCADcCACACQbABakEcakIANwIAIAJBsAFqQSRqQgA3AgAgAkGwAWpBLGpC\
ADcCACACQbABakE0akIANwIAIAJBsAFqQTxqQQA6AAAgAkHtAWpBADYAACACQfEBakEAOwAAIAJB8w\
FqQQA6AAAgAkHAADYCsAEgAkEAOwG0ASACQQA2AbYBIAJByAJqIAJBsAFqQcQAEJcBGiACQdgAaiID\
IAJByAJqQTxqKQIANwMAIAJB0ABqIgQgAkHIAmpBNGopAgA3AwAgAkHIAGoiBSACQcgCakEsaikCAD\
cDACACQcAAaiIGIAJByAJqQSRqKQIANwMAIAJBOGoiByACQcgCakEcaikCADcDACACQTBqIgggAkHI\
AmpBFGopAgA3AwAgAkEgakEIaiIJIAJB1AJqKQIANwMAIAIgAikCzAI3AyBB4AAQCSIKRQ0PIApBAD\
YCCCAKQgA3AwAgCiACKQMgNwIMIApBFGogCSkDADcCACAKQRxqIAgpAwA3AgAgCkEkaiAHKQMANwIA\
IApBLGogBikDADcCACAKQTRqIAUpAwA3AgAgCkE8aiAEKQMANwIAIApBxABqIAMpAwA3AgAgCkHUAG\
pBACkCmJtANwIAIApBACkCkJtANwJMQayAwAAhBEEAIQMMIwsgAkG6AWpCADcBACACQcIBakEAOwEA\
IAJBsAFqQRRqQgA3AgAgAkGwAWpBHGpCADcCACACQbABakEkakIANwIAIAJBsAFqQSxqQgA3AgAgAk\
GwAWpBNGpCADcCACACQbABakE8akEAOgAAIAJB7QFqQQA2AAAgAkHxAWpBADsAACACQfMBakEAOgAA\
IAJBwAA2ArABIAJBADsBtAEgAkEANgG2ASACQcgCaiACQbABakHEABCXARogAkEgakE4aiIDIAJByA\
JqQTxqKQIANwMAIAJBIGpBMGoiBCACQcgCakE0aikCADcDACACQSBqQShqIgUgAkHIAmpBLGopAgA3\
AwAgAkHAAGoiBiACQcgCakEkaikCADcDACACQSBqQRhqIgcgAkHIAmpBHGopAgA3AwAgAkEgakEQai\
IIIAJByAJqQRRqKQIANwMAIAJBIGpBCGoiCSACQdQCaikCADcDACACIAIpAswCNwMgQeAAEAkiCkUN\
ECAKQgA3AwAgCkEANgIcIAogAikDIDcCICAKQQApA8ibQDcDCCAKQRBqQQApA9CbQDcDACAKQRhqQQ\
AoAtibQDYCACAKQShqIAkpAwA3AgAgCkEwaiAIKQMANwIAIApBOGogBykDADcCACAKQcAAaiAGKQMA\
NwIAIApByABqIAUpAwA3AgAgCkHQAGogBCkDADcCACAKQdgAaiADKQMANwIAQYSBwAAhBEEAIQMMIg\
sgAkG6AWpCADcBACACQcIBakEAOwEAIAJBsAFqQRRqQgA3AgAgAkGwAWpBHGpCADcCACACQbABakEk\
akIANwIAIAJBsAFqQSxqQgA3AgAgAkGwAWpBNGpCADcCACACQbABakE8akEAOgAAIAJB7QFqQQA2AA\
AgAkHxAWpBADsAACACQfMBakEAOgAAIAJBwAA2ArABIAJBADsBtAEgAkEANgG2ASACQcgCaiACQbAB\
akHEABCXARogAkHYAGoiAyACQcgCakE8aikCADcDACACQdAAaiIEIAJByAJqQTRqKQIANwMAIAJBIG\
pBKGoiBSACQcgCakEsaikCADcDACACQSBqQSBqIgYgAkHIAmpBJGopAgA3AwAgAkEgakEYaiIHIAJB\
yAJqQRxqKQIANwMAIAJBIGpBEGoiCCACQcgCakEUaikCADcDACACQSBqQQhqIgkgAkHUAmopAgA3Aw\
AgAiACKQLMAjcDIEH4ABAJIgpFDRAgCkIANwMAIApBADYCMCAKIAIpAyA3AjQgCkEAKQOgm0A3Awgg\
CkEQakEAKQOom0A3AwAgCkEYakEAKQOwm0A3AwAgCkEgakEAKQO4m0A3AwAgCkEoakEAKQPAm0A3Aw\
AgCkE8aiAJKQMANwIAIApBxABqIAgpAwA3AgAgCkHMAGogBykDADcCACAKQdQAaiAGKQMANwIAIApB\
3ABqIAUpAwA3AgAgCkHkAGogBCkDADcCACAKQewAaiADKQMANwIAQbSBwAAhBEEAIQMMIQsgAkG6AW\
pCADcBACACQcIBakEAOwEAIAJBsAFqQRRqQgA3AgAgAkGwAWpBHGpCADcCACACQbABakEkakIANwIA\
IAJBsAFqQSxqQgA3AgAgAkGwAWpBNGpCADcCACACQbABakE8akEAOgAAIAJB7QFqQQA2AAAgAkHxAW\
pBADsAACACQfMBakEAOgAAIAJBwAA2ArABIAJBADsBtAEgAkEANgG2ASACQcgCaiACQbABakHEABCX\
ARogAkHYAGoiAyACQcgCakE8aikCADcDACACQdAAaiIEIAJByAJqQTRqKQIANwMAIAJByABqIgUgAk\
HIAmpBLGopAgA3AwAgAkHAAGoiBiACQcgCakEkaikCADcDACACQThqIgcgAkHIAmpBHGopAgA3AwAg\
AkEwaiIIIAJByAJqQRRqKQIANwMAIAJBIGpBCGoiCSACQdQCaikCADcDACACIAIpAswCNwMgQfAAEA\
kiCkUNECAKIAIpAyA3AgwgCkEANgIIIApCADcDACAKQRxqIAgpAwA3AgAgCkEUaiAJKQMANwIAIApB\
JGogBykDADcCACAKQSxqIAYpAwA3AgAgCkE0aiAFKQMANwIAIApBPGogBCkDADcCACAKQcQAaiADKQ\
MANwIAIApB1ABqQQApAuCcQDcCACAKQQApAticQDcCTCAKQeQAakEAKQLwnEA3AgAgCkHcAGpBACkC\
6JxANwIAQYSCwAAhBEEAIQMMIAsgAkG6AWpCADcBACACQcIBakEAOwEAIAJBsAFqQRRqQgA3AgAgAk\
GwAWpBHGpCADcCACACQbABakEkakIANwIAIAJBsAFqQSxqQgA3AgAgAkGwAWpBNGpCADcCACACQbAB\
akE8akEAOgAAIAJB7QFqQQA2AAAgAkHxAWpBADsAACACQfMBakEAOgAAIAJBwAA2ArABIAJBADsBtA\
EgAkEANgG2ASACQcgCaiACQbABakHEABCXARogAkHYAGoiAyACQcgCakE8aikCADcDACACQdAAaiIE\
IAJByAJqQTRqKQIANwMAIAJByABqIgUgAkHIAmpBLGopAgA3AwAgAkHAAGoiBiACQcgCakEkaikCAD\
cDACACQThqIgcgAkHIAmpBHGopAgA3AwAgAkEwaiIIIAJByAJqQRRqKQIANwMAIAJBIGpBCGoiCSAC\
QdQCaikCADcDACACIAIpAswCNwMgQfAAEAkiCkUNECAKIAIpAyA3AgwgCkEANgIIIApCADcDACAKQR\
xqIAgpAwA3AgAgCkEUaiAJKQMANwIAIApBJGogBykDADcCACAKQSxqIAYpAwA3AgAgCkE0aiAFKQMA\
NwIAIApBPGogBCkDADcCACAKQcQAaiADKQMANwIAIApB1ABqQQApA4CdQDcCACAKQQApA/icQDcCTC\
AKQeQAakEAKQOQnUA3AgAgCkHcAGpBACkDiJ1ANwIAQbCCwAAhBEEAIQMMHwsgAkEANgKwASACQbAB\
akEEciEDQQAhCgNAIAMgCmpBADoAACACIAIoArABQQFqNgKwASAKQQFqIgpBgAFHDQALIAJByAJqIA\
JBsAFqQYQBEJcBGiACQSBqIAJByAJqQQRyQYABEJcBGkHYARAJIgpFDRAgCkIANwMIIApCADcDACAK\
QQA2AlAgCkEAKQOYnUA3AxAgCkEYakEAKQOgnUA3AwAgCkEgakEAKQOonUA3AwAgCkEoakEAKQOwnU\
A3AwAgCkEwakEAKQO4nUA3AwAgCkE4akEAKQPAnUA3AwAgCkHAAGpBACkDyJ1ANwMAIApByABqQQAp\
A9CdQDcDACAKQdQAaiACQSBqQYABEJcBGkHcgsAAIQRBACEDDB4LIAJBADYCsAEgAkGwAWpBBHIhA0\
EAIQoDQCADIApqQQA6AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQYABRw0ACyACQcgCaiACQbABakGE\
ARCXARogAkEgaiACQcgCakEEckGAARCXARpB2AEQCSIKRQ0QIApCADcDCCAKQgA3AwAgCkEANgJQIA\
pBACkD2J1ANwMQIApBGGpBACkD4J1ANwMAIApBIGpBACkD6J1ANwMAIApBKGpBACkD8J1ANwMAIApB\
MGpBACkD+J1ANwMAIApBOGpBACkDgJ5ANwMAIApBwABqQQApA4ieQDcDACAKQcgAakEAKQOQnkA3Aw\
AgCkHUAGogAkEgakGAARCXARpBiIPAACEEQQAhAwwdCyACQQA2ArABQQQhCgNAIAJBsAFqIApqQQA6\
AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQZQBRw0ACyACQcgCaiACQbABakGUARCXARogAkEgaiACQc\
gCakEEckGQARCXARpB4AIQCSIKRQ0QIApBAEHMARCdAUHMAWogAkEgakGQARCXARpBrIPAACEEQQAh\
AwwcCyACQQA2ArABQQQhCgNAIAJBsAFqIApqQQA6AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQYwBRw\
0ACyACQcgCaiACQbABakGMARCXARogAkEgaiACQcgCakEEckGIARCXARpB2AIQCSIKRQ0QIApBAEHM\
ARCdAUHMAWogAkEgakGIARCXARpB0IPAACEEQQAhAwwbCyACQQA2ArABQQQhCgNAIAJBsAFqIApqQQ\
A6AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQewARw0ACyACQcgCaiACQbABakHsABCXARogAkEgaiAC\
QcgCakEEckHoABCXARpBuAIQCSIKRQ0QIApBAEHMARCdAUHMAWogAkEgakHoABCXARpB9IPAACEEQQ\
AhAwwaCyACQQA2ArABQQQhCgNAIAJBsAFqIApqQQA6AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQZQB\
Rw0ACyACQcgCaiACQbABakGUARCXARogAkEgaiACQcgCakEEckGQARCXARpB4AIQCSIKRQ0RIApBAE\
HMARCdAUHMAWogAkEgakGQARCXARpByITAACEEQQAhAwwZCyACQQA2ArABQQQhCgNAIAJBsAFqIApq\
QQA6AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQYwBRw0ACyACQcgCaiACQbABakGMARCXARogAkEgai\
ACQcgCakEEckGIARCXARpB2AIQCSIKRQ0RIApBAEHMARCdAUHMAWogAkEgakGIARCXARpB+ITAACEE\
QQAhAwwYCyACQQA2ArABQQQhCgNAIAJBsAFqIApqQQA6AAAgAiACKAKwAUEBajYCsAEgCkEBaiIKQe\
wARw0ACyACQcgCaiACQbABakHsABCXARogAkEgaiACQcgCakEEckHoABCXARpBuAIQCSIKRQ0RIApB\
AEHMARCdAUHMAWogAkEgakHoABCXARpBqIXAACEEQQAhAwwXCyAAKAAAQfPQhYsDRg0VCyACQQE2Ai\
QgAiACQQhqNgIgQTgQCSIKRQ0SIAJCODcCtAEgAiAKNgKwASACIAJBsAFqNgIQIAJB3AJqQQE2AgAg\
AkIBNwLMAiACQcSGwAA2AsgCIAIgAkEgajYC2AIgAkEQakGMh8AAIAJByAJqEBwNEyACKAKwASACKA\
K4ARAAIQoCQCACKAK0AUUNACACKAKwARAQC0EBIQMMFQtB1ABBBEEAKALMp0AiAkECIAIbEQQAAAtB\
4ABBCEEAKALMp0AiAkECIAIbEQQAAAtB4ABBCEEAKALMp0AiAkECIAIbEQQAAAtB4ABBCEEAKALMp0\
AiAkECIAIbEQQAAAtB+ABBCEEAKALMp0AiAkECIAIbEQQAAAtB8ABBCEEAKALMp0AiAkECIAIbEQQA\
AAtB8ABBCEEAKALMp0AiAkECIAIbEQQAAAtB2AFBCEEAKALMp0AiAkECIAIbEQQAAAtB2AFBCEEAKA\
LMp0AiAkECIAIbEQQAAAtB4AJBCEEAKALMp0AiAkECIAIbEQQAAAtB2AJBCEEAKALMp0AiAkECIAIb\
EQQAAAtBuAJBCEEAKALMp0AiAkECIAIbEQQAAAtBmAJBCEEAKALMp0AiAkECIAIbEQQAAAtB4AJBCE\
EAKALMp0AiAkECIAIbEQQAAAtB2AJBCEEAKALMp0AiAkECIAIbEQQAAAtBuAJBCEEAKALMp0AiAkEC\
IAIbEQQAAAtBmAJBCEEAKALMp0AiAkECIAIbEQQAAAtB+A5BCEEAKALMp0AiAkECIAIbEQQAAAtBOE\
EBQQAoAsynQCICQQIgAhsRBAAAC0Gkh8AAQTMgAkHIAmpB2IfAAEHoh8AAEH8ACyACQboBakIANwEA\
IAJBwgFqQQA7AQAgAkGwAWpBFGpCADcCACACQbABakEcakIANwIAIAJBsAFqQSRqQgA3AgAgAkGwAW\
pBLGpCADcCACACQbABakE0akIANwIAIAJBsAFqQTxqQQA6AAAgAkHtAWpBADYAACACQfEBakEAOwAA\
IAJB8wFqQQA6AAAgAkHAADYCsAEgAkEAOwG0ASACQQA2AbYBIAJByAJqIAJBsAFqQcQAEJcBGiACQS\
BqQThqIgMgAkHIAmpBPGopAgA3AwAgAkEgakEwaiIEIAJByAJqQTRqKQIANwMAIAJBIGpBKGoiBSAC\
QcgCakEsaikCADcDACACQcAAaiIGIAJByAJqQSRqKQIANwMAIAJBIGpBGGoiByACQcgCakEcaikCAD\
cDACACQSBqQRBqIgggAkHIAmpBFGopAgA3AwAgAkEgakEIaiIJIAJB1AJqKQIANwMAIAIgAikCzAI3\
AyBB4AAQCSIKRQ0BIApCADcDACAKQQA2AhwgCiACKQMgNwIgIApBACkDyJtANwMIIApBEGpBACkD0J\
tANwMAIApBGGpBACgC2JtANgIAIApBKGogCSkDADcCACAKQTBqIAgpAwA3AgAgCkE4aiAHKQMANwIA\
IApBwABqIAYpAwA3AgAgCkHIAGogBSkDADcCACAKQdAAaiAEKQMANwIAIApB2ABqIAMpAwA3AgBB2I\
HAACEEQQAhAwsCQCABRQ0AIAAQEAsgAw0BQQwQCSIARQ0CIAAgBDYCCCAAIAo2AgQgAEEANgIAIAJB\
4ANqJAAgAA8LQeAAQQhBACgCzKdAIgJBAiACGxEEAAALIAoQtQEAC0EMQQRBACgCzKdAIgJBAiACGx\
EEAAALii4BIn8jAEHAAGsiAkEYaiIDQgA3AwAgAkEgaiIEQgA3AwAgAkE4aiIFQgA3AwAgAkEwaiIG\
QgA3AwAgAkEoaiIHQgA3AwAgAkEIaiIIIAEpAAg3AwAgAkEQaiIJIAEpABA3AwAgAyABKAAYIgo2Ag\
AgBCABKAAgIgM2AgAgAiABKQAANwMAIAIgASgAHCIENgIcIAIgASgAJCILNgIkIAcgASgAKCIMNgIA\
IAIgASgALCIHNgIsIAYgASgAMCINNgIAIAIgASgANCIGNgI0IAUgASgAOCIONgIAIAIgASgAPCIBNg\
I8IAAgDiADIAEgCyACKAIAIgUgCSgCACIJIAUgByACKAIMIg8gAigCBCIQIAEgBSABIAwgAigCFCIC\
IAUgACgCCCIRIAAoAgQiEnMgACgCDCITcyAAKAIAIhRqakELdyAAKAIQIhVqIhZBCnciF2ogDyARQQ\
p3IhFqIBAgFWogESAScyAWc2pBDncgE2oiFSAXcyAIKAIAIgggE2ogFiASQQp3IhJzIBVzakEPdyAR\
aiITc2pBDHcgEmoiFiATQQp3IhFzIAkgEmogEyAVQQp3IhJzIBZzakEFdyAXaiITc2pBCHcgEmoiF0\
EKdyIVaiADIBZBCnciFmogCiASaiATIBZzIBdzakEHdyARaiISIBVzIAQgEWogFyATQQp3IhNzIBJz\
akEJdyAWaiIWc2pBC3cgE2oiFyAWQQp3IhFzIAsgE2ogFiASQQp3IhJzIBdzakENdyAVaiITc2pBDn\
cgEmoiFkEKdyIVaiAGIBdBCnciF2ogEiAHaiATIBdzIBZzakEPdyARaiISIBVzIBEgDWogFiATQQp3\
IhNzIBJzakEGdyAXaiIWc2pBB3cgE2oiESAWQQp3IhhzIBMgDmogFiASQQp3IhlzIBFzakEJdyAVai\
IVc2pBCHcgGWoiF0EKdyISaiAPIAwgBiAFIAAoAhwiGkEKdyITaiAEIAAoAiAiFmogDiAAKAIkIhtq\
IAIgACgCFGogGiAWQX9zciAAKAIYIhpzakHml4qFBWpBCHcgG2oiGyAaIBNBf3Nyc2pB5peKhQVqQQ\
l3IBZqIhYgGyAaQQp3IhpBf3Nyc2pB5peKhQVqQQl3IBNqIhMgFiAbQQp3IhtBf3Nyc2pB5peKhQVq\
QQt3IBpqIhxBCnciHWogCSATQQp3Ih5qIAcgFkEKdyIWaiAIIBtqIAsgGmogHCATIBZBf3Nyc2pB5p\
eKhQVqQQ13IBtqIhMgHCAeQX9zcnNqQeaXioUFakEPdyAWaiIWIBMgHUF/c3JzakHml4qFBWpBD3cg\
HmoiGiAWIBNBCnciE0F/c3JzakHml4qFBWpBBXcgHWoiGyAaIBZBCnciFkF/c3JzakHml4qFBWpBB3\
cgE2oiHEEKdyIdaiAQIBtBCnciHmogAyAaQQp3IhpqIAEgFmogCiATaiAcIBsgGkF/c3JzakHml4qF\
BWpBB3cgFmoiEyAcIB5Bf3Nyc2pB5peKhQVqQQh3IBpqIhYgEyAdQX9zcnNqQeaXioUFakELdyAeai\
IaIBYgE0EKdyIbQX9zcnNqQeaXioUFakEOdyAdaiIcIBogFkEKdyIdQX9zcnNqQeaXioUFakEOdyAb\
aiIeQQp3IhNqIAogGkEKdyIaaiATIBdxaiAPIBtqIB4gHCAaQX9zcnNqQeaXioUFakEMdyAdaiIbIB\
NBf3NxakGkorfiBWpBCXcgHEEKdyIcaiIfIBJBf3NxaiAHIBxqIBcgG0EKdyIWQX9zcWogHyAWcWpB\
pKK34gVqQQ13IBNqIhcgEnFqQaSit+IFakEPdyAWaiIgIBdBCnciE0F/c3FqIAQgFmogFyAfQQp3Ih\
ZBf3NxaiAgIBZxakGkorfiBWpBB3cgEmoiHyATcWpBpKK34gVqQQx3IBZqIiFBCnciEmogDCAgQQp3\
IhdqIAYgFmogHyAXQX9zcWogISAXcWpBpKK34gVqQQh3IBNqIiAgEkF/c3FqIAIgE2ogISAfQQp3Ih\
NBf3NxaiAgIBNxakGkorfiBWpBCXcgF2oiFyAScWpBpKK34gVqQQt3IBNqIh8gF0EKdyIWQX9zcWog\
DiATaiAXICBBCnciE0F/c3FqIB8gE3FqQaSit+IFakEHdyASaiIgIBZxakGkorfiBWpBB3cgE2oiIU\
EKdyISaiAJIB9BCnciF2ogAyATaiAgIBdBf3NxaiAhIBdxakGkorfiBWpBDHcgFmoiHyASQX9zcWog\
DSAWaiAhICBBCnciE0F/c3FqIB8gE3FqQaSit+IFakEHdyAXaiIXIBJxakGkorfiBWpBBncgE2oiIC\
AXQQp3IhZBf3NxaiALIBNqIBcgH0EKdyITQX9zcWogICATcWpBpKK34gVqQQ93IBJqIh8gFnFqQaSi\
t+IFakENdyATaiIhQQp3IiJqIBAgDiANIBAgFUEKdyIjaiAEIBlqIBFBCnciESANIB1qIBsgHiAcQX\
9zcnNqQeaXioUFakEGdyAaaiISQX9zcWogEiAVcWpBmfOJ1AVqQQd3IBhqIhdBCnciFSAGIBFqIBJB\
CnciGSAJIBhqICMgF0F/c3FqIBcgEnFqQZnzidQFakEGdyARaiISQX9zcWogEiAXcWpBmfOJ1AVqQQ\
h3ICNqIhdBf3NxaiAXIBJxakGZ84nUBWpBDXcgGWoiEUEKdyIYaiAKIBVqIBdBCnciGiAMIBlqIBJB\
CnciGSARQX9zcWogESAXcWpBmfOJ1AVqQQt3IBVqIhJBf3NxaiASIBFxakGZ84nUBWpBCXcgGWoiF0\
EKdyIVIA8gGmogEkEKdyIbIAEgGWogGCAXQX9zcWogFyAScWpBmfOJ1AVqQQd3IBpqIhJBf3NxaiAS\
IBdxakGZ84nUBWpBD3cgGGoiF0F/c3FqIBcgEnFqQZnzidQFakEHdyAbaiIRQQp3IhhqIAsgFWogF0\
EKdyIZIAUgG2ogEkEKdyIaIBFBf3NxaiARIBdxakGZ84nUBWpBDHcgFWoiEkF/c3FqIBIgEXFqQZnz\
idQFakEPdyAaaiIXQQp3IhsgCCAZaiASQQp3IhwgAiAaaiAYIBdBf3NxaiAXIBJxakGZ84nUBWpBCX\
cgGWoiEkF/c3FqIBIgF3FqQZnzidQFakELdyAYaiIXQX9zcWogFyAScWpBmfOJ1AVqQQd3IBxqIhFB\
CnciGGogAiAgQQp3IhVqIAEgFmogCCATaiAfIBVBf3NxaiAhIBVxakGkorfiBWpBC3cgFmoiEyAhQX\
9zciAYc2pB8/3A6wZqQQl3IBVqIhYgE0F/c3IgInNqQfP9wOsGakEHdyAYaiIVIBZBf3NyIBNBCnci\
E3NqQfP9wOsGakEPdyAiaiIYIBVBf3NyIBZBCnciFnNqQfP9wOsGakELdyATaiIZQQp3IhpqIAsgGE\
EKdyIdaiAKIBVBCnciFWogDiAWaiAEIBNqIBkgGEF/c3IgFXNqQfP9wOsGakEIdyAWaiITIBlBf3Ny\
IB1zakHz/cDrBmpBBncgFWoiFiATQX9zciAac2pB8/3A6wZqQQZ3IB1qIhUgFkF/c3IgE0EKdyITc2\
pB8/3A6wZqQQ53IBpqIhggFUF/c3IgFkEKdyIWc2pB8/3A6wZqQQx3IBNqIhlBCnciGmogDCAYQQp3\
Ih1qIAggFUEKdyIVaiANIBZqIAMgE2ogGSAYQX9zciAVc2pB8/3A6wZqQQ13IBZqIhMgGUF/c3IgHX\
NqQfP9wOsGakEFdyAVaiIWIBNBf3NyIBpzakHz/cDrBmpBDncgHWoiFSAWQX9zciATQQp3IhNzakHz\
/cDrBmpBDXcgGmoiGCAVQX9zciAWQQp3IhZzakHz/cDrBmpBDXcgE2oiGUEKdyIaaiAGIBZqIAkgE2\
ogGSAYQX9zciAVQQp3IhVzakHz/cDrBmpBB3cgFmoiFiAZQX9zciAYQQp3IhhzakHz/cDrBmpBBXcg\
FWoiE0EKdyIZIAogGGogFkEKdyIdIAMgCiADIAwgF0EKdyIeaiAPIBJBCnciEmogAyAbaiAeIAcgHG\
ogEiARQX9zcWogESAXcWpBmfOJ1AVqQQ13IBtqIhdBf3MiG3FqIBcgEXFqQZnzidQFakEMdyASaiIS\
IBtyIB9BCnciEXNqQaHX5/YGakELdyAeaiIbIBJBf3NyIBdBCnciF3NqQaHX5/YGakENdyARaiIcQQ\
p3Ih5qIAEgG0EKdyIfaiALIBJBCnciEmogCSAXaiAOIBFqIBwgG0F/c3IgEnNqQaHX5/YGakEGdyAX\
aiIXIBxBf3NyIB9zakGh1+f2BmpBB3cgEmoiEiAXQX9zciAec2pBodfn9gZqQQ53IB9qIhEgEkF/c3\
IgF0EKdyIXc2pBodfn9gZqQQl3IB5qIhsgEUF/c3IgEkEKdyISc2pBodfn9gZqQQ13IBdqIhxBCnci\
HmogBSAbQQp3Ih9qIAQgEUEKdyIRaiAIIBJqIBAgF2ogHCAbQX9zciARc2pBodfn9gZqQQ93IBJqIh\
IgHEF/c3IgH3NqQaHX5/YGakEOdyARaiIXIBJBf3NyIB5zakGh1+f2BmpBCHcgH2oiESAXQX9zciAS\
QQp3IhtzakGh1+f2BmpBDXcgHmoiHCARQX9zciAXQQp3IhdzakGh1+f2BmpBBncgG2oiHkEKdyIfai\
AaIBNBf3NxaiATIBZxakHp7bXTB2pBD3cgGGoiEkF/c3FqIBIgE3FqQenttdMHakEFdyAaaiITQX9z\
cWogEyAScWpB6e210wdqQQh3IB1qIhZBCnciGGogDyAZaiATQQp3IhogECAdaiASQQp3Ih0gFkF/c3\
FqIBYgE3FqQenttdMHakELdyAZaiISQX9zcWogEiAWcWpB6e210wdqQQ53IB1qIhNBCnciGSABIBpq\
IBJBCnciICAHIB1qIBggE0F/c3FqIBMgEnFqQenttdMHakEOdyAaaiISQX9zcWogEiATcWpB6e210w\
dqQQZ3IBhqIhNBf3NxaiATIBJxakHp7bXTB2pBDncgIGoiFkEKdyIYaiANIBlqIBNBCnciGiACICBq\
IBJBCnciHSAWQX9zcWogFiATcWpB6e210wdqQQZ3IBlqIhJBf3NxaiASIBZxakHp7bXTB2pBCXcgHW\
oiE0EKdyIZIAYgGmogEkEKdyIgIAggHWogGCATQX9zcWogEyAScWpB6e210wdqQQx3IBpqIhJBf3Nx\
aiASIBNxakHp7bXTB2pBCXcgGGoiE0F/c3FqIBMgEnFqQenttdMHakEMdyAgaiIWQQp3IhhqIA4gEk\
EKdyIaaiAYIAwgGWogE0EKdyIdIAQgIGogGiAWQX9zcWogFiATcWpB6e210wdqQQV3IBlqIhJBf3Nx\
aiASIBZxakHp7bXTB2pBD3cgGmoiE0F/c3FqIBMgEnFqQenttdMHakEIdyAdaiIZIAogDyAFIA0gHE\
EKdyIWaiACIBFBCnciEWogByAXaiAGIBtqIB4gHEF/c3IgEXNqQaHX5/YGakEFdyAXaiIXIB5Bf3Ny\
IBZzakGh1+f2BmpBDHcgEWoiESAXQX9zciAfc2pBodfn9gZqQQd3IBZqIhogEUF/c3IgF0EKdyIbc2\
pBodfn9gZqQQV3IB9qIhxBCnciFmogByARQQp3IhdqIBUgEGogGiAXQX9zcWogHCAXcWpB3Pnu+Hhq\
QQt3IBtqIhUgFkF/c3FqIAsgG2ogHCAaQQp3IhFBf3NxaiAVIBFxakHc+e74eGpBDHcgF2oiGiAWcW\
pB3Pnu+HhqQQ53IBFqIhsgGkEKdyIXQX9zcWogDCARaiAaIBVBCnciEUF/c3FqIBsgEXFqQdz57vh4\
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\
cyASIBFzIBZzIA8gDXMgC3MgAnNBAXciIHNBAXciIXNBAXciInNBAXciI3NBAXciJHNBAXciJXNBAX\
ciJnNBAXciJyAdICFzIAIgFnMgIXMgFCALcyAgcyAdc0EBdyIoc0EBdyIpcyAcICBzIChzIB9zQQF3\
IipzQQF3IitzIB8gKXMgK3MgHiAocyAqcyAnc0EBdyIsc0EBdyItcyAmICpzICxzICUgH3MgJ3MgJC\
AecyAmcyAjIBtzICVzICIgGnMgJHMgISAZcyAjcyAgIBdzICJzIClzQQF3Ii5zQQF3Ii9zQQF3IjBz\
QQF3IjFzQQF3IjJzQQF3IjNzQQF3IjRzQQF3IjUgKyAvcyApICNzIC9zICggInMgLnMgK3NBAXciNn\
NBAXciN3MgKiAucyA2cyAtc0EBdyI4c0EBdyI5cyAtIDdzIDlzICwgNnMgOHMgNXNBAXciOnNBAXci\
O3MgNCA4cyA6cyAzIC1zIDVzIDIgLHMgNHMgMSAncyAzcyAwICZzIDJzIC8gJXMgMXMgLiAkcyAwcy\
A3c0EBdyI8c0EBdyI9c0EBdyI+c0EBdyI/c0EBdyJAc0EBdyJBc0EBdyJCc0EBdyJDIDkgPXMgNyAx\
cyA9cyA2IDBzIDxzIDlzQQF3IkRzQQF3IkVzIDggPHMgRHMgO3NBAXciRnNBAXciR3MgOyBFcyBHcy\
A6IERzIEZzIENzQQF3IkhzQQF3IklzIEIgRnMgSHMgQSA7cyBDcyBAIDpzIEJzID8gNXMgQXMgPiA0\
cyBAcyA9IDNzID9zIDwgMnMgPnMgRXNBAXciSnNBAXciS3NBAXciTHNBAXciTXNBAXciTnNBAXciT3\
NBAXciUHNBAXdqIEYgSnMgRCA+cyBKcyBHc0EBdyJRcyBJc0EBdyJSIEUgP3MgS3MgUXNBAXciUyBM\
IEEgOiA5IDwgMSAmIB8gKCAhIBcgEyAQIAhBHnciVGogDiAFIAdBHnciECAGcyAIcSAGc2pqIA0gBC\
AIQQV3aiAGIAVzIAdxIAVzampBmfOJ1AVqIg5BBXdqQZnzidQFaiJVQR53IgggDkEedyINcyAGIA9q\
IA4gVCAQc3EgEHNqIFVBBXdqQZnzidQFaiIOcSANc2ogECARaiBVIA0gVHNxIFRzaiAOQQV3akGZ84\
nUBWoiEEEFd2pBmfOJ1AVqIhFBHnciD2ogDCAIaiARIBBBHnciEyAOQR53IgxzcSAMc2ogEiANaiAM\
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\
QQA2ArCnQEEAQcSkwAA2AtCkQEEAQbykwAA2AsSkQEEAQcSkwAA2AsykQEEAQcykwAA2AtikQEEAQc\
ykwAA2AtSkQEEAQdSkwAA2AuCkQEEAQdSkwAA2AtykQEEAQdykwAA2AuikQEEAQdykwAA2AuSkQEEA\
QeSkwAA2AvCkQEEAQeSkwAA2AuykQEEAQeykwAA2AvikQEEAQeykwAA2AvSkQEEAQfSkwAA2AoClQE\
EAQfSkwAA2AvykQEEAQfykwAA2AoilQEEAQfykwAA2AoSlQEEAQYSlwAA2ApClQEEAQYylwAA2Apil\
QEEAQYSlwAA2AoylQEEAQZSlwAA2AqClQEEAQYylwAA2ApSlQEEAQZylwAA2AqilQEEAQZSlwAA2Ap\
ylQEEAQaSlwAA2ArClQEEAQZylwAA2AqSlQEEAQaylwAA2ArilQEEAQaSlwAA2AqylQEEAQbSlwAA2\
AsClQEEAQaylwAA2ArSlQEEAQbylwAA2AsilQEEAQbSlwAA2ArylQEEAQcSlwAA2AtClQEEAQbylwA\
A2AsSlQEEAQcylwAA2AtilQEEAQcSlwAA2AsylQEEAQdSlwAA2AuClQEEAQcylwAA2AtSlQEEAQdyl\
wAA2AuilQEEAQdSlwAA2AtylQEEAQeSlwAA2AvClQEEAQdylwAA2AuSlQEEAQeylwAA2AvilQEEAQe\
SlwAA2AuylQEEAQfSlwAA2AoCmQEEAQeylwAA2AvSlQEEAQfylwAA2AoimQEEAQfSlwAA2AvylQEEA\
IAE2ApinQEEAQfylwAA2AoSmQEEAIAZBWGoiADYCkKdAIAEgAEEBcjYCBCABIABqQSg2AgRBAEGAgI\
ABNgK0p0AMAgsgACgCDCIHQQFxDQAgB0EBSw0AIAQgA0sNACABIANNDQAgACAFIAZqNgIEQQBBACgC\
mKdAIgBBD2pBeHEiA0F4ajYCmKdAQQAgACADa0EAKAKQp0AgBmoiBGpBCGoiATYCkKdAIANBfGogAU\
EBcjYCACAAIARqQSg2AgRBAEGAgIABNgK0p0AMAQtBAEEAKAK4p0AiACABIAAgAUkbNgK4p0AgASAG\
aiEEQaSnwAAhAAJAAkADQCAAKAIAIARGDQEgACgCCCIADQAMAgsLIAAoAgwNACAAIAE2AgAgACAAKA\
IEIAZqNgIEIAEgAkEDcjYCBCABIAJqIQAgBCABayACayECAkACQEEAKAKYp0AgBEcNAEEAIAA2Apin\
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\
ASADQfgAaiABIAQQPBogDSALKQMANwMAIA1BCGogBSkDADcDACANQRBqIAYpAwA3AwAgDUEYaiAIKQ\
MANwMAIAogCSkDADcDACAKQQhqIA8pAwA3AwAgCkEQaiAQKQMANwMAIApBGGogESkDADcDACAKQSBq\
IBIpAwA3AwAgCkEoaiATKQMANwMAIApBMGogFCkDADcDACAKQThqIBUpAwA3AwAgAy0A4gEhDyADLQ\
DhASEQIAMgAy0A4AEiEToAcCADIAMpA3giHzcDCCADIA8gEEVyQQJyIg86AHEgA0HoAWpBGGoiECAI\
KQIANwMAIANB6AFqQRBqIgggBikCADcDACADQegBakEIaiIGIAUpAgA3AwAgAyALKQIANwPoASADQe\
gBaiAKIBEgHyAPEAogECgCACEPIAgoAgAhCCAGKAIAIRAgAygChAIhESADKAL8ASESIAMoAvQBIRMg\
AygC7AEhFCADKALoASEVIAAgACkDABAXIAwtAAAiBkE3Tw0GIA4gBkEFdGoiBSAVNgIAIAUgETYCHC\
AFIA82AhggBSASNgIUIAUgCDYCECAFIBM2AgwgBSAQNgIIIAUgFDYCBCAMIAZBAWo6AAAMAQsgAiAE\
SQ0GIAAtAGohCCADQfgAakE4akIANwMAIANB+ABqQTBqQgA3AwAgCUIANwMAIANB+ABqQSBqQgA3Aw\
AgA0H4AGpBGGpCADcDACADQfgAakEQakIANwMAIAtCADcDACADQgA3A3ggASAEIAcgHyAIIANB+ABq\
QcAAEA4hBSADQZACakEYakIANwMAIANBkAJqQRBqQgA3AwAgA0GQAmpBCGpCADcDACADQgA3A5ACAk\
AgBUEDSQ0AA0AgBUEFdCIFQcEATw0JIANB+ABqIAUgByAIIANBkAJqQSAQIiIFQQV0IgZBwQBPDQog\
BkEhTw0LIANB+ABqIANBkAJqIAYQlwEaIAVBAksNAAsLIAMoArQBIRYgAygCsAEhFyADKAKsASEYIA\
MoAqgBIRkgAygCpAEhGiADKAKgASEbIAMoApwBIRwgAygCmAEhHSADKAKUASEIIAMoApABIQ8gAygC\
jAEhECADKAKIASERIAMoAoQBIRIgAygCgAEhEyADKAJ8IRQgAygCeCEVIAAgACkDABAXIAwtAAAiBk\
E3Tw0KIA4gBkEFdGoiBSAVNgIAIAUgCDYCHCAFIA82AhggBSAQNgIUIAUgETYCECAFIBI2AgwgBSAT\
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\
QQhqQdAAaiARKQMANwMAIAdBCGpB2ABqIBIpAwA3AwAgB0EIakHgAGogEykDADcDACAHIAcpA5gBNw\
MQIAcgBykDuAE3AzAgBy0A+gEhCyAHLQD5ASEEIAcgBy0A+AEiAjoAcCAHIAcpA5ABIgM3AwggByAL\
IARFckECciILOgBxIAdBgAJqQRhqIgQgCikDADcDACAHQYACakEQaiIKIAEpAwA3AwAgB0GAAmpBCG\
oiASAUKQMANwMAIAcgBykDmAE3A4ACIAdBgAJqIAdBMGogAiADIAsQCiAMQQV0IgxBIGoiCyAGSw0D\
IAQoAgAhCyAKKAIAIQogASgCACEEIAcoApQCIQIgBygCjAIhASAHKAKEAiEAIAcoAoACIQYgBSAMai\
IMIAcoApwCNgAcIAwgCzYAGCAMIAI2ABQgDCAKNgAQIAwgATYADCAMIAQ2AAggDCAANgAEIAwgBjYA\
AEECQQEgCEH/AXEbIQwMAQtBfyABQX9qQQt2IgxndkEKdEGACGpBgAggDBsiDCABSw0DIAdBCGpBAE\
GAARCdARogASAMayELIAAgDGohCiAMQQp2rSADfCEVAkACQCAMQYAIRw0AIAdBCGpBIGohCEHgACEB\
IABBgAggAiADIAQgB0EIakEgEA4hDAwBC0HAACEBIAdBCGpBwABqIQggACAMIAIgAyAEIAdBCGpBwA\
AQDiEMCyAKIAsgAiAVIAQgCCABEA4hCwJAIAxBAUcNACAGQT9NDQUgBSAHKQAINwAAIAVBOGogB0EI\
akE4aikAADcAACAFQTBqIAdBCGpBMGopAAA3AAAgBUEoaiAHQQhqQShqKQAANwAAIAVBIGogB0EIak\
EgaikAADcAACAFQRhqIAdBCGpBGGopAAA3AAAgBUEQaiAHQQhqQRBqKQAANwAAIAVBCGogB0EIakEI\
aikAADcAAEECIQwMAQsgCyAMakEFdCIMQYEBTw0FIAdBCGogDCACIAQgBSAGECIhDAsgB0GgAmokAC\
AMDwsgByAMNgIIQdybwABBKyAHQQhqQfCKwABBgIvAABB/AAsgCyAGQeyIwAAQhQEAC0G8icAAQSNB\
4InAABCUAQALQcAAIAZB8InAABCFAQALIAxBgAFBgIrAABCFAQALlQwBGH8jACECIAAoAgAhAyAAKA\
IIIQQgACgCDCEFIAAoAgQhBiACQcAAayICQRhqIgdCADcDACACQSBqIghCADcDACACQThqIglCADcD\
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\
eHEgAUcNACAEIQIMAwsgAUEAQRkgAkEBdmtBH3EgAkEfRht0IQMCQANAIAQgA0EddkEEcWpBEGoiBS\
gCACICRQ0BIANBAXQhAyACIQQgAigCBEF4cSABRg0EDAALCyAFIAA2AgAgAEEYaiAENgIACyAAIAA2\
AgwgACAANgIICw8LIAIoAggiASAANgIMIAIgADYCCCAAQRhqQQA2AgAgACACNgIMIAAgATYCCA8LQQ\
AgADYClKdAQQBBACgCjKdAIAFqIgE2AoynQCAAIAFBAXI2AgQgACABaiABNgIAC84LAhB/BH4jAEHg\
AWsiAiQAAkACQAJAAkAgAUHwDmotAAAiAw0AIAJBEGogAUEQaikDADcDACACQRhqIAFBGGopAwA3Aw\
AgAkEgaiABQSBqKQMANwMAIAJBMGogAUEwaikDADcDACACQThqIAFBOGopAwA3AwAgAkHAAGogAUHA\
AGopAwA3AwAgAkHIAGogAUHIAGopAwA3AwAgAkHQAGogAUHQAGopAwA3AwAgAkHYAGogAUHYAGopAw\
A3AwAgAkHgAGogAUHgAGopAwA3AwAgAiABKQMINwMIIAIgASkDKDcDKCABQekAai0AACEEIAEtAGoh\
BSACIAEtAGgiBjoAaCACIAEpAwA3AwAgAiAFIARFckECciIHOgBpDAELIAFBkAFqIQgCQAJAAkAgAU\
HpAGotAAAiBEEGdEEAIAEtAGgiB2tGDQAgAkHwAGpBEGogAUEQaikDADcDACACQfAAakEYaiABQRhq\
KQMANwMAIAJB8ABqQSBqIAFBIGopAwA3AwAgAkHwAGpBMGogAUEwaikDADcDACACQfAAakE4aiABQT\
hqKQMANwMAIAJB8ABqQcAAaiABQcAAaikDADcDACACQfAAakHIAGogAUHIAGopAwA3AwAgAkHwAGpB\
0ABqIAFB0ABqKQMANwMAIAJB8ABqQdgAaiABQdgAaikDADcDACACQfAAakHgAGogAUHgAGopAwA3Aw\
AgAiABKQMINwN4IAIgASkDKDcDmAEgAiABLQBqIgUgBEVyQQJyIgk6ANkBIAIgBzoA2AEgAiABKQMA\
IhI3A3AgBUEEciEKIAJB+ABqIQQgAyEFDAELIANBfmohBSADQQJJDQMgAkHwAGpBEGogAUH4AGopAw\
A3AwAgAkHwAGpBGGogAUGAAWopAwA3AwAgAkGQAWogAUGIAWopAwA3AwAgAkGgAWogCCAFQQV0aiIE\
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\
OmpCADcBACACQcIAakEAOwEAIAJBMGpBFGpCADcCACACQTBqQRxqQgA3AgAgAkEwakEkakIANwIAIA\
JBMGpBLGpCADcCACACQQA7ATQgAkEwNgIwIAJBADYBNiACQegAakEwaiACQTBqQTBqKAIANgIAIAJB\
6ABqQShqIAJBMGpBKGopAwA3AwAgAkHoAGpBIGogAkEwakEgaikDADcDACACQegAakEYaiACQTBqQR\
hqKQMANwMAIAJB6ABqQRBqIAJBMGpBEGopAwA3AwAgAkHoAGpBCGogAkEwakEIaikDADcDACACIAIp\
AzA3A2ggAkEoaiIDIAJB6ABqQSxqKQIANwMAIAJBIGoiBCACQegAakEkaikCADcDACACQRhqIgUgAk\
HoAGpBHGopAgA3AwAgAkEQaiIGIAJB6ABqQRRqKQIANwMAIAJBCGoiByACQfQAaikCADcDACACIAIp\
Amw3AwAgASACEB0gAUIANwMIIAFCADcDACABQQA2AlAgAUEAKQOYnUAiCTcDECABQRhqQQApA6CdQC\
IKNwMAIAFBIGpBACkDqJ1AIgs3AwAgAUEoakEAKQOwnUAiDDcDACABQTBqQQApA7idQCINNwMAIAFB\
OGpBACkDwJ1AIg43AwAgAUHAAGpBACkDyJ1AIg83AwAgAUHIAGpBACkD0J1AIhA3AwACQEEwEAkiCA\
0AQTBBAUEAKALMp0AiAkECIAIbEQQAAAsgCCACKQMANwAAIAhBKGogAykDADcAACAIQSBqIAQpAwA3\
AAAgCEEYaiAFKQMANwAAIAhBEGogBikDADcAACAIQQhqIAcpAwA3AAAgAUIANwMIIAFCADcDACABQQ\
A2AlAgAUEQaiIBIAk3AwAgAUEIaiAKNwMAIAFBEGogCzcDACABQRhqIAw3AwAgAUEgaiANNwMAIAFB\
KGogDjcDACABQTBqIA83AwAgAUE4aiAQNwMAIABBMDYCBCAAIAg2AgAgAkGgAWokAAuOBgIJfwh+Iw\
BB0AFrIgIkACACQcoAakIANwEAIAJB0gBqQQA7AQAgAkHAAGpBFGpCADcCACACQcAAakEcakIANwIA\
IAJBwABqQSRqQgA3AgAgAkHAAGpBLGpCADcCACACQcAAakE0akIANwIAIAJBwABqQTxqQQA6AAAgAk\
H9AGpBADYAACACQYEBakEAOwAAIAJBgwFqQQA6AAAgAkHAADYCQCACQQA7AUQgAkEANgFGIAJBiAFq\
IAJBwABqQcQAEJcBGiACQThqIgMgAkGIAWpBPGopAgA3AwAgAkEwaiIEIAJBiAFqQTRqKQIANwMAIA\
JBKGoiBSACQYgBakEsaikCADcDACACQSBqIgYgAkGIAWpBJGopAgA3AwAgAkEYaiIHIAJBiAFqQRxq\
KQIANwMAIAJBEGoiCCACQYgBakEUaikCADcDACACQQhqIgkgAkGUAWopAgA3AwAgAiACKQKMATcDAC\
ABIAIQFiABQgA3AwggAUIANwMAIAFBADYCUCABQQApA9idQCILNwMQIAFBGGpBACkD4J1AIgw3AwAg\
AUEgakEAKQPonUAiDTcDACABQShqQQApA/CdQCIONwMAIAFBMGpBACkD+J1AIg83AwAgAUE4akEAKQ\
OAnkAiEDcDACABQcAAakEAKQOInkAiETcDACABQcgAakEAKQOQnkAiEjcDAAJAQcAAEAkiCg0AQcAA\
QQFBACgCzKdAIgJBAiACGxEEAAALIAogAikDADcAACAKQThqIAMpAwA3AAAgCkEwaiAEKQMANwAAIA\
pBKGogBSkDADcAACAKQSBqIAYpAwA3AAAgCkEYaiAHKQMANwAAIApBEGogCCkDADcAACAKQQhqIAkp\
AwA3AAAgAUIANwMIIAFCADcDACABQQA2AlAgAUEQaiIBIAs3AwAgAUEIaiAMNwMAIAFBEGogDTcDAC\
ABQRhqIA43AwAgAUEgaiAPNwMAIAFBKGogEDcDACABQTBqIBE3AwAgAUE4aiASNwMAIABBwAA2AgQg\
ACAKNgIAIAJB0AFqJAALzAUBCX8jAEEwayIDJAAgA0EkaiABNgIAIANBAzoAKCADQoCAgICABDcDCC\
ADIAA2AiBBACEEIANBADYCGCADQQA2AhACQAJAAkACQCACKAIIIgVFDQAgAigCACEGIAIoAgQiByAC\
QQxqKAIAIgggCCAHSxsiCUUNASAAIAYoAgAgBigCBCABKAIMEQcADQIgBkEIaiEAIAIoAhAhCiAJIQ\
gDQCADIAVBHGotAAA6ACggAyAFQQRqKQIAQiCJNwMIIAVBGGooAgAhAkEAIQRBACEBAkACQAJAIAVB\
FGooAgAOAwEAAgELIAJBA3QhC0EAIQEgCiALaiILKAIEQQNHDQEgCygCACgCACECC0EBIQELIAMgAj\
YCFCADIAE2AhAgBUEQaigCACECAkACQAJAIAVBDGooAgAOAwEAAgELIAJBA3QhASAKIAFqIgEoAgRB\
A0cNASABKAIAKAIAIQILQQEhBAsgAyACNgIcIAMgBDYCGCAKIAUoAgBBA3RqIgIoAgAgA0EIaiACKA\
IEEQUADQMCQCAIQX9qIggNACAJIQQMAwsgBUEgaiEFIABBBGohAiAAKAIAIQEgAEEIaiEAIAMoAiAg\
ASACKAIAIAMoAiQoAgwRBwBFDQAMAwsLIAIoAgAhBiACKAIEIgcgAkEUaigCACIFIAUgB0sbIghFDQ\
AgAigCECEEIAAgBigCACAGKAIEIAEoAgwRBwANAUEAIQUgCCECA0AgBCAFaiIAKAIAIANBCGogAEEE\
aigCABEFAA0CAkAgAkF/aiICDQAgCCEEDAILIAYgBWohACAFQQhqIQUgAygCICAAQQhqKAIAIABBDG\
ooAgAgAygCJCgCDBEHAEUNAAwCCwsCQCAHIARNDQAgAygCICAGIARBA3RqIgUoAgAgBSgCBCADKAIk\
KAIMEQcADQELQQAhBQwBC0EBIQULIANBMGokACAFC4EFAQF+IAAQMSABIAApAxAiAkI4hiACQiiGQo\
CAgICAgMD/AIOEIAJCGIZCgICAgIDgP4MgAkIIhkKAgICA8B+DhIQgAkIIiEKAgID4D4MgAkIYiEKA\
gPwHg4QgAkIoiEKA/gODIAJCOIiEhIQ3AAAgASAAQRhqKQMAIgJCOIYgAkIohkKAgICAgIDA/wCDhC\
ACQhiGQoCAgICA4D+DIAJCCIZCgICAgPAfg4SEIAJCCIhCgICA+A+DIAJCGIhCgID8B4OEIAJCKIhC\
gP4DgyACQjiIhISENwAIIAEgAEEgaikDACICQjiGIAJCKIZCgICAgICAwP8Ag4QgAkIYhkKAgICAgO\
A/gyACQgiGQoCAgIDwH4OEhCACQgiIQoCAgPgPgyACQhiIQoCA/AeDhCACQiiIQoD+A4MgAkI4iISE\
hDcAECABIABBKGopAwAiAkI4hiACQiiGQoCAgICAgMD/AIOEIAJCGIZCgICAgIDgP4MgAkIIhkKAgI\
CA8B+DhIQgAkIIiEKAgID4D4MgAkIYiEKAgPwHg4QgAkIoiEKA/gODIAJCOIiEhIQ3ABggASAAQTBq\
KQMAIgJCOIYgAkIohkKAgICAgIDA/wCDhCACQhiGQoCAgICA4D+DIAJCCIZCgICAgPAfg4SEIAJCCI\
hCgICA+A+DIAJCGIhCgID8B4OEIAJCKIhCgP4DgyACQjiIhISENwAgIAEgAEE4aikDACICQjiGIAJC\
KIZCgICAgICAwP8Ag4QgAkIYhkKAgICAgOA/gyACQgiGQoCAgIDwH4OEhCACQgiIQoCAgPgPgyACQh\
iIQoCA/AeDhCACQiiIQoD+A4MgAkI4iISEhDcAKAvpBAIGfwV+IwBBkAFrIgIkACACQTpqQgA3AQAg\
AkHCAGpBADsBACACQTBqQRRqQgA3AgAgAkEwakEcakIANwIAIAJBMGpBJGpCADcCACACQQA7ATQgAk\
EoNgIwIAJBADYBNiACQeAAakEoaiACQTBqQShqKAIANgIAIAJB4ABqQSBqIAJBMGpBIGopAwA3AwAg\
AkHgAGpBGGogAkEwakEYaikDADcDACACQeAAakEQaiACQTBqQRBqKQMANwMAIAJB4ABqQQhqIAJBMG\
pBCGopAwA3AwAgAiACKQMwNwNgIAJBCGpBIGoiAyACQeAAakEkaikCADcDACACQQhqQRhqIgQgAkHg\
AGpBHGopAgA3AwAgAkEIakEQaiIFIAJB4ABqQRRqKQIANwMAIAJBCGpBCGoiBiACQewAaikCADcDAC\
ACIAIpAmQ3AwggASACQQhqED0gAUIANwMAIAFBADYCMCABQQApA6CbQCIINwMIIAFBEGpBACkDqJtA\
Igk3AwAgAUEYakEAKQOwm0AiCjcDACABQSBqQQApA7ibQCILNwMAIAFBKGpBACkDwJtAIgw3AwACQE\
EoEAkiBw0AQShBAUEAKALMp0AiAkECIAIbEQQAAAsgByACKQMINwAAIAdBIGogAykDADcAACAHQRhq\
IAQpAwA3AAAgB0EQaiAFKQMANwAAIAdBCGogBikDADcAACABQgA3AwAgAUEANgIwIAFBCGoiASAINw\
MAIAFBCGogCTcDACABQRBqIAo3AwAgAUEYaiALNwMAIAFBIGogDDcDACAAQSg2AgQgACAHNgIAIAJB\
kAFqJAAL5QQCCH8BfiMAQYAPayICJAAgAkEIakGIAWogAUGIAWopAwA3AwAgAkEIakGAAWogAUGAAW\
opAwA3AwAgAkEIakH4AGogAUH4AGopAwA3AwAgAkEIakEQaiABQRBqKQMANwMAIAJBCGpBGGogAUEY\
aikDADcDACACQQhqQSBqIAFBIGopAwA3AwAgAkEIakEwaiABQTBqKQMANwMAIAJBCGpBOGogAUE4ai\
kDADcDACACQQhqQcAAaiABQcAAaikDADcDACACQQhqQcgAaiABQcgAaikDADcDACACQQhqQdAAaiAB\
QdAAaikDADcDACACQQhqQdgAaiABQdgAaikDADcDACACQQhqQeAAaiABQeAAaikDADcDACACIAEpA3\
A3A3ggAiABKQMINwMQIAIgASkDKDcDMCABKQMAIQpBACEDIAJBCGpB8A5qQQA6AAAgAUGQAWohBCAB\
QfAOai0AAEEFdCEFIAJBCGpBkAFqIQYgAS0AaiEHIAEtAGkhCCABLQBoIQkCQANAAkAgBQ0AIAMhAQ\
wCCyAGIAQpAAA3AAAgBkEIaiAEQQhqKQAANwAAIAZBEGogBEEQaikAADcAACAGQRhqIARBGGopAAA3\
AAAgBkEgaiEGIAVBYGohBSAEQSBqIQRBNyEBIANBAWoiA0E3Rw0ACwsgAiAHOgByIAIgCDoAcSACIA\
k6AHAgAiAKNwMIIAIgAToA+A4CQEH4DhAJIgQNAEH4DkEIQQAoAsynQCIEQQIgBBsRBAAACyAEIAJB\
CGpB+A4QlwEhBCAAQfCTwAA2AgQgACAENgIAIAJBgA9qJAALzAQCBH8BfiAAQQhqIQIgACkDACEGAk\
ACQAJAIAAoAhwiA0HAAEcNACACIABBIGpBARAIQQAhAyAAQQA2AhwMAQsgA0E/Sw0BCyAAQRxqIANq\
QQRqQYABOgAAIAAgACgCHCIEQQFqIgM2AhwCQAJAIANBwQBPDQAgAEEgaiIFIANqQQBBPyAEaxCdAR\
oCQEHAACAAKAIca0EHSw0AIAIgBUEBEAggACgCHCIDQcEATw0CIABBIGpBACADEJ0BGgsgAEHYAGog\
BkI7hiAGQiuGQoCAgICAgMD/AIOEIAZCG4ZCgICAgIDgP4MgBkILhkKAgICA8B+DhIQgBkIFiEKAgI\
D4D4MgBkIViEKAgPwHg4QgBkIliEKA/gODIAZCA4ZCOIiEhIQ3AwAgAiAFQQEQCCAAQQA2AhwgASAA\
KAIIIgNBGHQgA0EIdEGAgPwHcXIgA0EIdkGA/gNxIANBGHZycjYAACABIABBDGooAgAiA0EYdCADQQ\
h0QYCA/AdxciADQQh2QYD+A3EgA0EYdnJyNgAEIAEgAEEQaigCACIDQRh0IANBCHRBgID8B3FyIANB\
CHZBgP4DcSADQRh2cnI2AAggASAAQRRqKAIAIgNBGHQgA0EIdEGAgPwHcXIgA0EIdkGA/gNxIANBGH\
ZycjYADCABIABBGGooAgAiAEEYdCAAQQh0QYCA/AdxciAAQQh2QYD+A3EgAEEYdnJyNgAQDwsgA0HA\
AEGonMAAEIQBAAsgA0HAAEG4nMAAEIUBAAsgA0HAAEHInMAAEIcBAAvNBAEFfyMAQfAAayICJAAgAk\
EqakIANwEAIAJBMmpBADsBACACQSBqQRRqQgA3AgAgAkEgakEcakIANwIAIAJBADsBJCACQQA2ASYg\
AkEgNgIgIAJByABqQRhqIAJBIGpBGGopAwA3AwAgAkHIAGpBEGogAkEgakEQaikDADcDACACQcgAak\
EIaiACQSBqQQhqKQMANwMAIAJByABqQSBqIAJBIGpBIGooAgA2AgAgAiACKQMgNwNIIAJBEGogAkHI\
AGpBFGopAgA3AwAgAkEIaiACQdQAaikCADcDACACQRhqIAJByABqQRxqKQIANwMAIAIgAikCTDcDAC\
ACIAEQEiABQgA3AwAgAUEgaiABQYgBaikDADcDACABQRhqIAFBgAFqKQMANwMAIAFBEGogAUH4AGop\
AwA3AwAgASABKQNwNwMIIAFBKGpBAEHCABCdASEDAkAgAUHwDmoiBC0AAEUNACAEQQA6AAALAkBBIB\
AJIgRFDQAgBCACKQMANwAAIARBGGogAkEYaikDADcAACAEQRBqIAJBEGopAwA3AAAgBEEIaiACQQhq\
KQMANwAAIAFCADcDACABQQhqIgVBGGogAUHwAGoiBkEYaikDADcDACAFQRBqIAZBEGopAwA3AwAgBU\
EIaiAGQQhqKQMANwMAIAUgBikDADcDACADQQBBwgAQnQEaAkAgAUHwDmoiAS0AAEUNACABQQA6AAAL\
IABBIDYCBCAAIAQ2AgAgAkHwAGokAA8LQSBBAUEAKALMp0AiAkECIAIbEQQAAAuwBAEJfyMAQTBrIg\
YkAEEAIQcgBkEAOgAIAkACQAJAAkACQCABQUBxIghFDQAgCEFAakEGdkEBaiEJQQAhByAGIQogACEL\
A0AgB0ECRg0CIAogCzYCACAGIAdBAWoiBzoACCAKQQRqIQogC0HAAGohCyAJIAdHDQALCyABQT9xIQ\
wCQCAFQQV2IgsgB0H/////A3EiCiAKIAtLGyILRQ0AIANBBHIhDSALQQV0IQ5BACELIAYhCgNAIAoo\
AgAhByAGQRBqQRhqIgkgAkEYaikCADcDACAGQRBqQRBqIgEgAkEQaikCADcDACAGQRBqQQhqIgMgAk\
EIaikCADcDACAGIAIpAgA3AxAgBkEQaiAHQcAAQgAgDRAKIAQgC2oiB0EYaiAJKQMANwAAIAdBEGog\
ASkDADcAACAHQQhqIAMpAwA3AAAgByAGKQMQNwAAIApBBGohCiAOIAtBIGoiC0cNAAsgBi0ACCEHCw\
JAIAxFDQAgB0EFdCICIAVLDQIgBSACayILQR9NDQMgDEEgRw0EIAQgAmoiAiAAIAhqIgspAAA3AAAg\
AkEYaiALQRhqKQAANwAAIAJBEGogC0EQaikAADcAACACQQhqIAtBCGopAAA3AAAgB0EBaiEHCyAGQT\
BqJAAgBw8LIAYgCzYCEEHcm8AAQSsgBkEQakHci8AAQYCLwAAQfwALIAIgBUH8iMAAEIQBAAtBICAL\
QfyIwAAQhQEAC0EgIAxBmJ7AABCGAQALnwQBB38jAEGgAWsiAiQAIAJBOmpCADcBACACQcIAakEAOw\
EAIAJBMGpBFGpCADcCACACQTBqQRxqQgA3AgAgAkEwakEkakIANwIAIAJBMGpBLGpCADcCACACQQA7\
ATQgAkEwNgIwIAJBADYBNiACQegAakEwaiACQTBqQTBqKAIANgIAIAJB6ABqQShqIAJBMGpBKGopAw\
A3AwAgAkHoAGpBIGogAkEwakEgaikDADcDACACQegAakEYaiACQTBqQRhqKQMANwMAIAJB6ABqQRBq\
IAJBMGpBEGopAwA3AwAgAkHoAGpBCGogAkEwakEIaikDADcDACACIAIpAzA3A2ggAkEoaiIDIAJB6A\
BqQSxqKQIANwMAIAJBIGoiBCACQegAakEkaikCADcDACACQRhqIgUgAkHoAGpBHGopAgA3AwAgAkEQ\
aiIGIAJB6ABqQRRqKQIANwMAIAJBCGoiByACQfQAaikCADcDACACIAIpAmw3AwAgASACEFsgAUEAQc\
gBEJ0BIghBADYCyAECQEEwEAkiAQ0AQTBBAUEAKALMp0AiAkECIAIbEQQAAAsgASACKQMANwAAIAFB\
KGogAykDADcAACABQSBqIAQpAwA3AAAgAUEYaiAFKQMANwAAIAFBEGogBikDADcAACABQQhqIAcpAw\
A3AAAgCEEAQcgBEJ0BQQA2AsgBIABBMDYCBCAAIAE2AgAgAkGgAWokAAufBAEHfyMAQaABayICJAAg\
AkE6akIANwEAIAJBwgBqQQA7AQAgAkEwakEUakIANwIAIAJBMGpBHGpCADcCACACQTBqQSRqQgA3Ag\
AgAkEwakEsakIANwIAIAJBADsBNCACQTA2AjAgAkEANgE2IAJB6ABqQTBqIAJBMGpBMGooAgA2AgAg\
AkHoAGpBKGogAkEwakEoaikDADcDACACQegAakEgaiACQTBqQSBqKQMANwMAIAJB6ABqQRhqIAJBMG\
pBGGopAwA3AwAgAkHoAGpBEGogAkEwakEQaikDADcDACACQegAakEIaiACQTBqQQhqKQMANwMAIAIg\
AikDMDcDaCACQShqIgMgAkHoAGpBLGopAgA3AwAgAkEgaiIEIAJB6ABqQSRqKQIANwMAIAJBGGoiBS\
ACQegAakEcaikCADcDACACQRBqIgYgAkHoAGpBFGopAgA3AwAgAkEIaiIHIAJB9ABqKQIANwMAIAIg\
AikCbDcDACABIAIQXCABQQBByAEQnQEiCEEANgLIAQJAQTAQCSIBDQBBMEEBQQAoAsynQCICQQIgAh\
sRBAAACyABIAIpAwA3AAAgAUEoaiADKQMANwAAIAFBIGogBCkDADcAACABQRhqIAUpAwA3AAAgAUEQ\
aiAGKQMANwAAIAFBCGogBykDADcAACAIQQBByAEQnQFBADYCyAEgAEEwNgIEIAAgATYCACACQaABai\
QAC5YEAQd/IwBBoANrIgIkACACQfICakIANwEAIAJB+gJqQQA7AQAgAkHoAmpBFGpCADcCACACQegC\
akEcakIANwIAIAJB6AJqQSRqQgA3AgAgAkHoAmpBLGpCADcCACACQQA7AewCIAJBMDYC6AIgAkEANg\
HuAiACQTBqQTBqIAJB6AJqQTBqKAIANgIAIAJBMGpBKGogAkHoAmpBKGopAwA3AwAgAkEwakEgaiAC\
QegCakEgaikDADcDACACQTBqQRhqIAJB6AJqQRhqKQMANwMAIAJBMGpBEGogAkHoAmpBEGopAwA3Aw\
AgAkEwakEIaiACQegCakEIaikDADcDACACIAIpA+gCNwMwIAJBKGoiAyACQTBqQSxqKQIANwMAIAJB\
IGoiBCACQTBqQSRqKQIANwMAIAJBGGoiBSACQTBqQRxqKQIANwMAIAJBEGoiBiACQTBqQRRqKQIANw\
MAIAJBCGoiByACQTxqKQIANwMAIAIgAikCNDcDACACQTBqIAFBuAIQlwEaIAJBMGogAhBcAkBBMBAJ\
IggNAEEwQQFBACgCzKdAIgJBAiACGxEEAAALIAggAikDADcAACAIQShqIAMpAwA3AAAgCEEgaiAEKQ\
MANwAAIAhBGGogBSkDADcAACAIQRBqIAYpAwA3AAAgCEEIaiAHKQMANwAAIAEQECAAQTA2AgQgACAI\
NgIAIAJBoANqJAALlgQBB38jAEGgA2siAiQAIAJB8gJqQgA3AQAgAkH6AmpBADsBACACQegCakEUak\
IANwIAIAJB6AJqQRxqQgA3AgAgAkHoAmpBJGpCADcCACACQegCakEsakIANwIAIAJBADsB7AIgAkEw\
NgLoAiACQQA2Ae4CIAJBMGpBMGogAkHoAmpBMGooAgA2AgAgAkEwakEoaiACQegCakEoaikDADcDAC\
ACQTBqQSBqIAJB6AJqQSBqKQMANwMAIAJBMGpBGGogAkHoAmpBGGopAwA3AwAgAkEwakEQaiACQegC\
akEQaikDADcDACACQTBqQQhqIAJB6AJqQQhqKQMANwMAIAIgAikD6AI3AzAgAkEoaiIDIAJBMGpBLG\
opAgA3AwAgAkEgaiIEIAJBMGpBJGopAgA3AwAgAkEYaiIFIAJBMGpBHGopAgA3AwAgAkEQaiIGIAJB\
MGpBFGopAgA3AwAgAkEIaiIHIAJBPGopAgA3AwAgAiACKQI0NwMAIAJBMGogAUG4AhCXARogAkEwai\
ACEFsCQEEwEAkiCA0AQTBBAUEAKALMp0AiAkECIAIbEQQAAAsgCCACKQMANwAAIAhBKGogAykDADcA\
ACAIQSBqIAQpAwA3AAAgCEEYaiAFKQMANwAAIAhBEGogBikDADcAACAIQQhqIAcpAwA3AAAgARAQIA\
BBMDYCBCAAIAg2AgAgAkGgA2okAAuWBAEHfyMAQcACayICJAAgAkGSAmpCADcBACACQZoCakEAOwEA\
IAJBiAJqQRRqQgA3AgAgAkGIAmpBHGpCADcCACACQYgCakEkakIANwIAIAJBiAJqQSxqQgA3AgAgAk\
EAOwGMAiACQTA2AogCIAJBADYBjgIgAkEwakEwaiACQYgCakEwaigCADYCACACQTBqQShqIAJBiAJq\
QShqKQMANwMAIAJBMGpBIGogAkGIAmpBIGopAwA3AwAgAkEwakEYaiACQYgCakEYaikDADcDACACQT\
BqQRBqIAJBiAJqQRBqKQMANwMAIAJBMGpBCGogAkGIAmpBCGopAwA3AwAgAiACKQOIAjcDMCACQShq\
IgMgAkEwakEsaikCADcDACACQSBqIgQgAkEwakEkaikCADcDACACQRhqIgUgAkEwakEcaikCADcDAC\
ACQRBqIgYgAkEwakEUaikCADcDACACQQhqIgcgAkE8aikCADcDACACIAIpAjQ3AwAgAkEwaiABQdgB\
EJcBGiACQTBqIAIQHQJAQTAQCSIIDQBBMEEBQQAoAsynQCICQQIgAhsRBAAACyAIIAIpAwA3AAAgCE\
EoaiADKQMANwAAIAhBIGogBCkDADcAACAIQRhqIAUpAwA3AAAgCEEQaiAGKQMANwAAIAhBCGogBykD\
ADcAACABEBAgAEEwNgIEIAAgCDYCACACQcACaiQAC6sEAQl/IwBB0AFrIgIkACACQcoAakIANwEAIA\
JB0gBqQQA7AQAgAkHAAGpBFGpCADcCACACQcAAakEcakIANwIAIAJBwABqQSRqQgA3AgAgAkHAAGpB\
LGpCADcCACACQcAAakE0akIANwIAIAJBwABqQTxqQQA6AAAgAkH9AGpBADYAACACQYEBakEAOwAAIA\
JBgwFqQQA6AAAgAkHAADYCQCACQQA7AUQgAkEANgFGIAJBiAFqIAJBwABqQcQAEJcBGiACQThqIgMg\
AkGIAWpBPGopAgA3AwAgAkEwaiIEIAJBiAFqQTRqKQIANwMAIAJBKGoiBSACQYgBakEsaikCADcDAC\
ACQSBqIgYgAkGIAWpBJGopAgA3AwAgAkEYaiIHIAJBiAFqQRxqKQIANwMAIAJBEGoiCCACQYgBakEU\
aikCADcDACACQQhqIgkgAkGUAWopAgA3AwAgAiACKQKMATcDACABIAIQSyABQQBByAEQnQEiCkEANg\
LIAQJAQcAAEAkiAQ0AQcAAQQFBACgCzKdAIgJBAiACGxEEAAALIAEgAikDADcAACABQThqIAMpAwA3\
AAAgAUEwaiAEKQMANwAAIAFBKGogBSkDADcAACABQSBqIAYpAwA3AAAgAUEYaiAHKQMANwAAIAFBEG\
ogCCkDADcAACABQQhqIAkpAwA3AAAgCkEAQcgBEJ0BQQA2AsgBIABBwAA2AgQgACABNgIAIAJB0AFq\
JAALqwQBCX8jAEHQAWsiAiQAIAJBygBqQgA3AQAgAkHSAGpBADsBACACQcAAakEUakIANwIAIAJBwA\
BqQRxqQgA3AgAgAkHAAGpBJGpCADcCACACQcAAakEsakIANwIAIAJBwABqQTRqQgA3AgAgAkHAAGpB\
PGpBADoAACACQf0AakEANgAAIAJBgQFqQQA7AAAgAkGDAWpBADoAACACQcAANgJAIAJBADsBRCACQQ\
A2AUYgAkGIAWogAkHAAGpBxAAQlwEaIAJBOGoiAyACQYgBakE8aikCADcDACACQTBqIgQgAkGIAWpB\
NGopAgA3AwAgAkEoaiIFIAJBiAFqQSxqKQIANwMAIAJBIGoiBiACQYgBakEkaikCADcDACACQRhqIg\
cgAkGIAWpBHGopAgA3AwAgAkEQaiIIIAJBiAFqQRRqKQIANwMAIAJBCGoiCSACQZQBaikCADcDACAC\
IAIpAowBNwMAIAEgAhBMIAFBAEHIARCdASIKQQA2AsgBAkBBwAAQCSIBDQBBwABBAUEAKALMp0AiAk\
ECIAIbEQQAAAsgASACKQMANwAAIAFBOGogAykDADcAACABQTBqIAQpAwA3AAAgAUEoaiAFKQMANwAA\
IAFBIGogBikDADcAACABQRhqIAcpAwA3AAAgAUEQaiAIKQMANwAAIAFBCGogCSkDADcAACAKQQBByA\
EQnQFBADYCyAEgAEHAADYCBCAAIAE2AgAgAkHQAWokAAuiBAEJfyMAQaADayICJAAgAkHiAmpCADcB\
ACACQeoCakEAOwEAIAJB2AJqQRRqQgA3AgAgAkHYAmpBHGpCADcCACACQdgCakEkakIANwIAIAJB2A\
JqQSxqQgA3AgAgAkHYAmpBNGpCADcCACACQdgCakE8akEAOgAAIAJBlQNqQQA2AAAgAkGZA2pBADsA\
ACACQZsDakEAOgAAIAJBwAA2AtgCIAJBADsB3AIgAkEANgHeAiACQcAAaiACQdgCakHEABCXARogAk\
E4aiIDIAJBwABqQTxqKQIANwMAIAJBMGoiBCACQcAAakE0aikCADcDACACQShqIgUgAkHAAGpBLGop\
AgA3AwAgAkEgaiIGIAJBwABqQSRqKQIANwMAIAJBGGoiByACQcAAakEcaikCADcDACACQRBqIgggAk\
HAAGpBFGopAgA3AwAgAkEIaiIJIAJBzABqKQIANwMAIAIgAikCRDcDACACQcAAaiABQZgCEJcBGiAC\
QcAAaiACEEsCQEHAABAJIgoNAEHAAEEBQQAoAsynQCICQQIgAhsRBAAACyAKIAIpAwA3AAAgCkE4ai\
ADKQMANwAAIApBMGogBCkDADcAACAKQShqIAUpAwA3AAAgCkEgaiAGKQMANwAAIApBGGogBykDADcA\
ACAKQRBqIAgpAwA3AAAgCkEIaiAJKQMANwAAIAEQECAAQcAANgIEIAAgCjYCACACQaADaiQAC6IEAQ\
l/IwBBoANrIgIkACACQeICakIANwEAIAJB6gJqQQA7AQAgAkHYAmpBFGpCADcCACACQdgCakEcakIA\
NwIAIAJB2AJqQSRqQgA3AgAgAkHYAmpBLGpCADcCACACQdgCakE0akIANwIAIAJB2AJqQTxqQQA6AA\
AgAkGVA2pBADYAACACQZkDakEAOwAAIAJBmwNqQQA6AAAgAkHAADYC2AIgAkEAOwHcAiACQQA2Ad4C\
IAJBwABqIAJB2AJqQcQAEJcBGiACQThqIgMgAkHAAGpBPGopAgA3AwAgAkEwaiIEIAJBwABqQTRqKQ\
IANwMAIAJBKGoiBSACQcAAakEsaikCADcDACACQSBqIgYgAkHAAGpBJGopAgA3AwAgAkEYaiIHIAJB\
wABqQRxqKQIANwMAIAJBEGoiCCACQcAAakEUaikCADcDACACQQhqIgkgAkHMAGopAgA3AwAgAiACKQ\
JENwMAIAJBwABqIAFBmAIQlwEaIAJBwABqIAIQTAJAQcAAEAkiCg0AQcAAQQFBACgCzKdAIgJBAiAC\
GxEEAAALIAogAikDADcAACAKQThqIAMpAwA3AAAgCkEwaiAEKQMANwAAIApBKGogBSkDADcAACAKQS\
BqIAYpAwA3AAAgCkEYaiAHKQMANwAAIApBEGogCCkDADcAACAKQQhqIAkpAwA3AAAgARAQIABBwAA2\
AgQgACAKNgIAIAJBoANqJAALogQBCX8jAEHgAmsiAiQAIAJBogJqQgA3AQAgAkGqAmpBADsBACACQZ\
gCakEUakIANwIAIAJBmAJqQRxqQgA3AgAgAkGYAmpBJGpCADcCACACQZgCakEsakIANwIAIAJBmAJq\
QTRqQgA3AgAgAkGYAmpBPGpBADoAACACQdUCakEANgAAIAJB2QJqQQA7AAAgAkHbAmpBADoAACACQc\
AANgKYAiACQQA7AZwCIAJBADYBngIgAkHAAGogAkGYAmpBxAAQlwEaIAJBOGoiAyACQcAAakE8aikC\
ADcDACACQTBqIgQgAkHAAGpBNGopAgA3AwAgAkEoaiIFIAJBwABqQSxqKQIANwMAIAJBIGoiBiACQc\
AAakEkaikCADcDACACQRhqIgcgAkHAAGpBHGopAgA3AwAgAkEQaiIIIAJBwABqQRRqKQIANwMAIAJB\
CGoiCSACQcwAaikCADcDACACIAIpAkQ3AwAgAkHAAGogAUHYARCXARogAkHAAGogAhAWAkBBwAAQCS\
IKDQBBwABBAUEAKALMp0AiAkECIAIbEQQAAAsgCiACKQMANwAAIApBOGogAykDADcAACAKQTBqIAQp\
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\
CDcAACAGQRhqIAMpAwA3AAAgBkEQaiAEKQMANwAAIAZBCGogBSkDADcAACABEBAgAEEgNgIEIAAgBj\
YCACACQcABaiQAC5ADAQV/IwBB8ABrIgIkACACQSpqQgA3AQAgAkEyakEAOwEAIAJBIGpBFGpCADcC\
ACACQSBqQRxqQgA3AgAgAkEAOwEkIAJBIDYCICACQQA2ASYgAkHIAGpBIGogAkEgakEgaigCADYCAC\
ACQcgAakEYaiACQSBqQRhqKQMANwMAIAJByABqQRBqIAJBIGpBEGopAwA3AwAgAkHIAGpBCGogAkEg\
akEIaikDADcDACACIAIpAyA3A0ggAkEYaiIDIAJByABqQRxqKQIANwMAIAJBEGoiBCACQcgAakEUai\
kCADcDACACQQhqIgUgAkHUAGopAgA3AwAgAiACKQJMNwMAIAEgAhBnIAFBAEHIARCdASIGQQA2AsgB\
AkBBIBAJIgENAEEgQQFBACgCzKdAIgJBAiACGxEEAAALIAEgAikDADcAACABQRhqIAMpAwA3AAAgAU\
EQaiAEKQMANwAAIAFBCGogBSkDADcAACAGQQBByAEQnQFBADYCyAEgAEEgNgIEIAAgATYCACACQfAA\
aiQAC5ADAQV/IwBB8ABrIgIkACACQSpqQgA3AQAgAkEyakEAOwEAIAJBIGpBFGpCADcCACACQSBqQR\
xqQgA3AgAgAkEAOwEkIAJBIDYCICACQQA2ASYgAkHIAGpBIGogAkEgakEgaigCADYCACACQcgAakEY\
aiACQSBqQRhqKQMANwMAIAJByABqQRBqIAJBIGpBEGopAwA3AwAgAkHIAGpBCGogAkEgakEIaikDAD\
cDACACIAIpAyA3A0ggAkEYaiIDIAJByABqQRxqKQIANwMAIAJBEGoiBCACQcgAakEUaikCADcDACAC\
QQhqIgUgAkHUAGopAgA3AwAgAiACKQJMNwMAIAEgAhBpIAFBAEHIARCdASIGQQA2AsgBAkBBIBAJIg\
ENAEEgQQFBACgCzKdAIgJBAiACGxEEAAALIAEgAikDADcAACABQRhqIAMpAwA3AAAgAUEQaiAEKQMA\
NwAAIAFBCGogBSkDADcAACAGQQBByAEQnQFBADYCyAEgAEEgNgIEIAAgATYCACACQfAAaiQAC4gDAQ\
V/IwBBoANrIgIkACACQYIDakIANwEAIAJBigNqQQA7AQAgAkH4AmpBFGpCADcCACACQfgCakEcakIA\
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\
RXIQCiAEQQBBwQAQnQEaIAMgAy0AAEEBajoAAAtBACEDIAJBwQBJDQEgAEEIaiEFIABB6QBqIgMtAA\
AhBANAIAUgAUHAACAAKQMAIAAtAGogBEH/AXFFchAKIAMgAy0AAEEBaiIEOgAAIAFBwABqIQEgAkFA\
aiICQcAASw0ACyAALQBoIQQLIARB/wFxIgNBwQBPDQIgAkHAACADayIEIAQgAksbIQILIAAgA2pBKG\
ogASACEJcBGiAAIAAtAGggAmo6AGggAA8LIANBwABBkIjAABCEAQALIANBwABBkIjAABCEAQALggMC\
BH8BfiAAQQhqIQIgACkDACEGAkACQAJAIAAoAjAiA0HAAEcNACACIABBNGoQBkEAIQMgAEEANgIwDA\
ELIANBP0sNAQsgAEE0aiIEIANqQYABOgAAIAAgACgCMCIFQQFqIgM2AjACQAJAIANBwQBPDQAgAEEw\
aiADakEEakEAQT8gBWsQnQEaAkBBwAAgACgCMGtBB0sNACACIAQQBiAAKAIwIgNBwQBPDQIgAEE0ak\
EAIAMQnQEaCyAAQewAaiAGQgOGNwIAIAIgBBAGIABBADYCMCABIAAoAgg2AAAgASAAQQxqKAIANgAE\
IAEgAEEQaigCADYACCABIABBFGooAgA2AAwgASAAQRhqKAIANgAQIAEgAEEcaigCADYAFCABIABBIG\
ooAgA2ABggASAAQSRqKAIANgAcIAEgAEEoaigCADYAICABIABBLGooAgA2ACQPCyADQcAAQaicwAAQ\
hAEACyADQcAAQbicwAAQhQEACyADQcAAQcicwAAQhwEAC/kCAQV/IwBB4ABrIgIkACACQSpqQgA3AQ\
AgAkEyakEAOwEAIAJBIGpBFGpCADcCACACQSBqQRxqQQA2AgAgAkEcNgIgIAJBADsBJCACQQA2ASYg\
AkHAAGpBGGogAkEgakEYaikDADcDACACQcAAakEQaiACQSBqQRBqKQMANwMAIAJBwABqQQhqIAJBIG\
pBCGopAwA3AwAgAiACKQMgNwNAIAJBGGoiAyACQcAAakEcaigCADYCACACQRBqIgQgAkHAAGpBFGop\
AgA3AwAgAkEIaiIFIAJBzABqKQIANwMAIAIgAikCRDcDACABIAIQZiABQQBByAEQnQEiBkEANgLIAQ\
JAQRwQCSIBDQBBHEEBQQAoAsynQCICQQIgAhsRBAAACyABIAIpAwA3AAAgAUEYaiADKAIANgAAIAFB\
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\
AQALIANBkAFBhKDAABCEAQAL7wIBBX8CQAJAAkACQEHoACAAKALIASIDayIEIAJNDQAgAyACaiIFIA\
NJDQEgBUHpAE8NAiAAQcgBaiADakEEaiABIAIQlwEaIAAgACgCyAEgAmo2AsgBDwsCQAJAIAMNACAB\
IQUMAQsgA0HpAE8NAyACIARrIQIgASAEaiEFIAAgA2pBzAFqIAEgBBCXARpBACEDA0AgACADaiIBIA\
EtAAAgAUHMAWotAABzOgAAIANBAWoiA0HoAEcNAAsgABATCyAFIAIgAkHoAHAiBmsiAmohBwJAIAJB\
6ABJDQADQCAFQegAaiEEIAJBmH9qIQJBACEDA0AgACADaiIBIAEtAAAgBSADai0AAHM6AAAgA0EBai\
IDQegARw0ACyAAEBMgBCEFIAJB6ABPDQALCyAAQcwBaiAHIAYQlwEaIAAgBjYCyAEPCyADIAVB9J/A\
ABCIAQALIAVB6ABB9J/AABCFAQALIANB6ABBhKDAABCEAQAL8QIBBX8jAEGgA2siAiQAIAJBigNqQg\
A3AQAgAkGSA2pBADsBACACQYADakEUakIANwIAIAJBgANqQRxqQQA2AgAgAkEcNgKAAyACQQA7AYQD\
IAJBADYBhgMgAkEgakEYaiACQYADakEYaikDADcDACACQSBqQRBqIAJBgANqQRBqKQMANwMAIAJBIG\
pBCGogAkGAA2pBCGopAwA3AwAgAiACKQOAAzcDICACQRhqIgMgAkEgakEcaigCADYCACACQRBqIgQg\
AkEgakEUaikCADcDACACQQhqIgUgAkEsaikCADcDACACIAIpAiQ3AwAgAkEgaiABQeACEJcBGiACQS\
BqIAIQZgJAQRwQCSIGDQBBHEEBQQAoAsynQCICQQIgAhsRBAAACyAGIAIpAwA3AAAgBkEYaiADKAIA\
NgAAIAZBEGogBCkDADcAACAGQQhqIAUpAwA3AAAgARAQIABBHDYCBCAAIAY2AgAgAkGgA2okAAvxAg\
EFfyMAQaADayICJAAgAkGKA2pCADcBACACQZIDakEAOwEAIAJBgANqQRRqQgA3AgAgAkGAA2pBHGpB\
ADYCACACQRw2AoADIAJBADsBhAMgAkEANgGGAyACQSBqQRhqIAJBgANqQRhqKQMANwMAIAJBIGpBEG\
ogAkGAA2pBEGopAwA3AwAgAkEgakEIaiACQYADakEIaikDADcDACACIAIpA4ADNwMgIAJBGGoiAyAC\
QSBqQRxqKAIANgIAIAJBEGoiBCACQSBqQRRqKQIANwMAIAJBCGoiBSACQSxqKQIANwMAIAIgAikCJD\
cDACACQSBqIAFB4AIQlwEaIAJBIGogAhBoAkBBHBAJIgYNAEEcQQFBACgCzKdAIgJBAiACGxEEAAAL\
IAYgAikDADcAACAGQRhqIAMoAgA2AAAgBkEQaiAEKQMANwAAIAZBCGogBSkDADcAACABEBAgAEEcNg\
IEIAAgBjYCACACQaADaiQAC/ECAQV/IwBBsAFrIgIkACACQZoBakIANwEAIAJBogFqQQA7AQAgAkGQ\
AWpBFGpCADcCACACQZABakEcakEANgIAIAJBHDYCkAEgAkEAOwGUASACQQA2AZYBIAJBIGpBGGogAk\
GQAWpBGGopAwA3AwAgAkEgakEQaiACQZABakEQaikDADcDACACQSBqQQhqIAJBkAFqQQhqKQMANwMA\
IAIgAikDkAE3AyAgAkEYaiIDIAJBIGpBHGooAgA2AgAgAkEQaiIEIAJBIGpBFGopAgA3AwAgAkEIai\
IFIAJBLGopAgA3AwAgAiACKQIkNwMAIAJBIGogAUHwABCXARogAkEgaiACEEACQEEcEAkiBg0AQRxB\
AUEAKALMp0AiAkECIAIbEQQAAAsgBiACKQMANwAAIAZBGGogAygCADYAACAGQRBqIAQpAwA3AAAgBk\
EIaiAFKQMANwAAIAEQECAAQRw2AgQgACAGNgIAIAJBsAFqJAAL0AICBX8BfiMAQTBrIgIkAEEnIQMC\
QAJAIABCkM4AWg0AIAAhBwwBC0EnIQMDQCACQQlqIANqIgRBfGogAEKQzgCAIgdC8LF/fiAAfKciBU\
H//wNxQeQAbiIGQQF0QYqNwABqLwAAOwAAIARBfmogBkGcf2wgBWpB//8DcUEBdEGKjcAAai8AADsA\
ACADQXxqIQMgAEL/wdcvViEEIAchACAEDQALCwJAIAenIgRB4wBMDQAgAkEJaiADQX5qIgNqIAenIg\
VB//8DcUHkAG4iBEGcf2wgBWpB//8DcUEBdEGKjcAAai8AADsAAAsCQAJAIARBCUoNACACQQlqIANB\
f2oiA2ogBEEwajoAAAwBCyACQQlqIANBfmoiA2ogBEEBdEGKjcAAai8AADsAAAsgAUGoosAAQQAgAk\
EJaiADakEnIANrEBkhAyACQTBqJAAgAwviAgIEfwF+IABBzABqIQEgACkDACEFAkACQAJAIAAoAggi\
AkHAAEcNACABIABBDGpBARAEQQAhAiAAQQA2AggMAQsgAkE/Sw0BCyAAQQhqIAJqQQRqQYABOgAAIA\
AgACgCCCIDQQFqIgI2AggCQAJAIAJBwQBPDQAgAEEMaiIEIAJqQQBBPyADaxCdARoCQEHAACAAKAII\
a0EHSw0AIAEgBEEBEAQgACgCCCICQcEATw0CIABBDGpBACACEJ0BGgsgAEHEAGogBUI4hiAFQiiGQo\
CAgICAgMD/AIOEIAVCGIZCgICAgIDgP4MgBUIIhkKAgICA8B+DhIQgBUIIiEKAgID4D4MgBUIYiEKA\
gPwHg4QgBUIoiEKA/gODIAVCOIiEhIQ3AgAgASAEQQEQBCAAQQA2AggPCyACQcAAQaicwAAQhAEACy\
ACQcAAQbicwAAQhQEACyACQcAAQcicwAAQhwEAC7kCAQR/IwBBoAFrIgIkACACQQA2AhAgAkEIaiAC\
QRBqQQRyIAJB1ABqEKgBAkACQCACKAIMIAIoAggiA2siBEHAACAEQcAASRsiBEUNAANAIAMgAS0AAD\
oAACACIAIoAhBBAWoiBTYCECADQQFqIQMgAUEBaiEBIARBf2oiBA0ADAILCyACKAIQIQULAkAgBUE/\
Sw0AIAVBwAAQiQEACyACQdgAaiACQRBqQcQAEJcBGiAAQThqIAJBlAFqKQIANwAAIABBMGogAkGMAW\
opAgA3AAAgAEEoaiACQYQBaikCADcAACAAQSBqIAJB/ABqKQIANwAAIABBGGogAkH0AGopAgA3AAAg\
AEEQaiACQewAaikCADcAACAAQQhqIAJB5ABqKQIANwAAIAAgAikCXDcAACACQaABaiQAC7kCAQN/Iw\
BBEGsiAiQAAkAgACgCyAEiA0HHAEsNACAAIANqQcwBakEGOgAAAkAgA0EBaiIEQcgARg0AIAAgBGpB\
zAFqQQBBxwAgA2sQnQEaC0EAIQMgAEEANgLIASAAQZMCaiIEIAQtAABBgAFyOgAAA0AgACADaiIEIA\
QtAAAgBEHMAWotAABzOgAAIANBAWoiA0HIAEcNAAsgABATIAEgACkAADcAACABQThqIABBOGopAAA3\
AAAgAUEwaiAAQTBqKQAANwAAIAFBKGogAEEoaikAADcAACABQSBqIABBIGopAAA3AAAgAUEYaiAAQR\
hqKQAANwAAIAFBEGogAEEQaikAADcAACABQQhqIABBCGopAAA3AAAgAkEQaiQADwtB9Z7AAEEXIAJB\
CGpBjJ/AAEHEocAAEH8AC7kCAQN/IwBBEGsiAiQAAkAgACgCyAEiA0HHAEsNACAAIANqQcwBakEBOg\
AAAkAgA0EBaiIEQcgARg0AIAAgBGpBzAFqQQBBxwAgA2sQnQEaC0EAIQMgAEEANgLIASAAQZMCaiIE\
IAQtAABBgAFyOgAAA0AgACADaiIEIAQtAAAgBEHMAWotAABzOgAAIANBAWoiA0HIAEcNAAsgABATIA\
EgACkAADcAACABQThqIABBOGopAAA3AAAgAUEwaiAAQTBqKQAANwAAIAFBKGogAEEoaikAADcAACAB\
QSBqIABBIGopAAA3AAAgAUEYaiAAQRhqKQAANwAAIAFBEGogAEEQaikAADcAACABQQhqIABBCGopAA\
A3AAAgAkEQaiQADwtB9Z7AAEEXIAJBCGpBjJ/AAEGEocAAEH8AC8ICAQh/IwBB8ABrIgFBKGoiAkIA\
NwMAIAFBIGoiA0IANwMAIAFBGGoiBEIANwMAIAFBEGoiBUIANwMAIAFBCGoiBkIANwMAIAFCADcDAC\
ABQcoAakIANwEAIAFB0gBqQQA7AQAgAUEQNgJAIAFBADsBRCABQQA2AUYgAUHYAGpBEGogAUHAAGpB\
EGooAgA2AgAgAUHYAGpBCGogAUHAAGpBCGopAwA3AwAgASABKQNANwNYIAFBOGoiByABQeQAaikCAD\
cDACABQTBqIgggASkCXDcDACAAQcwAaiAHKQMANwAAIABBxABqIAgpAwA3AAAgAEE8aiACKQMANwAA\
IABBNGogAykDADcAACAAQSxqIAQpAwA3AAAgAEEkaiAFKQMANwAAIABBHGogBikDADcAACAAIAEpAw\
A3ABQgAEEANgIAC8ECAgR/AX4gAEEIaiECIAApAwAhBgJAAkACQCAAKAIcIgNBwABHDQAgAiAAQSBq\
EAdBACEDIABBADYCHAwBCyADQT9LDQELIABBIGoiBCADakGAAToAACAAIAAoAhwiBUEBaiIDNgIcAk\
ACQCADQcEATw0AIABBHGogA2pBBGpBAEE/IAVrEJ0BGgJAQcAAIAAoAhxrQQdLDQAgAiAEEAcgACgC\
HCIDQcEATw0CIABBIGpBACADEJ0BGgsgAEHYAGogBkIDhjcDACACIAQQByAAQQA2AhwgASAAKAIINg\
AAIAEgAEEMaigCADYABCABIABBEGooAgA2AAggASAAQRRqKAIANgAMIAEgAEEYaigCADYAEA8LIANB\
wABBqJzAABCEAQALIANBwABBuJzAABCFAQALIANBwABByJzAABCHAQALtwICBX8BfiMAQcABayICJA\
AgAkHQAGpBCGoiAyABQRBqKQMANwMAIAJB0ABqQRBqIgQgAUEYaikDADcDACACQdAAakEYaiIFIAFB\
IGopAwA3AwAgAkHQAGpBIGoiBiABQShqKQMANwMAIAIgASkDCDcDUCABKQMAIQcgAkH4AGpBBHIgAU\
E0ahBKIAIgASgCMDYCeCACQQhqIAJB+ABqQcQAEJcBGgJAQfgAEAkiAQ0AQfgAQQhBACgCzKdAIgJB\
AiACGxEEAAALIAEgBzcDACABIAIpA1A3AwggAUEQaiADKQMANwMAIAFBGGogBCkDADcDACABQSBqIA\
UpAwA3AwAgAUEoaiAGKQMANwMAIAFBMGogAkEIakHEABCXARogAEHclMAANgIEIAAgATYCACACQcAB\
aiQAC7gCAgR/AX4gAEHMAGohAiAAKQMAIQYCQAJAAkAgACgCCCIDQcAARw0AIAIgAEEMahAMQQAhAy\
AAQQA2AggMAQsgA0E/Sw0BCyAAQQhqIANqQQRqQYABOgAAIAAgACgCCCIEQQFqIgM2AggCQAJAIANB\
wQBPDQAgAEEMaiIFIANqQQBBPyAEaxCdARoCQEHAACAAKAIIa0EHSw0AIAIgBRAMIAAoAggiA0HBAE\
8NAiAAQQxqQQAgAxCdARoLIABBxABqIAZCA4Y3AgAgAiAFEAwgAEEANgIIIAEgACgCTDYAACABIABB\
0ABqKAIANgAEIAEgAEHUAGooAgA2AAggASAAQdgAaigCADYADA8LIANBwABBqJzAABCEAQALIANBwA\
BBuJzAABCFAQALIANBwABByJzAABCHAQALuAICBH8BfiAAQcwAaiECIAApAwAhBgJAAkACQCAAKAII\
IgNBwABHDQAgAiAAQQxqEA9BACEDIABBADYCCAwBCyADQT9LDQELIABBDGoiBCADakGAAToAACAAIA\
AoAggiBUEBaiIDNgIIAkACQCADQcEATw0AIABBCGogA2pBBGpBAEE/IAVrEJ0BGgJAQcAAIAAoAghr\
QQdLDQAgAiAEEA8gACgCCCIDQcEATw0CIABBDGpBACADEJ0BGgsgAEHEAGogBkIDhjcCACACIAQQDy\
AAQQA2AgggASAAKAJMNgAAIAEgAEHQAGooAgA2AAQgASAAQdQAaigCADYACCABIABB2ABqKAIANgAM\
DwsgA0HAAEGonMAAEIQBAAsgA0HAAEG4nMAAEIUBAAsgA0HAAEHInMAAEIcBAAujAgIEfwJ+IAAgAC\
kDACIHIAKtQgOGfCIINwMAIABBCGoiAyADKQMAIAggB1StfDcDAAJAAkACQAJAQYABIAAoAlAiA2si\
BCACTQ0AIAMgAmoiBCADSQ0BIARBgQFPDQIgAEHQAGogA2pBBGogASACEJcBGiAAIAAoAlAgAmo2Al\
APCyAAQRBqIQUCQCADRQ0AIANBgQFPDQMgAEHUAGoiBiADaiABIAQQlwEaIABBADYCUCAFIAZBARAD\
IAIgBGshAiABIARqIQELIAUgASACQQd2EAMgAEHUAGogASACQYB/cWogAkH/AHEiAhCXARogACACNg\
JQDwsgAyAEQYicwAAQiAEACyAEQYABQYicwAAQhQEACyADQYABQZicwAAQhAEAC54CAQR/IAAgACkD\
ACACrXw3AwACQAJAAkACQEHAACAAKAIIIgNrIgQgAk0NACADIAJqIgUgA0kNASAFQcEATw0CIABBCG\
ogA2pBBGogASACEJcBGiAAIAAoAgggAmo2AggPCyAAQcwAaiEFAkAgA0UNACADQcEATw0DIABBDGoi\
BiADaiABIAQQlwEaIAUgBhAMIAIgBGshAiABIARqIQELIAJBP3EhAyABIAJBQHEiAmohBAJAIAJFDQ\
BBACACayECA0AgBSABEAwgAUHAAGohASACQcAAaiICDQALCyAAQQxqIAQgAxCXARogACADNgIIDwsg\
AyAFQfSfwAAQiAEACyAFQcAAQfSfwAAQhQEACyADQcAAQYSgwAAQhAEAC50CAQR/IAAgACkDACACrX\
w3AwACQAJAAkACQEHAACAAKAIcIgNrIgQgAk0NACADIAJqIgUgA0kNASAFQcEATw0CIABBHGogA2pB\
BGogASACEJcBGiAAIAAoAhwgAmo2AhwPCyAAQQhqIQUCQCADRQ0AIANBwQBPDQMgAEEgaiIGIANqIA\
EgBBCXARogBSAGEAcgAiAEayECIAEgBGohAQsgAkE/cSEDIAEgAkFAcSICaiEEAkAgAkUNAEEAIAJr\
IQIDQCAFIAEQByABQcAAaiEBIAJBwABqIgINAAsLIABBIGogBCADEJcBGiAAIAM2AhwPCyADIAVB9J\
/AABCIAQALIAVBwABB9J/AABCFAQALIANBwABBhKDAABCEAQALngIBBH8gACAAKQMAIAKtfDcDAAJA\
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\
OgAAA0AgACADaiIEIAQtAAAgBEHMAWotAABzOgAAIANBAWoiA0HoAEcNAAsgABATIAEgACkAADcAAC\
ABQShqIABBKGopAAA3AAAgAUEgaiAAQSBqKQAANwAAIAFBGGogAEEYaikAADcAACABQRBqIABBEGop\
AAA3AAAgAUEIaiAAQQhqKQAANwAAIAJBEGokAA8LQfWewABBFyACQQhqQYyfwABB9KDAABB/AAuZAg\
EDfyMAQRBrIgIkAAJAIAAoAsgBIgNB5wBLDQAgACADakHMAWpBBjoAAAJAIANBAWoiBEHoAEYNACAA\
IARqQcwBakEAQecAIANrEJ0BGgtBACEDIABBADYCyAEgAEGzAmoiBCAELQAAQYABcjoAAANAIAAgA2\
oiBCAELQAAIARBzAFqLQAAczoAACADQQFqIgNB6ABHDQALIAAQEyABIAApAAA3AAAgAUEoaiAAQShq\
KQAANwAAIAFBIGogAEEgaikAADcAACABQRhqIABBGGopAAA3AAAgAUEQaiAAQRBqKQAANwAAIAFBCG\
ogAEEIaikAADcAACACQRBqJAAPC0H1nsAAQRcgAkEIakGMn8AAQbShwAAQfwALhQIBBH8CQAJAAkAC\
QEEQIAAoAgAiA2siBCACTQ0AIAMgAmoiBSADSQ0BIAVBEU8NAiAAIANqQQRqIAEgAhCXARogACAAKA\
IAIAJqNgIADwsgAEEUaiEFAkAgA0UNACADQRFPDQMgAEEEaiIGIANqIAEgBBCXARogBSAGEA0gAiAE\
ayECIAEgBGohAQsgAkEPcSEDIAEgAkFwcSICaiEEAkAgAkUNAEEAIAJrIQIDQCAFIAEQDSABQRBqIQ\
EgAkEQaiICDQALCyAAQQRqIAQgAxCXARogACADNgIADwsgAyAFQfSfwAAQiAEACyAFQRBB9J/AABCF\
AQALIANBEEGEoMAAEIQBAAukAgICfwJ+IwBBkAJrIgIkACABQQhqKQMAIQQgASkDACEFIAJBiAFqQQ\
RyIAFB1ABqEG8gAiABKAJQNgKIASACIAJBiAFqQYQBEJcBIQMCQEHYARAJIgINAEHYAUEIQQAoAsyn\
QCIBQQIgARsRBAAACyACIAU3AwAgAiAENwMIIAIgASkDEDcDECACQRhqIAFBGGopAwA3AwAgAkEgai\
ABQSBqKQMANwMAIAJBKGogAUEoaikDADcDACACQTBqIAFBMGopAwA3AwAgAkE4aiABQThqKQMANwMA\
IAJBwABqIAFBwABqKQMANwMAIAJByABqIAFByABqKQMANwMAIAJB0ABqIANBhAEQlwEaIABByJXAAD\
YCBCAAIAI2AgAgA0GQAmokAAukAgICfwJ+IwBBkAJrIgIkACABQQhqKQMAIQQgASkDACEFIAJBiAFq\
QQRyIAFB1ABqEG8gAiABKAJQNgKIASACIAJBiAFqQYQBEJcBIQMCQEHYARAJIgINAEHYAUEIQQAoAs\
ynQCIBQQIgARsRBAAACyACIAU3AwAgAiAENwMIIAIgASkDEDcDECACQRhqIAFBGGopAwA3AwAgAkEg\
aiABQSBqKQMANwMAIAJBKGogAUEoaikDADcDACACQTBqIAFBMGopAwA3AwAgAkE4aiABQThqKQMANw\
MAIAJBwABqIAFBwABqKQMANwMAIAJByABqIAFByABqKQMANwMAIAJB0ABqIANBhAEQlwEaIABB7JXA\
ADYCBCAAIAI2AgAgA0GQAmokAAuDAgEEfyAAIAApAwAgAq1CA4Z8NwMAAkACQAJAAkBBwAAgACgCCC\
IDayIEIAJNDQAgAyACaiIEIANJDQEgBEHBAE8NAiAAQQhqIANqQQRqIAEgAhCXARogACAAKAIIIAJq\
NgIIDwsgAEHMAGohBQJAIANFDQAgA0HBAE8NAyAAQQxqIgYgA2ogASAEEJcBGiAAQQA2AgggBSAGQQ\
EQBCACIARrIQIgASAEaiEBCyAFIAEgAkEGdhAEIABBDGogASACQUBxaiACQT9xIgIQlwEaIAAgAjYC\
CA8LIAMgBEGInMAAEIgBAAsgBEHAAEGInMAAEIUBAAsgA0HAAEGYnMAAEIQBAAuRAgEDfyMAQYABay\
ICJAAgAkEYaiABQdQAEJcBGgJAAkAgAigCGCIDQRBPDQAgAkEYakEEciIEIANqQRAgA2siAyADEJ0B\
GiACQQA2AhggAkEsaiIDIAQQDSACQfAAakEIaiACQeQAaikCADcDACACIAJB3ABqKQIANwNwIAMgAk\
HwAGoQDSACQQhqQQhqIgQgAkE0aikCADcDACACIAIpAiw3AwhBEBAJIgNFDQEgAyACKQMINwAAIANB\
CGogBCkDADcAACABEBAgAEEQNgIEIAAgAzYCACACQYABaiQADwtB9Z7AAEEXIAJB8ABqQfCawABBgJ\
vAABB/AAtBEEEBQQAoAsynQCICQQIgAhsRBAAAC/8BAQR/IAAgACkDACACrXw3AwACQAJAAkACQEHA\
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\
ciABQcwBahBtIAIgASgCyAE2AqACIAJBCGpByAFqIAJBoAJqQcwAEJcBGgJAQZgCEAkiAQ0AQZgCQQ\
hBACgCzKdAIgJBAiACGxEEAAALIAEgAkEIakGYAhCXASEBIABB5JDAADYCBCAAIAE2AgAgAkHwAmok\
AAuaAQEBfyMAQYAEayICJAAgAkEIaiABQcgBEJcBGiACQegCakEEciABQcwBahBuIAIgASgCyAE2Au\
gCIAJBCGpByAFqIAJB6AJqQZQBEJcBGgJAQeACEAkiAQ0AQeACQQhBACgCzKdAIgJBAiACGxEEAAAL\
IAEgAkEIakHgAhCXASEBIABBiJHAADYCBCAAIAE2AgAgAkGABGokAAuaAQEBfyMAQfADayICJAAgAk\
EIaiABQcgBEJcBGiACQeACakEEciABQcwBahBxIAIgASgCyAE2AuACIAJBCGpByAFqIAJB4AJqQYwB\
EJcBGgJAQdgCEAkiAQ0AQdgCQQhBACgCzKdAIgJBAiACGxEEAAALIAEgAkEIakHYAhCXASEBIABBrJ\
HAADYCBCAAIAE2AgAgAkHwA2okAAuaAQEBfyMAQYAEayICJAAgAkEIaiABQcgBEJcBGiACQegCakEE\
ciABQcwBahBuIAIgASgCyAE2AugCIAJBCGpByAFqIAJB6AJqQZQBEJcBGgJAQeACEAkiAQ0AQeACQQ\
hBACgCzKdAIgJBAiACGxEEAAALIAEgAkEIakHgAhCXASEBIABB0JHAADYCBCAAIAE2AgAgAkGABGok\
AAuaAQEBfyMAQbADayICJAAgAkEIaiABQcgBEJcBGiACQcACakEEciABQcwBahBwIAIgASgCyAE2As\
ACIAJBCGpByAFqIAJBwAJqQewAEJcBGgJAQbgCEAkiAQ0AQbgCQQhBACgCzKdAIgJBAiACGxEEAAAL\
IAEgAkEIakG4AhCXASEBIABB9JHAADYCBCAAIAE2AgAgAkGwA2okAAuaAQEBfyMAQfADayICJAAgAk\
EIaiABQcgBEJcBGiACQeACakEEciABQcwBahBxIAIgASgCyAE2AuACIAJBCGpByAFqIAJB4AJqQYwB\
EJcBGgJAQdgCEAkiAQ0AQdgCQQhBACgCzKdAIgJBAiACGxEEAAALIAEgAkEIakHYAhCXASEBIABBmJ\
LAADYCBCAAIAE2AgAgAkHwA2okAAuaAQEBfyMAQfACayICJAAgAkEIaiABQcgBEJcBGiACQaACakEE\
ciABQcwBahBtIAIgASgCyAE2AqACIAJBCGpByAFqIAJBoAJqQcwAEJcBGgJAQZgCEAkiAQ0AQZgCQQ\
hBACgCzKdAIgJBAiACGxEEAAALIAEgAkEIakGYAhCXASEBIABBvJLAADYCBCAAIAE2AgAgAkHwAmok\
AAuaAQEBfyMAQbADayICJAAgAkEIaiABQcgBEJcBGiACQcACakEEciABQcwBahBwIAIgASgCyAE2As\
ACIAJBCGpByAFqIAJBwAJqQewAEJcBGgJAQbgCEAkiAQ0AQbgCQQhBACgCzKdAIgJBAiACGxEEAAAL\
IAEgAkEIakG4AhCXASEBIABB4JLAADYCBCAAIAE2AgAgAkGwA2okAAt/AQF/IwBBwABrIgUkACAFIA\
E2AgwgBSAANgIIIAUgAzYCFCAFIAI2AhAgBUEsakECNgIAIAVBPGpBBDYCACAFQgI3AhwgBUHwj8AA\
NgIYIAVBATYCNCAFIAVBMGo2AiggBSAFQRBqNgI4IAUgBUEIajYCMCAFQRhqIAQQmwEAC34BAn8jAE\
EwayICJAAgAkEUakEBNgIAIAJBhIzAADYCECACQQE2AgwgAkH8i8AANgIIIAFBHGooAgAhAyABKAIY\
IQEgAkEsakECNgIAIAJCAjcCHCACQfCPwAA2AhggAiACQQhqNgIoIAEgAyACQRhqEBwhASACQTBqJA\
AgAQt+AQJ/IwBBMGsiAiQAIAJBFGpBATYCACACQYSMwAA2AhAgAkEBNgIMIAJB/IvAADYCCCABQRxq\
KAIAIQMgASgCGCEBIAJBLGpBAjYCACACQgI3AhwgAkHwj8AANgIYIAIgAkEIajYCKCABIAMgAkEYah\
AcIQEgAkEwaiQAIAELjgEAIABCADcDCCAAQgA3AwAgAEEANgJQIABBACkD2J1ANwMQIABBGGpBACkD\
4J1ANwMAIABBIGpBACkD6J1ANwMAIABBKGpBACkD8J1ANwMAIABBMGpBACkD+J1ANwMAIABBOGpBAC\
kDgJ5ANwMAIABBwABqQQApA4ieQDcDACAAQcgAakEAKQOQnkA3AwALjgEAIABCADcDCCAAQgA3AwAg\
AEEANgJQIABBACkDmJ1ANwMQIABBGGpBACkDoJ1ANwMAIABBIGpBACkDqJ1ANwMAIABBKGpBACkDsJ\
1ANwMAIABBMGpBACkDuJ1ANwMAIABBOGpBACkDwJ1ANwMAIABBwABqQQApA8idQDcDACAAQcgAakEA\
KQPQnUA3AwALbQEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBHGpBAjYCACADQSxqQQU2AgAgA0\
ICNwIMIANBmI/AADYCCCADQQU2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEJsB\
AAttAQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EcakECNgIAIANBLGpBBTYCACADQgI3AgwgA0\
HUjsAANgIIIANBBTYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQmwEAC20BAX8j\
AEEwayIDJAAgAyABNgIEIAMgADYCACADQRxqQQI2AgAgA0EsakEFNgIAIANCAzcCDCADQYSQwAA2Ag\
ggA0EFNgIkIAMgA0EgajYCGCADIAM2AiggAyADQQRqNgIgIANBCGogAhCbAQALbQEBfyMAQTBrIgMk\
ACADIAE2AgQgAyAANgIAIANBHGpBAjYCACADQSxqQQU2AgAgA0ICNwIMIANBuIzAADYCCCADQQU2Ai\
QgAyADQSBqNgIYIAMgAzYCKCADIANBBGo2AiAgA0EIaiACEJsBAAttAQF/IwBBMGsiAyQAIAMgATYC\
BCADIAA2AgAgA0EcakECNgIAIANBLGpBBTYCACADQgI3AgwgA0G8j8AANgIIIANBBTYCJCADIANBIG\
o2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQmwEAC3ABAX8jAEEwayICJAAgAiABNgIEIAIgADYC\
ACACQRxqQQI2AgAgAkEsakEFNgIAIAJCAjcCDCACQZCWwAA2AgggAkEFNgIkIAIgAkEgajYCGCACIA\
JBBGo2AiggAiACNgIgIAJBCGpBoJbAABCbAQALbAAgAEIANwMAIAAgACkDcDcDCCAAQSBqIABBiAFq\
KQMANwMAIABBGGogAEGAAWopAwA3AwAgAEEQaiAAQfgAaikDADcDACAAQShqQQBBwgAQnQEaAkAgAE\
HwDmoiAC0AAEUNACAAQQA6AAALC2MBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBCGpBEGogAUEQaikC\
ADcDACACQQhqQQhqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBjIfAACACQQhqEBwhASACQSBqJA\
AgAQt3AQF/QQBBACgC+KNAQQFqNgL4o0ACQAJAAkBBACgCwKdAQQFHDQBBAEEAKALEp0BBAWoiADYC\
xKdAIABBA08NAkEAKALIp0BBf0wNAiAAQQJJDQEMAgtBAEKBgICAEDcDwKdAQQAoAsinQEF/TA0BCx\
DEAQALAAtlAgF/AX4jAEEQayICJAACQAJAIAFFDQAgASgCAA0BIAFBfzYCACACQQhqIAEoAgQgAUEI\
aigCACgCEBEEACACKQMIIQMgAUEANgIAIAAgAzcDACACQRBqJAAPCxCxAQALELIBAAtUAQJ/AkAgAC\
gCACIAQQRqKAIAIABBCGoiAygCACIEayACTw0AIAAgBCACEGwgAygCACEECyAAKAIAIARqIAEgAhCX\
ARogAyADKAIAIAJqNgIAQQALSgEDf0EAIQMCQCACRQ0AAkADQCAALQAAIgQgAS0AACIFRw0BIABBAW\
ohACABQQFqIQEgAkF/aiICRQ0CDAALCyAEIAVrIQMLIAMLUQECfwJAAkAgAEUNACAAKAIADQEgAEEA\
NgIAIAAoAgQhASAAKAIIIQIgABAQIAEgAigCABEBAAJAIAIoAgRFDQAgARAQCw8LELEBAAsQsgEAC0\
4AAkACQCAARQ0AIAAoAgANASAAQX82AgAgACgCBCABIAIgAEEIaigCACgCDBEGAAJAIAJFDQAgARAQ\
CyAAQQA2AgAPCxCxAQALELIBAAtUAQF/AkACQCABQYCAxABGDQBBASEEIAAoAhggASAAQRxqKAIAKA\
IQEQUADQELAkAgAg0AQQAPCyAAKAIYIAIgAyAAQRxqKAIAKAIMEQcAIQQLIAQLWAAgAEIANwMAIABB\
ADYCMCAAQQApA6CbQDcDCCAAQRBqQQApA6ibQDcDACAAQRhqQQApA7CbQDcDACAAQSBqQQApA7ibQD\
cDACAAQShqQQApA8CbQDcDAAtIAQF/IwBBIGsiAyQAIANBFGpBADYCACADQaiiwAA2AhAgA0IBNwIE\
IAMgATYCHCADIAA2AhggAyADQRhqNgIAIAMgAhCbAQALTAAgAEEANgIIIABCADcDACAAQQApAticQD\
cCTCAAQdQAakEAKQLgnEA3AgAgAEHcAGpBACkC6JxANwIAIABB5ABqQQApAvCcQDcCAAtMACAAQQA2\
AgggAEIANwMAIABBACkD+JxANwJMIABB1ABqQQApA4CdQDcCACAAQdwAakEAKQOInUA3AgAgAEHkAG\
pBACkDkJ1ANwIACzYBAX8CQCACRQ0AIAAhAwNAIAMgAS0AADoAACABQQFqIQEgA0EBaiEDIAJBf2oi\
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\
AABrAAAAYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yAA\
YAAAAAAAAAAQAAAGwAAAD4AxAAGAAAAEUCAAAcAAAAbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzIAQQ\
AEkAAABlAQAACQAAAH4vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZW\
M4MjMvYmxha2UzLTAuMy44L3NyYy9saWIucnMAAAAgBBAASQAAAAsCAAAKAAAAIAQQAEkAAAA5AgAA\
CQAAACAEEABJAAAArgIAABkAAAAgBBAASQAAALACAAAJAAAAIAQQAEkAAACwAgAAOAAAAGFzc2VydG\
lvbiBmYWlsZWQ6IG1pZCA8PSBzZWxmLmxlbigpACgPEABNAAAA4wUAAAkAAAAgBBAASQAAAIMCAAAJ\
AAAAIAQQAEkAAACKAgAACgAAACAEEABJAAAAmQMAADMAAAAgBBAASQAAAJoDAAAyAAAAIAQQAEkAAA\
BVBAAAFgAAACAEEABJAAAAZwQAABYAAAAgBBAASQAAAJgEAAASAAAAIAQQAEkAAACiBAAAEgAAAAYA\
AAAEAAAABAAAAG0AAACQBRAASwAAAM0AAAAgAAAAfi8uY2FyZ28vcmVnaXN0cnkvc3JjL2dpdGh1Yi\
5jb20tMWVjYzYyOTlkYjllYzgyMy9hcnJheXZlYy0wLjUuMi9zcmMvbGliLnJzAAYAAAAEAAAABAAA\
AG0AAAAGAAAAIAAAAAEAAABuAAAAIQYQAA0AAAAMBhAAFQAAAGluc3VmZmljaWVudCBjYXBhY2l0eU\
NhcGFjaXR5RXJyb3JQYWRFcnJvcgAAWAYQACAAAAB4BhAAEgAAAAYAAAAAAAAAAQAAAG8AAABpbmRl\
eCBvdXQgb2YgYm91bmRzOiB0aGUgbGVuIGlzICBidXQgdGhlIGluZGV4IGlzIDAwMDEwMjAzMDQwNT\
A2MDcwODA5MTAxMTEyMTMxNDE1MTYxNzE4MTkyMDIxMjIyMzI0MjUyNjI3MjgyOTMwMzEzMjMzMzQz\
NTM2MzczODM5NDA0MTQyNDM0NDQ1NDY0NzQ4NDk1MDUxNTI1MzU0NTU1NjU3NTg1OTYwNjE2MjYzNj\
Q2NTY2Njc2ODY5NzA3MTcyNzM3NDc1NzY3Nzc4Nzk4MDgxODI4Mzg0ODU4Njg3ODg4OTkwOTE5Mjkz\
OTQ5NTk2OTc5ODk5AABkBxAAEAAAAHQHEAAiAAAAcmFuZ2UgZW5kIGluZGV4ICBvdXQgb2YgcmFuZ2\
UgZm9yIHNsaWNlIG9mIGxlbmd0aCAAAKgHEAASAAAAdAcQACIAAAByYW5nZSBzdGFydCBpbmRleCAA\
AMwHEAAWAAAA4gcQAA0AAABzbGljZSBpbmRleCBzdGFydHMgYXQgIGJ1dCBlbmRzIGF0IAAoERAAAA\
AAAAAIEAACAAAAOiApABwIEAAVAAAAMQgQACsAAAACCBAAAQAAAHNvdXJjZSBzbGljZSBsZW5ndGgg\
KCkgZG9lcyBub3QgbWF0Y2ggZGVzdGluYXRpb24gc2xpY2UgbGVuZ3RoIChFcnJvcgAAAAYAAAAYAQ\
AACAAAAFAAAABfAAAAYAAAAFMAAABUAAAAYQAAAAYAAABgAQAACAAAAD4AAAA/AAAAQAAAAEEAAABC\
AAAAQwAAAAYAAABYAQAACAAAAEQAAABZAAAAWgAAAEcAAABIAAAAWwAAAAYAAABgAQAACAAAAD4AAA\
BWAAAAVwAAAEEAAABCAAAAWAAAAAYAAAA4AQAACAAAAEoAAABcAAAAXQAAAE0AAABOAAAAXgAAAAYA\
AABYAQAACAAAAEQAAABFAAAARgAAAEcAAABIAAAASQAAAAYAAAAYAQAACAAAAFAAAABRAAAAUgAAAF\
MAAABUAAAAVQAAAAYAAAA4AQAACAAAAEoAAABLAAAATAAAAE0AAABOAAAATwAAAAYAAABwAAAACAAA\
ACgAAAAuAAAALwAAADAAAAAxAAAAMgAAAAYAAABwAAAACAAAACgAAAApAAAAKgAAACsAAAAsAAAALQ\
AAAAYAAABgAAAACAAAABMAAAAUAAAAFQAAABAAAAARAAAAFgAAAGIAAAB4BwAACAAAAGMAAABkAAAA\
ZQAAAGYAAABnAAAAaAAAAAYAAABgAAAACAAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAAAAYAAABgAA\
AACAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAAAYAAAB4AAAACAAAAB0AAAAeAAAAHwAAACAAAAAh\
AAAAIgAAAAYAAABgAAAACAAAACMAAAAkAAAAJQAAACYAAAAbAAAAJwAAAAYAAABUAAAABAAAAAcAAA\
AIAAAACQAAAAoAAAALAAAADAAAAAYAAADYAAAACAAAADMAAAA5AAAAOgAAADsAAAA8AAAAPQAAAAYA\
AADYAAAACAAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADALEAAhAAAAUQsQABcAAADUEBAAUQAAAG\
cBAAAFAAAAR2VuZXJpY0FycmF5Ojpmcm9tX2l0ZXIgcmVjZWl2ZWQgIGVsZW1lbnRzIGJ1dCBleHBl\
Y3RlZCABAAAAAAAAAIKAAAAAAAAAioAAAAAAAIAAgACAAAAAgIuAAAAAAAAAAQAAgAAAAACBgACAAA\
AAgAmAAAAAAACAigAAAAAAAACIAAAAAAAAAAmAAIAAAAAACgAAgAAAAACLgACAAAAAAIsAAAAAAACA\
iYAAAAAAAIADgAAAAAAAgAKAAAAAAACAgAAAAAAAAIAKgAAAAAAAAAoAAIAAAACAgYAAgAAAAICAgA\
AAAAAAgAEAAIAAAAAACIAAgAAAAIApLkPJoth8AT02VKHs8AYTYqcF88DHc4yYkyvZvEyCyh6bVzz9\
1OAWZ0JvGIoX5RK+TsTW2p7eSaD79Y67L+56qWh5kRWyBz+UwhCJCyJfIYB/XZpakDInNT7M57/3lw\
P/GTCzSKW10ddekiqsVqrGT7g40pakfbZ2/GvinHQE8UWdcFlkcYcghlvPZeYtqAIbYCWtrrC59hxG\
YWk0QH4PVUejI91RrzrDXPnOusXqJixTDW6FKIQJ09/N9EGBTVJq3DfIbMGr+iThewgMvbFKeIiVi+\
Nj6G3py9X+OwAdOfLvtw5mWNDkpndy+Ot1SwoxRFC0j+0fGtuZjTOfEYMUfi8uY2FyZ28vcmVnaXN0\
cnkvc3JjL2dpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyMy9tZDItMC45LjAvc3JjL2xpYi5ycwAABg\
AAAAAAAAABAAAAcAAAACgNEABGAAAAbwAAAA4AAAABI0VniavN7/7cuph2VDIQASNFZ4mrze/+3LqY\
dlQyEPDh0sMQMlR2mLrc/u/Nq4lnRSMBDx4tPAEjRWeJq83v/ty6mHZUMhDw4dLDY2FsbGVkIGBSZX\
N1bHQ6OnVud3JhcCgpYCBvbiBhbiBgRXJyYCB2YWx1ZQAUEBAATwAAADoAAAANAAAAFBAQAE8AAABB\
AAAADQAAABQQEABPAAAAhwAAABcAAAAUEBAATwAAAIsAAAAbAAAAFBAQAE8AAACEAAAACQAAANieBc\
EH1Xw2F91wMDlZDvcxC8D/ERVYaKeP+WSkT/q+Z+YJaoWuZ7ty8248OvVPpX9SDlGMaAWbq9mDHxnN\
4FvYngXBXZ27ywfVfDYqKZpiF91wMFoBWZE5WQ732OwvFTELwP9nJjNnERVYaIdKtI6nj/lkDS4M26\
RP+r4dSLVHCMm882fmCWo7p8qEha5nuyv4lP5y82488TYdXzr1T6XRguatf1IOUR9sPiuMaAWba71B\
+6vZgx95IX4TGc3gWygPEABNAAAA6wsAAA0AAAAvcnVzdGMvNTNjYjdiMDliMDBjYmVhODc1NGZmYj\
c4ZTdlM2NiNTIxY2I4YWY0Yi9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5yc3dlIG5ldmVyIHVz\
ZSBpbnB1dF9sYXp5BgAAAAAAAAABAAAAcAAAAKwPEABHAAAAQQAAAAEAAAB+Ly5jYXJnby9yZWdpc3\
RyeS9zcmMvZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzL3NoYTMtMC45LjEvc3JjL2xpYi5ycwAU\
EBAATwAAABsAAAANAAAAFBAQAE8AAAAiAAAADQAAAH4vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodW\
IuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvYmxvY2stYnVmZmVyLTAuOS4wL3NyYy9saWIucnMArA8QAEcA\
AABIAAAAAQAAAKwPEABHAAAATwAAAAEAAACsDxAARwAAAFYAAAABAAAArA8QAEcAAABmAAAAAQAAAK\
wPEABHAAAAbQAAAAEAAACsDxAARwAAAHQAAAABAAAArA8QAEcAAAB7AAAAAQAAAH4vLmNhcmdvL3Jl\
Z2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvZ2VuZXJpYy1hcnJheS0wLjE0Lj\
Qvc3JjL2xpYi5ycwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUA\
ZBEQABwAAADsAQAAHgAAAGxpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnMEAAAAAAAAAG51bGwgcG\
9pbnRlciBwYXNzZWQgdG8gcnVzdHJlY3Vyc2l2ZSB1c2Ugb2YgYW4gb2JqZWN0IGRldGVjdGVkIHdo\
aWNoIHdvdWxkIGxlYWQgdG8gdW5zYWZlIGFsaWFzaW5nIGluIHJ1c3QApeWAgAAEbmFtZQGa5YCAAM\
cBADZ3YXNtX2JpbmRnZW46Ol9fd2JpbmRnZW5fc3RyaW5nX25ldzo6aDg1ZDAzZjY1ODJiZmMxZWQB\
MXdhc21fYmluZGdlbjo6X193YmluZGdlbl90aHJvdzo6aDU2NTkwZWE1ZmNkN2Q0YjMCM3dhc21fYm\
luZGdlbjo6X193YmluZGdlbl9yZXRocm93OjpoN2VmMjVmMjk2ZmZjNzFlMwMvc2hhMjo6c2hhNTEy\
Ojpzb2Z0Ojpjb21wcmVzczo6aGM0M2QxYjA4NzhlYWZiODkEL3NoYTI6OnNoYTI1Njo6c29mdDo6Y2\
9tcHJlc3M6Omg3NDdmNmFkOGQ2ZjNjNDliBQtjcmVhdGVfaGFzaAY2cmlwZW1kMzIwOjpibG9jazo6\
cHJvY2Vzc19tc2dfYmxvY2s6OmgzYjU4YjBkMjc1MDQwZDBkBzZyaXBlbWQxNjA6OmJsb2NrOjpwcm\
9jZXNzX21zZ19ibG9jazo6aGMyYmJkYTk3NDdlMTk1ZGQIK3NoYTE6OmNvbXByZXNzOjpjb21wcmVz\
czo6aGIyNWQwMDU3ZWM2MmM3ZWIJOmRsbWFsbG9jOjpkbG1hbGxvYzo6RGxtYWxsb2M8QT46Om1hbG\
xvYzo6aGRhNDhiMThmMWE5MzBiNzYKNmJsYWtlMzo6cG9ydGFibGU6OmNvbXByZXNzX2luX3BsYWNl\
OjpoNjNlMTI2ZmM5MzZkMzY3MAs/PEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Oj\
p1cGRhdGU6Omg2ZGYwNWIxYmEzNDcxOGZiDCdtZDU6OnV0aWxzOjpjb21wcmVzczo6aGM5YTkyZTVh\
ZDhmZjE4YjINL21kMjo6TWQyU3RhdGU6OnByb2Nlc3NfYmxvY2s6Omg1MjgzMmZiYzEyNTFkYmNhDj\
BibGFrZTM6OmNvbXByZXNzX3N1YnRyZWVfd2lkZTo6aDI3ODEyZGE5NzM1OWE4MTAPL21kNDo6TWQ0\
U3RhdGU6OnByb2Nlc3NfYmxvY2s6Omg3NjNlY2ZhN2ZkMmE4MTM4EDhkbG1hbGxvYzo6ZGxtYWxsb2\
M6OkRsbWFsbG9jPEE+OjpmcmVlOjpoMGIzNjc5M2M5NzIxMjMzZhFBZGxtYWxsb2M6OmRsbWFsbG9j\
OjpEbG1hbGxvYzxBPjo6ZGlzcG9zZV9jaHVuazo6aGVjNWMyYWYzZDQyNDY2YmUSK2JsYWtlMzo6SG\
FzaGVyOjpmaW5hbGl6ZTo6aDNmZTdmOTY4MTNmZDFjZDYTIGtlY2Nhazo6ZjE2MDA6OmhiOGVmNmQ1\
M2VhMTEzODVkFCxjb3JlOjpmbXQ6OkZvcm1hdHRlcjo6cGFkOjpoY2M2ZGI3YjU5M2YzYjk2MxUOX1\
9ydXN0X3JlYWxsb2MWYTxzaGEyOjpzaGE1MTI6OlNoYTUxMiBhcyBkaWdlc3Q6OmZpeGVkOjpGaXhl\
ZE91dHB1dERpcnR5Pjo6ZmluYWxpemVfaW50b19kaXJ0eTo6aDFhZTU4YzExODk0ZjYxNTgXMWJsYW\
tlMzo6SGFzaGVyOjptZXJnZV9jdl9zdGFjazo6aDk4OGIxZjlkYWQ2YzIyYTQYRzxEIGFzIGRpZ2Vz\
dDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemVfcmVzZXQ6OmhhNjlmZmJjMjFiODIwZj\
NkGTVjb3JlOjpmbXQ6OkZvcm1hdHRlcjo6cGFkX2ludGVncmFsOjpoOGJkZWJmNmFmZTRjMDFlZBpH\
PEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZV9yZXNldDo6aGUyYT\
IzNjE1OTkxMDI5NGYbRzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxp\
emVfcmVzZXQ6OmgxMWUzMDc2ZWZiZTZlYmM5HCNjb3JlOjpmbXQ6OndyaXRlOjpoZTljNGRjNmIwNT\
gwNDA5NR1hPHNoYTI6OnNoYTUxMjo6U2hhMzg0IGFzIGRpZ2VzdDo6Zml4ZWQ6OkZpeGVkT3V0cHV0\
RGlydHk+OjpmaW5hbGl6ZV9pbnRvX2RpcnR5OjpoYTYzMThiYzJjYjRmZjI4Yh5HPEQgYXMgZGlnZX\
N0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZV9yZXNldDo6aDg5ZTliNTc2M2Q2NDA3\
NDQfQjxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6Ym94X2Nsb25lOjpoMTg4Mz\
c4NTM3ZmE3ODdmNCBXPHNoYTE6OlNoYTEgYXMgZGlnZXN0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0\
eT46OmZpbmFsaXplX2ludG9fZGlydHk6OmgzODg1MjgzMjA5MGFjNGY4IUc8RCBhcyBkaWdlc3Q6Om\
R5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplX3Jlc2V0OjpoYzM3ZDYyNWQwN2IzNzhhNSI0\
Ymxha2UzOjpjb21wcmVzc19wYXJlbnRzX3BhcmFsbGVsOjpoMzQ1N2Y2YWI2NWU2NmQxNyNHPEQgYX\
MgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZV9yZXNldDo6aDRiNWVjM2Mz\
ZWM5YTRhYTUkRzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemVfcm\
VzZXQ6OmhjOGI4MWVjNDM0MjdhMjUyJUE8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2Vz\
dD46OmZpbmFsaXplOjpoMmY0OTU5YjM5YzI1YWFiMiZBPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0Oj\
pEeW5EaWdlc3Q+OjpmaW5hbGl6ZTo6aDk3MDQ1NWZjZmJlYjZjNzknQTxEIGFzIGRpZ2VzdDo6ZHlu\
X2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemU6OmhiNGY4MTZiNGM2MGVlYmZhKEc8RCBhcyBkaW\
dlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplX3Jlc2V0OjpoMTM4OWY4ZmRlZTlk\
OTY4YylHPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZV9yZXNldD\
o6aGNkYzQ5ODM2Njg5NWZlMDkqQTxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6\
ZmluYWxpemU6OmhlODUyOTk3YTUxOGRkNWVlK0E8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bk\
RpZ2VzdD46OmZpbmFsaXplOjpoZjI2OGUzMjNjMjA1MGEwMyxBPEQgYXMgZGlnZXN0OjpkeW5fZGln\
ZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZTo6aDg3NzdjMjFmNDhhZWJhZTctRzxEIGFzIGRpZ2VzdD\
o6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemVfcmVzZXQ6OmhjMDk2N2Y0MmU0MTQ2YzY3\
LmE8c2hhMjo6c2hhMjU2OjpTaGEyNTYgYXMgZGlnZXN0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT\
46OmZpbmFsaXplX2ludG9fZGlydHk6OmhhNWZjNDdiZWViZmI4NDQ5L0c8RCBhcyBkaWdlc3Q6OmR5\
bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplX3Jlc2V0OjpoMGNlZmEzMzI0ZjQwYTIwMTBBPE\
QgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZTo6aGI2OTRlNTBkYTc0\
ODg0M2MxMnNoYTI6OnNoYTUxMjo6RW5naW5lNTEyOjpmaW5pc2g6Omg0N2M0YWIxNmI1ZWVlYzFlMk\
E8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplOjpoZTJkMWVlMjc1\
OWVhMzE5ZjNHPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZV9yZX\
NldDo6aDcxMWU1YTcxOTY1MmI1NWU0RzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0\
Pjo6ZmluYWxpemVfcmVzZXQ6OmhjNTFhMzQwMDY1NzczMDcyNUE8RCBhcyBkaWdlc3Q6OmR5bl9kaW\
dlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplOjpoNWJhOTRjZGY5NzA5NzYwNjZBPEQgYXMgZGlnZXN0\
OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZTo6aGU1ODcwZWM4MGY5YTA5NDA3QTxEIG\
FzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemU6OmhkMmY0OGZkMzU5M2Q4\
ZGIwOEI8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmJveF9jbG9uZTo6aGVlNT\
RkMGNjMjA5M2IwNGY5RzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxp\
emVfcmVzZXQ6OmgxMzdhYWU1YTc3Nzg0MTI3Okc8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bk\
RpZ2VzdD46OmZpbmFsaXplX3Jlc2V0OjpoMWQzMjllZWMzNTkwNDFmMDs7PCZtdXQgVyBhcyBjb3Jl\
OjpmbXQ6OldyaXRlPjo6d3JpdGVfY2hhcjo6aDczMTIxZmJlMmE5OTBhMmU8LWJsYWtlMzo6Q2h1bm\
tTdGF0ZTo6dXBkYXRlOjpoZDU2Nzk3NzFlMWQxNDNkOT1hPHJpcGVtZDMyMDo6UmlwZW1kMzIwIGFz\
IGRpZ2VzdDo6Zml4ZWQ6OkZpeGVkT3V0cHV0RGlydHk+OjpmaW5hbGl6ZV9pbnRvX2RpcnR5OjpoMj\
k3ZmNmNmI3NjE1MTI2Nj5HPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5h\
bGl6ZV9yZXNldDo6aDE1MjdmNTI1MDgxODUwNTE/RzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RH\
luRGlnZXN0Pjo6ZmluYWxpemVfcmVzZXQ6OmhhMDMwMTYzNjliMjU5MmU3QGE8c2hhMjo6c2hhMjU2\
OjpTaGEyMjQgYXMgZGlnZXN0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZpbmFsaXplX2ludG\
9fZGlydHk6Omg5MTY1NTc5OTI1MDg2NTJjQT88RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRp\
Z2VzdD46OnVwZGF0ZTo6aDExMWVlOGZhMTY0ZGUwZjhCPzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdD\
o6RHluRGlnZXN0Pjo6dXBkYXRlOjpoMTliYjU5NWFkMTljNGQ5OUM/PEQgYXMgZGlnZXN0OjpkeW5f\
ZGlnZXN0OjpEeW5EaWdlc3Q+Ojp1cGRhdGU6OmgyOGI4ZmZmMGM3M2NmMWQ1RD88RCBhcyBkaWdlc3\
Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OnVwZGF0ZTo6aDY4NzI4YWJiZmY4NTE0MDNFQTxEIGFz\
IGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemU6OmhhZmYyZmZjNDFlODFlMm\
NjRkE8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplOjpoZmFiNjc3\
Y2M3MTViYWFkZUdBPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZT\
o6aDEzNmYwYTExOGMwOWQyZDhIL2NvcmU6OmZtdDo6bnVtOjppbXA6OmZtdF91NjQ6Omg0NDBlYzRi\
N2JmODRmM2UzSTJzaGEyOjpzaGEyNTY6OkVuZ2luZTI1Njo6ZmluaXNoOjpoMDc1ZThjOTBiZDExZm\
VlZkpuZ2VuZXJpY19hcnJheTo6aW1wbHM6OjxpbXBsIGNvcmU6OmNsb25lOjpDbG9uZSBmb3IgZ2Vu\
ZXJpY19hcnJheTo6R2VuZXJpY0FycmF5PFQsTj4+OjpjbG9uZTo6aDljMWI0YzA3NTg1NWU4MmNLWz\
xzaGEzOjpTaGEzXzUxMiBhcyBkaWdlc3Q6OmZpeGVkOjpGaXhlZE91dHB1dERpcnR5Pjo6ZmluYWxp\
emVfaW50b19kaXJ0eTo6aDgwYWI5YTVjZTAxMTYwYjBMXDxzaGEzOjpLZWNjYWs1MTIgYXMgZGlnZX\
N0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZpbmFsaXplX2ludG9fZGlydHk6OmhiZjhjMmU3\
N2JiMzRkZjJlTT48RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OnJlc2V0OjpoMj\
Q4ZmEzZmU1MGU3NTFlN05hPHJpcGVtZDE2MDo6UmlwZW1kMTYwIGFzIGRpZ2VzdDo6Zml4ZWQ6OkZp\
eGVkT3V0cHV0RGlydHk+OjpmaW5hbGl6ZV9pbnRvX2RpcnR5OjpoYmY1MzJjZWUwOTJiZDMxOU9CPE\
QgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Ojpib3hfY2xvbmU6OmhjZTI3ZDQ2ZDY5\
MmQwYTk3UFU8bWQ1OjpNZDUgYXMgZGlnZXN0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZpbm\
FsaXplX2ludG9fZGlydHk6OmhmY2NhMTcyNWQ2MGQ0MjYxUVU8bWQ0OjpNZDQgYXMgZGlnZXN0Ojpm\
aXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZpbmFsaXplX2ludG9fZGlydHk6OmhhNzNmODUzODY0NT\
FjM2ExUj88RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OnVwZGF0ZTo6aGExMTU0\
MzY2YWViZWRjNTBTPzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6dXBkYXRlOj\
poYzEyMTE4YWViM2YyY2UzOVQ/PEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Ojp1\
cGRhdGU6Omg4NjcyMTI5MjY2NGVlZTEzVT88RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2\
VzdD46OnVwZGF0ZTo6aGY1ZDY2ZjBmOWE5Mjc5MTFWPzxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6\
RHluRGlnZXN0Pjo6dXBkYXRlOjpoMzUyMDk2YTNjYmI4Y2Q2MFdHPEQgYXMgZGlnZXN0OjpkeW5fZG\
lnZXN0OjpEeW5EaWdlc3Q+OjpmaW5hbGl6ZV9yZXNldDo6aDRkNzc4ZmRlMjNkNDQ1YzlYRzxEIGFz\
IGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemVfcmVzZXQ6OmgyYmE3MTQzMT\
BmZGViODQ0WUE8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmZpbmFsaXplOjpo\
NTJkMTliZGU5MDViZTc2MlpBPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpmaW\
5hbGl6ZTo6aGE5OTI5MjIzZTEwYzZiNzFbXDxzaGEzOjpLZWNjYWszODQgYXMgZGlnZXN0OjpmaXhl\
ZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZpbmFsaXplX2ludG9fZGlydHk6OmgxOTA1NGVkN2M3Y2FkNj\
cyXFs8c2hhMzo6U2hhM18zODQgYXMgZGlnZXN0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZp\
bmFsaXplX2ludG9fZGlydHk6OmgwOTQwMmY4MzM2OGQ5NzhkXT88RCBhcyBkaWdlc3Q6OmR5bl9kaW\
dlc3Q6OkR5bkRpZ2VzdD46OnVwZGF0ZTo6aDEzNjE4OGU5OWM5NmIwN2ZeQjxEIGFzIGRpZ2VzdDo6\
ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6Ym94X2Nsb25lOjpoM2IxYmI0ZDhlMGQ4Mjk4N19CPEQgYX\
MgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Ojpib3hfY2xvbmU6Omg4OWUyZTJhODVjMTYz\
YjFiYD88RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OnVwZGF0ZTo6aDIwNmUwM2\
UwZmQ0ODVmMTNhQTxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6ZmluYWxpemU6\
OmhlZjY3MzMwYmU1MTNiNWIyYj88RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46On\
VwZGF0ZTo6aDJjMGQ1MDI0YjcxNzgzNTZjbmdlbmVyaWNfYXJyYXk6OmltcGxzOjo8aW1wbCBjb3Jl\
OjpjbG9uZTo6Q2xvbmUgZm9yIGdlbmVyaWNfYXJyYXk6OkdlbmVyaWNBcnJheTxULE4+Pjo6Y2xvbm\
U6Omg4MWE5ZTc1YjEyYTAxMjUxZEE8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46\
OmZpbmFsaXplOjpoM2IyZDA4MGRlNWVhMTBjNWVBPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW\
5EaWdlc3Q+OjpmaW5hbGl6ZTo6aDk5ODE3OGYyZGQwOGUzM2ZmXDxzaGEzOjpLZWNjYWsyMjQgYXMg\
ZGlnZXN0OjpmaXhlZDo6Rml4ZWRPdXRwdXREaXJ0eT46OmZpbmFsaXplX2ludG9fZGlydHk6Omg5NT\
UyNDlhMmVhYWYzZTdjZ1w8c2hhMzo6S2VjY2FrMjU2IGFzIGRpZ2VzdDo6Zml4ZWQ6OkZpeGVkT3V0\
cHV0RGlydHk+OjpmaW5hbGl6ZV9pbnRvX2RpcnR5OjpoMzVmNjYwZTNiZjZmZmZlMWhbPHNoYTM6Ol\
NoYTNfMjI0IGFzIGRpZ2VzdDo6Zml4ZWQ6OkZpeGVkT3V0cHV0RGlydHk+OjpmaW5hbGl6ZV9pbnRv\
X2RpcnR5OjpoNzk5NDFjMDQwNmEzNDI3Y2lbPHNoYTM6OlNoYTNfMjU2IGFzIGRpZ2VzdDo6Zml4ZW\
Q6OkZpeGVkT3V0cHV0RGlydHk+OjpmaW5hbGl6ZV9pbnRvX2RpcnR5OjpoOTk0MDEyZWEyNDJiOTkx\
N2pCPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Ojpib3hfY2xvbmU6OmhhMjVkNj\
AwMWU0MDQ1YTA4a0I8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmJveF9jbG9u\
ZTo6aGUzNWM1NDcwMDE1YTFiMmNsTmFsbG9jOjpyYXdfdmVjOjpSYXdWZWM8VCxBPjo6cmVzZXJ2ZT\
o6ZG9fcmVzZXJ2ZV9hbmRfaGFuZGxlOjpoODYyNGFiNzE1MTQ5ZWViMm1uZ2VuZXJpY19hcnJheTo6\
aW1wbHM6OjxpbXBsIGNvcmU6OmNsb25lOjpDbG9uZSBmb3IgZ2VuZXJpY19hcnJheTo6R2VuZXJpY0\
FycmF5PFQsTj4+OjpjbG9uZTo6aDAxMTQ3OTBjM2U2ZmNlYjdubmdlbmVyaWNfYXJyYXk6OmltcGxz\
Ojo8aW1wbCBjb3JlOjpjbG9uZTo6Q2xvbmUgZm9yIGdlbmVyaWNfYXJyYXk6OkdlbmVyaWNBcnJheT\
xULE4+Pjo6Y2xvbmU6OmgyNDA0NDY5MTcyMzczOGQ0b25nZW5lcmljX2FycmF5OjppbXBsczo6PGlt\
cGwgY29yZTo6Y2xvbmU6OkNsb25lIGZvciBnZW5lcmljX2FycmF5OjpHZW5lcmljQXJyYXk8VCxOPj\
46OmNsb25lOjpoODdmY2Q0YzQ2N2RjNzc5N3BuZ2VuZXJpY19hcnJheTo6aW1wbHM6OjxpbXBsIGNv\
cmU6OmNsb25lOjpDbG9uZSBmb3IgZ2VuZXJpY19hcnJheTo6R2VuZXJpY0FycmF5PFQsTj4+OjpjbG\
9uZTo6aGE0ODgzZTE4MjY0ZmFiZGFxbmdlbmVyaWNfYXJyYXk6OmltcGxzOjo8aW1wbCBjb3JlOjpj\
bG9uZTo6Q2xvbmUgZm9yIGdlbmVyaWNfYXJyYXk6OkdlbmVyaWNBcnJheTxULE4+Pjo6Y2xvbmU6Om\
hjZGViNzdmN2Y3Yjg2MGI4ckI8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmJv\
eF9jbG9uZTo6aDM5MTQxZDI4NzM3YzhiYzFzQjxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRG\
lnZXN0Pjo6Ym94X2Nsb25lOjpoOTA4YzM0N2EyNTE3MDU0ZHRCPEQgYXMgZGlnZXN0OjpkeW5fZGln\
ZXN0OjpEeW5EaWdlc3Q+Ojpib3hfY2xvbmU6Omg5ZjUyNWI2OTNmOTcyMDVmdUI8RCBhcyBkaWdlc3\
Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmJveF9jbG9uZTo6aGE2YjY4MWMxZjhjMzVhOTZ2LmFs\
bG9jOjpyYXdfdmVjOjpmaW5pc2hfZ3Jvdzo6aDU1MTQ0YWZiYWZjYTUyMGR3QjxEIGFzIGRpZ2VzdD\
o6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6Ym94X2Nsb25lOjpoMzlmMWQ5YmU2NDA2MWE0Y3hCPEQg\
YXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Ojpib3hfY2xvbmU6Omg1MTQ1OTQ3MjVkNz\
k2NGRmeUI8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OmJveF9jbG9uZTo6aDU5\
MTg4YmVhMWJlOTQ3Y2N6QjxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6Ym94X2\
Nsb25lOjpoNjdkOGJhN2JmY2IyNzc1MntCPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdl\
c3Q+Ojpib3hfY2xvbmU6OmhhYjJlZTQyNjYzMDdlNWZkfEI8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3\
Q6OkR5bkRpZ2VzdD46OmJveF9jbG9uZTo6aGNiMTg0ZmY3YTUwNTY5YTV9QjxEIGFzIGRpZ2VzdDo6\
ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6Ym94X2Nsb25lOjpoZDQ1ZDA2NzI2MDY5Nzc0YX5CPEQgYX\
MgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+Ojpib3hfY2xvbmU6OmhmZjdiN2Y3Y2Y5MmNm\
NTcxfy5jb3JlOjpyZXN1bHQ6OnVud3JhcF9mYWlsZWQ6Omg5YmY5OWJjYTg4YmEwNWRjgAFQPGFycm\
F5dmVjOjplcnJvcnM6OkNhcGFjaXR5RXJyb3I8VD4gYXMgY29yZTo6Zm10OjpEZWJ1Zz46OmZtdDo6\
aDFkNTg1OWMzYTVmMmEzMjSBAVA8YXJyYXl2ZWM6OmVycm9yczo6Q2FwYWNpdHlFcnJvcjxUPiBhcy\
Bjb3JlOjpmbXQ6OkRlYnVnPjo6Zm10OjpoYmYyNTk2ODRjMzZmYzQ0ZoIBPjxEIGFzIGRpZ2VzdDo6\
ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6cmVzZXQ6OmhiMjg3ZDY1ZDg4NzBjNDljgwE+PEQgYXMgZG\
lnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpyZXNldDo6aGI2NmU2Zjg0NzcyN2UyZWOEAUFj\
b3JlOjpzbGljZTo6aW5kZXg6OnNsaWNlX3N0YXJ0X2luZGV4X2xlbl9mYWlsOjpoZjg2NGRiMmY3MG\
NmZTEyZIUBP2NvcmU6OnNsaWNlOjppbmRleDo6c2xpY2VfZW5kX2luZGV4X2xlbl9mYWlsOjpoZDgx\
M2NkY2EwMGVkNTkwZIYBTmNvcmU6OnNsaWNlOjo8aW1wbCBbVF0+Ojpjb3B5X2Zyb21fc2xpY2U6Om\
xlbl9taXNtYXRjaF9mYWlsOjpoODU3Mjc3ZGYwMzg3N2ZmOIcBNmNvcmU6OnBhbmlja2luZzo6cGFu\
aWNfYm91bmRzX2NoZWNrOjpoYjE1MTc3ZTA2NzkyMzIxNYgBPWNvcmU6OnNsaWNlOjppbmRleDo6c2\
xpY2VfaW5kZXhfb3JkZXJfZmFpbDo6aGU1M2ZmMzYxNjAwYzhiZTGJATdnZW5lcmljX2FycmF5Ojpm\
cm9tX2l0ZXJfbGVuZ3RoX2ZhaWw6OmhjZTQ1MWY0ZTFiMTBiMzk2igE+PEQgYXMgZGlnZXN0OjpkeW\
5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpyZXNldDo6aDMyYmE3ZWY0NjIzNjZlNDiLATo8Jm11dCBXIGFz\
IGNvcmU6OmZtdDo6V3JpdGU+Ojp3cml0ZV9mbXQ6OmgzMGY1MjA1YjU0YjE4OGE4jAE3c3RkOjpwYW\
5pY2tpbmc6OnJ1c3RfcGFuaWNfd2l0aF9ob29rOjpoYmRiY2ViNWNkMTU4YmYxOY0BC2RpZ2VzdF9o\
YXNojgE6PCZtdXQgVyBhcyBjb3JlOjpmbXQ6OldyaXRlPjo6d3JpdGVfc3RyOjpoYmI3NTg3MzRkNW\
I0MTlkYY8BBGJjbXCQARNfX3diZ19kZW5vaGFzaF9mcmVlkQELdXBkYXRlX2hhc2iSAUNjb3JlOjpm\
bXQ6OkZvcm1hdHRlcjo6cGFkX2ludGVncmFsOjp3cml0ZV9wcmVmaXg6OmhiZjQ2MzQ3Y2VjY2NmNT\
NlkwE+PEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpyZXNldDo6aDlmNTBkZDky\
NWNjYTRiZGOUASljb3JlOjpwYW5pY2tpbmc6OnBhbmljOjpoNWJmZGZhYTNkYjlhNGI0YZUBPjxEIG\
FzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6cmVzZXQ6Omg0OTNjMzNjNzZlZjVkOGFk\
lgE+PEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpyZXNldDo6aGI4MWZlMmRmYz\
E4ZjA1OGSXAQZtZW1jcHmYARFydXN0X2JlZ2luX3Vud2luZJkBPjxEIGFzIGRpZ2VzdDo6ZHluX2Rp\
Z2VzdDo6RHluRGlnZXN0Pjo6cmVzZXQ6OmhjNWFlZDI0ZTg3ZjAwMjM5mgE+PEQgYXMgZGlnZXN0Oj\
pkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpyZXNldDo6aDI4NDQzNTUxMTE5Mzk2YjKbAS1jb3JlOjpw\
YW5pY2tpbmc6OnBhbmljX2ZtdDo6aDNhYjU0MTcxNTViN2JhM2KcAUlzdGQ6OnN5c19jb21tb246Om\
JhY2t0cmFjZTo6X19ydXN0X2VuZF9zaG9ydF9iYWNrdHJhY2U6OmhjNzYwODE2MWE0NjdjMDAynQEG\
bWVtc2V0ngERX193YmluZGdlbl9tYWxsb2OfAT48RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bk\
RpZ2VzdD46OnJlc2V0OjpoM2Q5MTYwNDRiMzhlOTAzOaABEl9fd2JpbmRnZW5fcmVhbGxvY6EBQ3N0\
ZDo6cGFuaWNraW5nOjpiZWdpbl9wYW5pY19oYW5kbGVyOjp7e2Nsb3N1cmV9fTo6aDk5OTViYjJmMG\
RlNGJiMziiATtjb3JlOjpwdHI6OmRyb3BfaW5fcGxhY2U8Ymxha2UzOjpIYXNoZXI+OjpoYmM0Yjkz\
YTU0Y2FjYzM1Y6MBRTxibG9ja19wYWRkaW5nOjpQYWRFcnJvciBhcyBjb3JlOjpmbXQ6OkRlYnVnPj\
o6Zm10OjpoODJjY2Y1Y2Q1ZWYxMjM2MaQBPjxjb3JlOjpmbXQ6OkVycm9yIGFzIGNvcmU6OmZtdDo6\
RGVidWc+OjpmbXQ6Omg5MmFkODFmMzJjNDQzNGQwpQEyY29yZTo6b3B0aW9uOjpPcHRpb248VD46On\
Vud3JhcDo6aDdiNTUxODMzMjE2Yzg4NjamATA8JlQgYXMgY29yZTo6Zm10OjpEZWJ1Zz46OmZtdDo6\
aDdiNDBkZDdlMTg5NjNhMjmnATI8JlQgYXMgY29yZTo6Zm10OjpEaXNwbGF5Pjo6Zm10OjpoOGE0Yj\
c0NGUwNDJjYWRlNagBTjxJIGFzIGNvcmU6Oml0ZXI6OnRyYWl0czo6Y29sbGVjdDo6SW50b0l0ZXJh\
dG9yPjo6aW50b19pdGVyOjpoOTdhMDEzZjljYmEyYjljYakBPjxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2\
VzdDo6RHluRGlnZXN0Pjo6cmVzZXQ6OmgyNjJmNjgzZjNiYTNjMWQxqgE+PEQgYXMgZGlnZXN0Ojpk\
eW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpyZXNldDo6aDI4NTc5ZDI0NDE5MDY2ZTOrAT48RCBhcyBkaW\
dlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46OnJlc2V0OjpoOGI0NWYwY2U5OGZlZmIzYawBPjxE\
IGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6cmVzZXQ6OmhhOWY4YzhiMDU3MTUyNm\
U3rQEPX193YmluZGdlbl9mcmVlrgE0YWxsb2M6OnJhd192ZWM6OmNhcGFjaXR5X292ZXJmbG93Ojpo\
NDA3ZTZjZDE3ZTJkYTViNa8BOWNvcmU6Om9wczo6ZnVuY3Rpb246OkZuT25jZTo6Y2FsbF9vbmNlOj\
poYjVlN2Y4Y2Y1Nzk5OWFkN7ABH19fd2JpbmRnZW5fYWRkX3RvX3N0YWNrX3BvaW50ZXKxATF3YXNt\
X2JpbmRnZW46Ol9fcnQ6OnRocm93X251bGw6OmhjOTdlYTYyNDJlZjE5ODc2sgEyd2FzbV9iaW5kZ2\
VuOjpfX3J0Ojpib3Jyb3dfZmFpbDo6aGVjMjk4OTI4NWFjZTYyY2SzAU5jb3JlOjpmbXQ6Om51bTo6\
aW1wOjo8aW1wbCBjb3JlOjpmbXQ6OkRpc3BsYXkgZm9yIHUzMj46OmZtdDo6aDY0NWY0NWE5MWU3MT\
VjODW0ASp3YXNtX2JpbmRnZW46OnRocm93X3N0cjo6aGZiZDk3MTE3NjVlZTdkMWS1ASp3YXNtX2Jp\
bmRnZW46OnRocm93X3ZhbDo6aGY5ZDMxMzhhYjBiYzAxMDe2ATE8VCBhcyBjb3JlOjphbnk6OkFueT\
46OnR5cGVfaWQ6OmgyOWRlYzgxMzgyZDNkNmE0twFEPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpE\
eW5EaWdlc3Q+OjpvdXRwdXRfc2l6ZTo6aDE4NWZiM2MzZDI5YWZhNGW4AUQ8RCBhcyBkaWdlc3Q6Om\
R5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46Om91dHB1dF9zaXplOjpoMTlkNTc3YjNmNzkwZTY5NLkBRDxE\
IGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6b3V0cHV0X3NpemU6Omg3MDZlZTQzNW\
Q0MWJjNjViugFEPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpvdXRwdXRfc2l6\
ZTo6aDcxZTY2Nzc2NWRiNWVkY2O7AUQ8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD\
46Om91dHB1dF9zaXplOjpoMzQzMWViNGQ5OWU3MTNmY7wBRDxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2Vz\
dDo6RHluRGlnZXN0Pjo6b3V0cHV0X3NpemU6Omg3OGFjNGIxODczNTZhNmI2vQFEPEQgYXMgZGlnZX\
N0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpvdXRwdXRfc2l6ZTo6aDViZThjNjllMDU5ODM5Zje+\
AUQ8RCBhcyBkaWdlc3Q6OmR5bl9kaWdlc3Q6OkR5bkRpZ2VzdD46Om91dHB1dF9zaXplOjpoNmNiNT\
RmMmI0NWE2OGQ2Nr8BRDxEIGFzIGRpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6b3V0cHV0\
X3NpemU6OmhhNDAyMjZlNmY4MzU1ZjI3wAFEPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaW\
dlc3Q+OjpvdXRwdXRfc2l6ZTo6aDJkOTEzYjllOWYzNThhYmPBAUQ8RCBhcyBkaWdlc3Q6OmR5bl9k\
aWdlc3Q6OkR5bkRpZ2VzdD46Om91dHB1dF9zaXplOjpoZDg0NzI3NGM0MDY3OTRkMcIBRDxEIGFzIG\
RpZ2VzdDo6ZHluX2RpZ2VzdDo6RHluRGlnZXN0Pjo6b3V0cHV0X3NpemU6Omg4MjUzN2Y2ZTdkNWJk\
ZmNhwwFEPEQgYXMgZGlnZXN0OjpkeW5fZGlnZXN0OjpEeW5EaWdlc3Q+OjpvdXRwdXRfc2l6ZTo6aG\
IwZWM2MGQ5YmI4YjE4NDTEAQpydXN0X3BhbmljxQE3c3RkOjphbGxvYzo6ZGVmYXVsdF9hbGxvY19l\
cnJvcl9ob29rOjpoMDZmYjkxMTY3MjYwOWRkN8YBb2NvcmU6OnB0cjo6ZHJvcF9pbl9wbGFjZTwmY2\
9yZTo6aXRlcjo6YWRhcHRlcnM6OmNvcGllZDo6Q29waWVkPGNvcmU6OnNsaWNlOjppdGVyOjpJdGVy\
PHU4Pj4+OjpoNTRmNjAzZDg5NDA0ZWEyMgDvgICAAAlwcm9kdWNlcnMCCGxhbmd1YWdlAQRSdXN0AA\
xwcm9jZXNzZWQtYnkDBXJ1c3RjHTEuNTMuMCAoNTNjYjdiMDliIDIwMjEtMDYtMTcpBndhbHJ1cwYw\
LjE5LjAMd2FzbS1iaW5kZ2VuBjAuMi43NA=="));
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
const wasm = wasmInstance.exports;
class Hash {
    #hash;
    #digested;
    constructor(algorithm){
        this.#hash = create_hash(algorithm);
        this.#digested = false;
    }
    update(message) {
        let view;
        if (message instanceof Uint8Array) {
            view = message;
        } else if (typeof message === "string") {
            view = new TextEncoder().encode(message);
        } else if (ArrayBuffer.isView(message)) {
            view = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
        } else if (message instanceof ArrayBuffer) {
            view = new Uint8Array(message);
        } else {
            throw new Error("hash: `data` is invalid type");
        }
        const chunkSize = 65_536;
        for(let offset = 0; offset < view.byteLength; offset += chunkSize){
            update_hash(this.#hash, new Uint8Array(view.buffer, view.byteOffset + offset, Math.min(65_536, view.byteLength - offset)));
        }
        return this;
    }
    digest() {
        if (this.#digested) throw new Error("hash: already digested");
        this.#digested = true;
        return digest_hash(this.#hash);
    }
    toString(format = "hex") {
        const finalized = new Uint8Array(this.digest());
        switch(format){
            case "hex":
                return new TextDecoder().decode(encode(finalized));
            case "base64":
                return encode1(finalized);
            default:
                throw new Error("hash: invalid format");
        }
    }
}
const supportedAlgorithms = [
    "md2",
    "md4",
    "md5",
    "ripemd160",
    "ripemd320",
    "sha1",
    "sha224",
    "sha256",
    "sha384",
    "sha512",
    "sha3-224",
    "sha3-256",
    "sha3-384",
    "sha3-512",
    "keccak224",
    "keccak256",
    "keccak384",
    "keccak512",
    "blake3"
];
function createHash(algorithm) {
    return new Hash(algorithm);
}
const MAX_ALLOC = Math.pow(2, 30) - 1;
function createHasher(alg) {
    let normalizedAlg;
    if (alg === "rmd160") {
        normalizedAlg = "ripemd160";
    } else {
        normalizedAlg = alg;
    }
    return (value)=>Buffer.from(createHash(normalizedAlg).update(value).digest());
}
function getZeroes(zeros) {
    return Buffer.alloc(zeros);
}
const sizes = {
    md5: 16,
    sha1: 20,
    sha224: 28,
    sha256: 32,
    sha384: 48,
    sha512: 64,
    rmd160: 20,
    ripemd160: 20
};
function toBuffer(bufferable) {
    if (bufferable instanceof Uint8Array || typeof bufferable === "string") {
        return Buffer.from(bufferable);
    } else {
        return Buffer.from(bufferable.buffer);
    }
}
class Hmac {
    hash;
    ipad1;
    opad;
    alg;
    blocksize;
    size;
    ipad2;
    constructor(alg, key, saltLen){
        this.hash = createHasher(alg);
        const blocksize = alg === "sha512" || alg === "sha384" ? 128 : 64;
        if (key.length > blocksize) {
            key = this.hash(key);
        } else if (key.length < blocksize) {
            key = Buffer.concat([
                key,
                getZeroes(blocksize - key.length)
            ], blocksize);
        }
        const ipad = Buffer.allocUnsafe(blocksize + sizes[alg]);
        const opad = Buffer.allocUnsafe(blocksize + sizes[alg]);
        for(let i = 0; i < blocksize; i++){
            ipad[i] = key[i] ^ 0x36;
            opad[i] = key[i] ^ 0x5C;
        }
        const ipad1 = Buffer.allocUnsafe(blocksize + saltLen + 4);
        ipad.copy(ipad1, 0, 0, blocksize);
        this.ipad1 = ipad1;
        this.ipad2 = ipad;
        this.opad = opad;
        this.alg = alg;
        this.blocksize = blocksize;
        this.size = sizes[alg];
    }
    run(data, ipad) {
        data.copy(ipad, this.blocksize);
        const h = this.hash(ipad);
        h.copy(this.opad, this.blocksize);
        return this.hash(this.opad);
    }
}
function pbkdf2Sync(password, salt, iterations, keylen, digest = "sha1") {
    if (typeof iterations !== "number" || iterations < 0) {
        throw new TypeError("Bad iterations");
    }
    if (typeof keylen !== "number" || keylen < 0 || keylen > MAX_ALLOC) {
        throw new TypeError("Bad key length");
    }
    const bufferedPassword = toBuffer(password);
    const bufferedSalt = toBuffer(salt);
    const hmac = new Hmac(digest, bufferedPassword, bufferedSalt.length);
    const DK = Buffer.allocUnsafe(keylen);
    const block1 = Buffer.allocUnsafe(bufferedSalt.length + 4);
    bufferedSalt.copy(block1, 0, 0, bufferedSalt.length);
    let destPos = 0;
    const hLen = sizes[digest];
    const l = Math.ceil(keylen / hLen);
    for(let i = 1; i <= l; i++){
        block1.writeUInt32BE(i, bufferedSalt.length);
        const T = hmac.run(block1, hmac.ipad1);
        let U = T;
        for(let j = 1; j < iterations; j++){
            U = hmac.run(U, hmac.ipad2);
            for(let k = 0; k < hLen; k++)T[k] ^= U[k];
        }
        T.copy(DK, destPos);
        destPos += hLen;
    }
    return DK;
}
function pbkdf2(password, salt, iterations, keylen, digest = "sha1", callback) {
    setTimeout(()=>{
        let err = null, res;
        try {
            res = pbkdf2Sync(password, salt, iterations, keylen, digest);
        } catch (e) {
            err = e;
        }
        if (err) {
            callback(err);
        } else {
            callback(null, res);
        }
    }, 0);
}
function isReadable(stream) {
    return typeof stream.readable === "boolean" || typeof stream.readableEnded === "boolean" || !!stream._readableState;
}
function isWritable(stream) {
    return typeof stream.writable === "boolean" || typeof stream.writableEnded === "boolean" || !!stream._writableState;
}
function isWritableFinished(stream) {
    if (stream.writableFinished) return true;
    const wState = stream._writableState;
    if (!wState || wState.errored) return false;
    return wState.finished || wState.ended && wState.length === 0;
}
function nop() {}
function isReadableEnded(stream) {
    if (stream.readableEnded) return true;
    const rState = stream._readableState;
    if (!rState || rState.errored) return false;
    return rState.endEmitted || rState.ended && rState.length === 0;
}
function eos(stream, x, y) {
    let opts;
    let callback;
    if (!y) {
        if (typeof x !== "function") {
            throw new ERR_INVALID_ARG_TYPE("callback", "function", x);
        }
        opts = {};
        callback = x;
    } else {
        if (!x || Array.isArray(x) || typeof x !== "object") {
            throw new ERR_INVALID_ARG_TYPE("opts", "object", x);
        }
        opts = x;
        if (typeof y !== "function") {
            throw new ERR_INVALID_ARG_TYPE("callback", "function", y);
        }
        callback = y;
    }
    callback = once(callback);
    const readable = opts.readable ?? isReadable(stream);
    const writable = opts.writable ?? isWritable(stream);
    const wState = stream._writableState;
    const rState = stream._readableState;
    const validState = wState || rState;
    const onlegacyfinish = ()=>{
        if (!stream.writable) {
            onfinish();
        }
    };
    let willEmitClose = validState?.autoDestroy && validState?.emitClose && validState?.closed === false && isReadable(stream) === readable && isWritable(stream) === writable;
    let writableFinished = stream.writableFinished || wState?.finished;
    const onfinish = ()=>{
        writableFinished = true;
        if (stream.destroyed) {
            willEmitClose = false;
        }
        if (willEmitClose && (!stream.readable || readable)) {
            return;
        }
        if (!readable || readableEnded) {
            callback.call(stream);
        }
    };
    let readableEnded = stream.readableEnded || rState?.endEmitted;
    const onend = ()=>{
        readableEnded = true;
        if (stream.destroyed) {
            willEmitClose = false;
        }
        if (willEmitClose && (!stream.writable || writable)) {
            return;
        }
        if (!writable || writableFinished) {
            callback.call(stream);
        }
    };
    const onerror = (err)=>{
        callback.call(stream, err);
    };
    const onclose = ()=>{
        if (readable && !readableEnded) {
            if (!isReadableEnded(stream)) {
                return callback.call(stream, new ERR_STREAM_PREMATURE_CLOSE());
            }
        }
        if (writable && !writableFinished) {
            if (!isWritableFinished(stream)) {
                return callback.call(stream, new ERR_STREAM_PREMATURE_CLOSE());
            }
        }
        callback.call(stream);
    };
    if (writable && !wState) {
        stream.on("end", onlegacyfinish);
        stream.on("close", onlegacyfinish);
    }
    stream.on("end", onend);
    stream.on("finish", onfinish);
    if (opts.error !== false) stream.on("error", onerror);
    stream.on("close", onclose);
    const closed = wState?.closed || rState?.closed || wState?.errorEmitted || rState?.errorEmitted || (!writable || wState?.finished) && (!readable || rState?.endEmitted);
    if (closed) {
        queueMicrotask(callback);
    }
    return function() {
        callback = nop;
        stream.removeListener("aborted", onclose);
        stream.removeListener("complete", onfinish);
        stream.removeListener("abort", onclose);
        stream.removeListener("end", onlegacyfinish);
        stream.removeListener("close", onlegacyfinish);
        stream.removeListener("finish", onfinish);
        stream.removeListener("end", onend);
        stream.removeListener("error", onerror);
        stream.removeListener("close", onclose);
    };
}
function destroyer(stream, err) {
    if (typeof stream.destroy === "function") {
        return stream.destroy(err);
    }
    if (typeof stream.close === "function") {
        return stream.close();
    }
}
class Stream extends __default1 {
    constructor(){
        super();
    }
    static _isUint8Array = mod.isUint8Array;
    static _uint8ArrayToBuffer = (chunk)=>Buffer.from(chunk);
    pipe(dest, options) {
        const source = this;
        if (options?.end ?? true) {
            source.on("end", onend);
            source.on("close", onclose);
        }
        let didOnEnd = false;
        function onend() {
            if (didOnEnd) return;
            didOnEnd = true;
            dest.end();
        }
        function onclose() {
            if (didOnEnd) return;
            didOnEnd = true;
            if (typeof dest.destroy === "function") dest.destroy();
        }
        function onerror(er) {
            cleanup();
            if (this.listenerCount("error") === 0) {
                throw er;
            }
        }
        source.on("error", onerror);
        dest.on("error", onerror);
        function cleanup() {
            source.removeListener("end", onend);
            source.removeListener("close", onclose);
            source.removeListener("error", onerror);
            dest.removeListener("error", onerror);
            source.removeListener("end", cleanup);
            source.removeListener("close", cleanup);
            dest.removeListener("close", cleanup);
        }
        source.on("end", cleanup);
        source.on("close", cleanup);
        dest.on("close", cleanup);
        dest.emit("pipe", source);
        return dest;
    }
    static Readable;
    static Writable;
    static Duplex;
    static Transform;
    static PassThrough;
    static pipeline;
    static finished;
    static promises;
    static Stream;
}
class BufferList {
    head = null;
    tail = null;
    length;
    constructor(){
        this.head = null;
        this.tail = null;
        this.length = 0;
    }
    push(v) {
        const entry = {
            data: v,
            next: null
        };
        if (this.length > 0) {
            this.tail.next = entry;
        } else {
            this.head = entry;
        }
        this.tail = entry;
        ++this.length;
    }
    unshift(v) {
        const entry = {
            data: v,
            next: this.head
        };
        if (this.length === 0) {
            this.tail = entry;
        }
        this.head = entry;
        ++this.length;
    }
    shift() {
        if (this.length === 0) {
            return;
        }
        const ret = this.head.data;
        if (this.length === 1) {
            this.head = this.tail = null;
        } else {
            this.head = this.head.next;
        }
        --this.length;
        return ret;
    }
    clear() {
        this.head = this.tail = null;
        this.length = 0;
    }
    join(s) {
        if (this.length === 0) {
            return "";
        }
        let p = this.head;
        let ret = "" + p.data;
        p = p.next;
        while(p){
            ret += s + p.data;
            p = p.next;
        }
        return ret;
    }
    concat(n) {
        if (this.length === 0) {
            return Buffer.alloc(0);
        }
        const ret = Buffer.allocUnsafe(n >>> 0);
        let p = this.head;
        let i = 0;
        while(p){
            ret.set(p.data, i);
            i += p.data.length;
            p = p.next;
        }
        return ret;
    }
    consume(n, hasStrings) {
        const data = this.head.data;
        if (n < data.length) {
            const slice = data.slice(0, n);
            this.head.data = data.slice(n);
            return slice;
        }
        if (n === data.length) {
            return this.shift();
        }
        return hasStrings ? this._getString(n) : this._getBuffer(n);
    }
    first() {
        return this.head.data;
    }
    *[Symbol.iterator]() {
        for(let p = this.head; p; p = p.next){
            yield p.data;
        }
    }
    _getString(n) {
        let ret = "";
        let p = this.head;
        let c = 0;
        p = p.next;
        do {
            const str = p.data;
            if (n > str.length) {
                ret += str;
                n -= str.length;
            } else {
                if (n === str.length) {
                    ret += str;
                    ++c;
                    if (p.next) {
                        this.head = p.next;
                    } else {
                        this.head = this.tail = null;
                    }
                } else {
                    ret += str.slice(0, n);
                    this.head = p;
                    p.data = str.slice(n);
                }
                break;
            }
            ++c;
            p = p.next;
        }while (p)
        this.length -= c;
        return ret;
    }
    _getBuffer(n) {
        const ret = Buffer.allocUnsafe(n);
        const retLen = n;
        let p = this.head;
        let c = 0;
        p = p.next;
        do {
            const buf = p.data;
            if (n > buf.length) {
                ret.set(buf, retLen - n);
                n -= buf.length;
            } else {
                if (n === buf.length) {
                    ret.set(buf, retLen - n);
                    ++c;
                    if (p.next) {
                        this.head = p.next;
                    } else {
                        this.head = this.tail = null;
                    }
                } else {
                    ret.set(new Uint8Array(buf.buffer, buf.byteOffset, n), retLen - n);
                    this.head = p;
                    p.data = buf.slice(n);
                }
                break;
            }
            ++c;
            p = p.next;
        }while (p)
        this.length -= c;
        return ret;
    }
}
var NotImplemented;
(function(NotImplemented) {
    NotImplemented[NotImplemented["ascii"] = 0] = "ascii";
    NotImplemented[NotImplemented["latin1"] = 1] = "latin1";
    NotImplemented[NotImplemented["utf16le"] = 2] = "utf16le";
})(NotImplemented || (NotImplemented = {}));
function normalizeEncoding1(enc) {
    const encoding = normalizeEncoding(enc ?? null);
    if (encoding && encoding in NotImplemented) notImplemented(encoding);
    if (!encoding && typeof enc === "string" && enc.toLowerCase() !== "raw") {
        throw new Error(`Unknown encoding: ${enc}`);
    }
    return String(encoding);
}
function utf8CheckByte(__byte) {
    if (__byte <= 0x7f) return 0;
    else if (__byte >> 5 === 0x06) return 2;
    else if (__byte >> 4 === 0x0e) return 3;
    else if (__byte >> 3 === 0x1e) return 4;
    return __byte >> 6 === 0x02 ? -1 : -2;
}
function utf8CheckIncomplete(self, buf, i) {
    let j = buf.length - 1;
    if (j < i) return 0;
    let nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
        if (nb > 0) self.lastNeed = nb - 1;
        return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
        if (nb > 0) self.lastNeed = nb - 2;
        return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
        if (nb > 0) {
            if (nb === 2) nb = 0;
            else self.lastNeed = nb - 3;
        }
        return nb;
    }
    return 0;
}
function utf8CheckExtraBytes(self, buf) {
    if ((buf[0] & 0xc0) !== 0x80) {
        self.lastNeed = 0;
        return "\ufffd";
    }
    if (self.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 0xc0) !== 0x80) {
            self.lastNeed = 1;
            return "\ufffd";
        }
        if (self.lastNeed > 2 && buf.length > 2) {
            if ((buf[2] & 0xc0) !== 0x80) {
                self.lastNeed = 2;
                return "\ufffd";
            }
        }
    }
}
function utf8FillLastComplete(buf) {
    const p = this.lastTotal - this.lastNeed;
    const r = utf8CheckExtraBytes(this, buf);
    if (r !== undefined) return r;
    if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, p, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, p, 0, buf.length);
    this.lastNeed -= buf.length;
}
function utf8FillLastIncomplete(buf) {
    if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
    this.lastNeed -= buf.length;
}
function utf8Text(buf, i) {
    const total = utf8CheckIncomplete(this, buf, i);
    if (!this.lastNeed) return buf.toString("utf8", i);
    this.lastTotal = total;
    const end = buf.length - (total - this.lastNeed);
    buf.copy(this.lastChar, 0, end);
    return buf.toString("utf8", i, end);
}
function utf8End(buf) {
    const r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + "\ufffd";
    return r;
}
function utf8Write(buf) {
    if (typeof buf === "string") {
        return buf;
    }
    if (buf.length === 0) return "";
    let r;
    let i;
    if (this.lastNeed) {
        r = this.fillLast(buf);
        if (r === undefined) return "";
        i = this.lastNeed;
        this.lastNeed = 0;
    } else {
        i = 0;
    }
    if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
    return r || "";
}
function base64Text(buf, i) {
    const n = (buf.length - i) % 3;
    if (n === 0) return buf.toString("base64", i);
    this.lastNeed = 3 - n;
    this.lastTotal = 3;
    if (n === 1) {
        this.lastChar[0] = buf[buf.length - 1];
    } else {
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
    }
    return buf.toString("base64", i, buf.length - n);
}
function base64End(buf) {
    const r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) {
        return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
    }
    return r;
}
function simpleWrite(buf) {
    if (typeof buf === "string") {
        return buf;
    }
    return buf.toString(this.encoding);
}
function simpleEnd(buf) {
    return buf && buf.length ? this.write(buf) : "";
}
class StringDecoderBase {
    lastChar;
    lastNeed;
    lastTotal;
    constructor(encoding, nb){
        this.encoding = encoding;
        this.lastNeed = 0;
        this.lastTotal = 0;
        this.lastChar = Buffer.allocUnsafe(nb);
    }
    encoding;
}
class Base64Decoder extends StringDecoderBase {
    end = base64End;
    fillLast = utf8FillLastIncomplete;
    text = base64Text;
    write = utf8Write;
    constructor(encoding){
        super(normalizeEncoding1(encoding), 3);
    }
}
class GenericDecoder extends StringDecoderBase {
    end = simpleEnd;
    fillLast = undefined;
    text = utf8Text;
    write = simpleWrite;
    constructor(encoding){
        super(normalizeEncoding1(encoding), 4);
    }
}
class Utf8Decoder extends StringDecoderBase {
    end = utf8End;
    fillLast = utf8FillLastComplete;
    text = utf8Text;
    write = utf8Write;
    constructor(encoding){
        super(normalizeEncoding1(encoding), 4);
    }
}
class StringDecoder {
    encoding;
    end;
    fillLast;
    lastChar;
    lastNeed;
    lastTotal;
    text;
    write;
    constructor(encoding){
        let decoder;
        switch(encoding){
            case "utf8":
                decoder = new Utf8Decoder(encoding);
                break;
            case "base64":
                decoder = new Base64Decoder(encoding);
                break;
            default:
                decoder = new GenericDecoder(encoding);
        }
        this.encoding = decoder.encoding;
        this.end = decoder.end;
        this.fillLast = decoder.fillLast;
        this.lastChar = decoder.lastChar;
        this.lastNeed = decoder.lastNeed;
        this.lastTotal = decoder.lastTotal;
        this.text = decoder.text;
        this.write = decoder.write;
    }
}
const __default5 = {
    StringDecoder
};
Symbol("kConstruct");
const kDestroy = Symbol("kDestroy");
const kPaused = Symbol("kPaused");
function _destroy(self, err, cb) {
    self._destroy(err || null, (err)=>{
        const r = self._readableState;
        if (err) {
            err.stack;
            if (!r.errored) {
                r.errored = err;
            }
        }
        r.closed = true;
        if (typeof cb === "function") {
            cb(err);
        }
        if (err) {
            queueMicrotask(()=>{
                if (!r.errorEmitted) {
                    r.errorEmitted = true;
                    self.emit("error", err);
                }
                r.closeEmitted = true;
                if (r.emitClose) {
                    self.emit("close");
                }
            });
        } else {
            queueMicrotask(()=>{
                r.closeEmitted = true;
                if (r.emitClose) {
                    self.emit("close");
                }
            });
        }
    });
}
function addChunk(stream, state, chunk, addToFront) {
    if (state.flowing && state.length === 0 && !state.sync) {
        if (state.multiAwaitDrain) {
            state.awaitDrainWriters.clear();
        } else {
            state.awaitDrainWriters = null;
        }
        stream.emit("data", chunk);
    } else {
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront) {
            state.buffer.unshift(chunk);
        } else {
            state.buffer.push(chunk);
        }
        if (state.needReadable) {
            emitReadable(stream);
        }
    }
    maybeReadMore(stream, state);
}
const MAX_HWM = 0x40000000;
function computeNewHighWaterMark(n) {
    if (n >= 0x40000000) {
        n = MAX_HWM;
    } else {
        n--;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        n++;
    }
    return n;
}
function emitReadable(stream) {
    const state = stream._readableState;
    state.needReadable = false;
    if (!state.emittedReadable) {
        state.emittedReadable = true;
        queueMicrotask(()=>emitReadable_(stream));
    }
}
function emitReadable_(stream) {
    const state = stream._readableState;
    if (!state.destroyed && !state.errored && (state.length || state.ended)) {
        stream.emit("readable");
        state.emittedReadable = false;
    }
    state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
    flow(stream);
}
function endReadable(stream) {
    const state = stream._readableState;
    if (!state.endEmitted) {
        state.ended = true;
        queueMicrotask(()=>endReadableNT(state, stream));
    }
}
function endReadableNT(state, stream) {
    if (!state.errorEmitted && !state.closeEmitted && !state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.emit("end");
        if (state.autoDestroy) {
            stream.destroy();
        }
    }
}
function errorOrDestroy(stream, err, sync = false) {
    const r = stream._readableState;
    if (r.destroyed) {
        return stream;
    }
    if (r.autoDestroy) {
        stream.destroy(err);
    } else if (err) {
        err.stack;
        if (!r.errored) {
            r.errored = err;
        }
        if (sync) {
            queueMicrotask(()=>{
                if (!r.errorEmitted) {
                    r.errorEmitted = true;
                    stream.emit("error", err);
                }
            });
        } else if (!r.errorEmitted) {
            r.errorEmitted = true;
            stream.emit("error", err);
        }
    }
}
function flow(stream) {
    const state = stream._readableState;
    while(state.flowing && stream.read() !== null);
}
function fromList(n, state) {
    if (state.length === 0) {
        return null;
    }
    let ret;
    if (state.objectMode) {
        ret = state.buffer.shift();
    } else if (!n || n >= state.length) {
        if (state.decoder) {
            ret = state.buffer.join("");
        } else if (state.buffer.length === 1) {
            ret = state.buffer.first();
        } else {
            ret = state.buffer.concat(state.length);
        }
        state.buffer.clear();
    } else {
        ret = state.buffer.consume(n, !!state.decoder);
    }
    return ret;
}
function howMuchToRead(n, state) {
    if (n <= 0 || state.length === 0 && state.ended) {
        return 0;
    }
    if (state.objectMode) {
        return 1;
    }
    if (Number.isNaN(n)) {
        if (state.flowing && state.length) {
            return state.buffer.first().length;
        }
        return state.length;
    }
    if (n <= state.length) {
        return n;
    }
    return state.ended ? state.length : 0;
}
function maybeReadMore(stream, state) {
    if (!state.readingMore && state.constructed) {
        state.readingMore = true;
        queueMicrotask(()=>maybeReadMore_(stream, state));
    }
}
function maybeReadMore_(stream, state) {
    while(!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)){
        const len = state.length;
        stream.read(0);
        if (len === state.length) {
            break;
        }
    }
    state.readingMore = false;
}
function nReadingNextTick(self) {
    self.read(0);
}
function onEofChunk(stream, state) {
    if (state.ended) return;
    if (state.decoder) {
        const chunk = state.decoder.end();
        if (chunk && chunk.length) {
            state.buffer.push(chunk);
            state.length += state.objectMode ? 1 : chunk.length;
        }
    }
    state.ended = true;
    if (state.sync) {
        emitReadable(stream);
    } else {
        state.needReadable = false;
        state.emittedReadable = true;
        emitReadable_(stream);
    }
}
function pipeOnDrain(src, dest) {
    return function pipeOnDrainFunctionResult() {
        const state = src._readableState;
        if (state.awaitDrainWriters === dest) {
            state.awaitDrainWriters = null;
        } else if (state.multiAwaitDrain) {
            state.awaitDrainWriters.delete(dest);
        }
        if ((!state.awaitDrainWriters || state.awaitDrainWriters.size === 0) && src.listenerCount("data")) {
            state.flowing = true;
            flow(src);
        }
    };
}
function prependListener(emitter, event, fn) {
    if (typeof emitter.prependListener === "function") {
        return emitter.prependListener(event, fn);
    }
    if (emitter._events.get(event)?.length) {
        const listeners = [
            fn,
            ...emitter._events.get(event)
        ];
        emitter._events.set(event, listeners);
    } else {
        emitter.on(event, fn);
    }
}
function readableAddChunk(stream, chunk, encoding = undefined, addToFront) {
    const state = stream._readableState;
    let usedEncoding = encoding;
    let err;
    if (!state.objectMode) {
        if (typeof chunk === "string") {
            usedEncoding = encoding || state.defaultEncoding;
            if (state.encoding !== usedEncoding) {
                if (addToFront && state.encoding) {
                    chunk = Buffer.from(chunk, usedEncoding).toString(state.encoding);
                } else {
                    chunk = Buffer.from(chunk, usedEncoding);
                    usedEncoding = "";
                }
            }
        } else if (chunk instanceof Uint8Array) {
            chunk = Buffer.from(chunk);
        }
    }
    if (err) {
        errorOrDestroy(stream, err);
    } else if (chunk === null) {
        state.reading = false;
        onEofChunk(stream, state);
    } else if (state.objectMode || chunk.length > 0) {
        if (addToFront) {
            if (state.endEmitted) {
                errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());
            } else {
                addChunk(stream, state, chunk, true);
            }
        } else if (state.ended) {
            errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF());
        } else if (state.destroyed || state.errored) {
            return false;
        } else {
            state.reading = false;
            if (state.decoder && !usedEncoding) {
                chunk = state.decoder.write(Buffer.from(chunk));
                if (state.objectMode || chunk.length !== 0) {
                    addChunk(stream, state, chunk, false);
                } else {
                    maybeReadMore(stream, state);
                }
            } else {
                addChunk(stream, state, chunk, false);
            }
        }
    } else if (!addToFront) {
        state.reading = false;
        maybeReadMore(stream, state);
    }
    return !state.ended && (state.length < state.highWaterMark || state.length === 0);
}
function resume(stream, state) {
    if (!state.resumeScheduled) {
        state.resumeScheduled = true;
        queueMicrotask(()=>resume_(stream, state));
    }
}
function resume_(stream, state) {
    if (!state.reading) {
        stream.read(0);
    }
    state.resumeScheduled = false;
    stream.emit("resume");
    flow(stream);
    if (state.flowing && !state.reading) {
        stream.read(0);
    }
}
function updateReadableListening(self) {
    const state = self._readableState;
    state.readableListening = self.listenerCount("readable") > 0;
    if (state.resumeScheduled && state[kPaused] === false) {
        state.flowing = true;
    } else if (self.listenerCount("data") > 0) {
        self.resume();
    } else if (!state.readableListening) {
        state.flowing = null;
    }
}
const kOnFinished = Symbol("kOnFinished");
function _destroy1(self, err, cb) {
    self._destroy(err || null, (err)=>{
        const w = self._writableState;
        if (err) {
            err.stack;
            if (!w.errored) {
                w.errored = err;
            }
        }
        w.closed = true;
        if (typeof cb === "function") {
            cb(err);
        }
        if (err) {
            queueMicrotask(()=>{
                if (!w.errorEmitted) {
                    w.errorEmitted = true;
                    self.emit("error", err);
                }
                w.closeEmitted = true;
                if (w.emitClose) {
                    self.emit("close");
                }
            });
        } else {
            queueMicrotask(()=>{
                w.closeEmitted = true;
                if (w.emitClose) {
                    self.emit("close");
                }
            });
        }
    });
}
function afterWrite(stream, state, count, cb) {
    const needDrain = !state.ending && !stream.destroyed && state.length === 0 && state.needDrain;
    if (needDrain) {
        state.needDrain = false;
        stream.emit("drain");
    }
    while(count-- > 0){
        state.pendingcb--;
        cb();
    }
    if (state.destroyed) {
        errorBuffer(state);
    }
    finishMaybe(stream, state);
}
function afterWriteTick({ cb , count , state , stream  }) {
    state.afterWriteTickInfo = null;
    return afterWrite(stream, state, count, cb);
}
function clearBuffer(stream, state) {
    if (state.corked || state.bufferProcessing || state.destroyed || !state.constructed) {
        return;
    }
    const { buffered , bufferedIndex , objectMode  } = state;
    const bufferedLength = buffered.length - bufferedIndex;
    if (!bufferedLength) {
        return;
    }
    const i = bufferedIndex;
    state.bufferProcessing = true;
    if (bufferedLength > 1 && stream._writev) {
        state.pendingcb -= bufferedLength - 1;
        const callback = state.allNoop ? nop1 : (err)=>{
            for(let n = i; n < buffered.length; ++n){
                buffered[n].callback(err);
            }
        };
        const chunks = state.allNoop && i === 0 ? buffered : buffered.slice(i);
        doWrite(stream, state, true, state.length, chunks, "", callback);
        resetBuffer(state);
    } else {
        do {
            const { chunk , encoding , callback: callback1  } = buffered[i];
            const len = objectMode ? 1 : chunk.length;
            doWrite(stream, state, false, len, chunk, encoding, callback1);
        }while (i < buffered.length && !state.writing)
        if (i === buffered.length) {
            resetBuffer(state);
        } else if (i > 256) {
            buffered.splice(0, i);
            state.bufferedIndex = 0;
        } else {
            state.bufferedIndex = i;
        }
    }
    state.bufferProcessing = false;
}
function destroy(err, cb) {
    const w = this._writableState;
    if (w.destroyed) {
        if (typeof cb === "function") {
            cb();
        }
        return this;
    }
    if (err) {
        err.stack;
        if (!w.errored) {
            w.errored = err;
        }
    }
    w.destroyed = true;
    if (!w.constructed) {
        this.once(kDestroy, (er)=>{
            _destroy1(this, err || er, cb);
        });
    } else {
        _destroy1(this, err, cb);
    }
    return this;
}
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    if (state.destroyed) {
        state.onwrite(new ERR_STREAM_DESTROYED("write"));
    } else if (writev) {
        stream._writev(chunk, state.onwrite);
    } else {
        stream._write(chunk, encoding, state.onwrite);
    }
    state.sync = false;
}
function errorBuffer(state) {
    if (state.writing) {
        return;
    }
    for(let n = state.bufferedIndex; n < state.buffered.length; ++n){
        const { chunk , callback  } = state.buffered[n];
        const len = state.objectMode ? 1 : chunk.length;
        state.length -= len;
        callback(new ERR_STREAM_DESTROYED("write"));
    }
    for (const callback1 of state[kOnFinished].splice(0)){
        callback1(new ERR_STREAM_DESTROYED("end"));
    }
    resetBuffer(state);
}
function errorOrDestroy1(stream, err, sync = false) {
    const w = stream._writableState;
    if (w.destroyed) {
        return stream;
    }
    if (w.autoDestroy) {
        stream.destroy(err);
    } else if (err) {
        err.stack;
        if (!w.errored) {
            w.errored = err;
        }
        if (sync) {
            queueMicrotask(()=>{
                if (w.errorEmitted) {
                    return;
                }
                w.errorEmitted = true;
                stream.emit("error", err);
            });
        } else {
            if (w.errorEmitted) {
                return;
            }
            w.errorEmitted = true;
            stream.emit("error", err);
        }
    }
}
function finish(stream, state) {
    state.pendingcb--;
    if (state.errorEmitted || state.closeEmitted) {
        return;
    }
    state.finished = true;
    for (const callback of state[kOnFinished].splice(0)){
        callback();
    }
    stream.emit("finish");
    if (state.autoDestroy) {
        stream.destroy();
    }
}
function finishMaybe(stream, state, sync) {
    if (needFinish(state)) {
        prefinish(stream, state);
        if (state.pendingcb === 0 && needFinish(state)) {
            state.pendingcb++;
            if (sync) {
                queueMicrotask(()=>finish(stream, state));
            } else {
                finish(stream, state);
            }
        }
    }
}
function needFinish(state) {
    return state.ending && state.constructed && state.length === 0 && !state.errored && state.buffered.length === 0 && !state.finished && !state.writing;
}
function nop1() {}
function resetBuffer(state) {
    state.buffered = [];
    state.bufferedIndex = 0;
    state.allBuffers = true;
    state.allNoop = true;
}
function onwriteError(stream, state, er, cb) {
    --state.pendingcb;
    cb(er);
    errorBuffer(state);
    errorOrDestroy1(stream, er);
}
function onwrite(stream, er) {
    const state = stream._writableState;
    const sync = state.sync;
    const cb = state.writecb;
    if (typeof cb !== "function") {
        errorOrDestroy1(stream, new ERR_MULTIPLE_CALLBACK());
        return;
    }
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
    if (er) {
        er.stack;
        if (!state.errored) {
            state.errored = er;
        }
        if (sync) {
            queueMicrotask(()=>onwriteError(stream, state, er, cb));
        } else {
            onwriteError(stream, state, er, cb);
        }
    } else {
        if (state.buffered.length > state.bufferedIndex) {
            clearBuffer(stream, state);
        }
        if (sync) {
            if (state.afterWriteTickInfo !== null && state.afterWriteTickInfo.cb === cb) {
                state.afterWriteTickInfo.count++;
            } else {
                state.afterWriteTickInfo = {
                    count: 1,
                    cb: cb,
                    stream,
                    state
                };
                queueMicrotask(()=>afterWriteTick(state.afterWriteTickInfo));
            }
        } else {
            afterWrite(stream, state, 1, cb);
        }
    }
}
function prefinish(stream, state) {
    if (!state.prefinished && !state.finalCalled) {
        if (typeof stream._final === "function" && !state.destroyed) {
            state.finalCalled = true;
            state.sync = true;
            state.pendingcb++;
            stream._final((err)=>{
                state.pendingcb--;
                if (err) {
                    for (const callback of state[kOnFinished].splice(0)){
                        callback(err);
                    }
                    errorOrDestroy1(stream, err, state.sync);
                } else if (needFinish(state)) {
                    state.prefinished = true;
                    stream.emit("prefinish");
                    state.pendingcb++;
                    queueMicrotask(()=>finish(stream, state));
                }
            });
            state.sync = false;
        } else {
            state.prefinished = true;
            stream.emit("prefinish");
        }
    }
}
function writeOrBuffer(stream, state, chunk, encoding, callback) {
    const len = state.objectMode ? 1 : chunk.length;
    state.length += len;
    if (state.writing || state.corked || state.errored || !state.constructed) {
        state.buffered.push({
            chunk,
            encoding,
            callback
        });
        if (state.allBuffers && encoding !== "buffer") {
            state.allBuffers = false;
        }
        if (state.allNoop && callback !== nop1) {
            state.allNoop = false;
        }
    } else {
        state.writelen = len;
        state.writecb = callback;
        state.writing = true;
        state.sync = true;
        stream._write(chunk, encoding, state.onwrite);
        state.sync = false;
    }
    const ret = state.length < state.highWaterMark;
    if (!ret) {
        state.needDrain = true;
    }
    return ret && !state.errored && !state.destroyed;
}
class WritableState {
    [kOnFinished] = [];
    afterWriteTickInfo = null;
    allBuffers = true;
    allNoop = true;
    autoDestroy;
    buffered = [];
    bufferedIndex = 0;
    bufferProcessing = false;
    closed = false;
    closeEmitted = false;
    constructed;
    corked = 0;
    decodeStrings;
    defaultEncoding;
    destroyed = false;
    emitClose;
    ended = false;
    ending = false;
    errored = null;
    errorEmitted = false;
    finalCalled = false;
    finished = false;
    highWaterMark;
    length = 0;
    needDrain = false;
    objectMode;
    onwrite;
    pendingcb = 0;
    prefinished = false;
    sync = true;
    writecb = null;
    writable = true;
    writelen = 0;
    writing = false;
    constructor(options, stream){
        this.objectMode = !!options?.objectMode;
        this.highWaterMark = options?.highWaterMark ?? (this.objectMode ? 16 : 16 * 1024);
        if (Number.isInteger(this.highWaterMark) && this.highWaterMark >= 0) {
            this.highWaterMark = Math.floor(this.highWaterMark);
        } else {
            throw new ERR_INVALID_OPT_VALUE("highWaterMark", this.highWaterMark);
        }
        this.decodeStrings = !options?.decodeStrings === false;
        this.defaultEncoding = options?.defaultEncoding || "utf8";
        this.onwrite = onwrite.bind(undefined, stream);
        resetBuffer(this);
        this.emitClose = options?.emitClose ?? true;
        this.autoDestroy = options?.autoDestroy ?? true;
        this.constructed = true;
    }
    getBuffer() {
        return this.buffered.slice(this.bufferedIndex);
    }
    get bufferedRequestCount() {
        return this.buffered.length - this.bufferedIndex;
    }
}
class Writable extends Stream {
    _final;
    _writableState;
    _writev = null;
    constructor(options){
        super();
        this._writableState = new WritableState(options, this);
        if (options) {
            if (typeof options.write === "function") {
                this._write = options.write;
            }
            if (typeof options.writev === "function") {
                this._writev = options.writev;
            }
            if (typeof options.destroy === "function") {
                this._destroy = options.destroy;
            }
            if (typeof options.final === "function") {
                this._final = options.final;
            }
        }
    }
    [captureRejectionSymbol](err) {
        this.destroy(err);
    }
    static WritableState = WritableState;
    get destroyed() {
        return this._writableState ? this._writableState.destroyed : false;
    }
    set destroyed(value) {
        if (this._writableState) {
            this._writableState.destroyed = value;
        }
    }
    get writable() {
        const w = this._writableState;
        return !w.destroyed && !w.errored && !w.ending && !w.ended;
    }
    set writable(val) {
        if (this._writableState) {
            this._writableState.writable = !!val;
        }
    }
    get writableFinished() {
        return this._writableState ? this._writableState.finished : false;
    }
    get writableObjectMode() {
        return this._writableState ? this._writableState.objectMode : false;
    }
    get writableBuffer() {
        return this._writableState && this._writableState.getBuffer();
    }
    get writableEnded() {
        return this._writableState ? this._writableState.ending : false;
    }
    get writableHighWaterMark() {
        return this._writableState && this._writableState.highWaterMark;
    }
    get writableCorked() {
        return this._writableState ? this._writableState.corked : 0;
    }
    get writableLength() {
        return this._writableState && this._writableState.length;
    }
    _undestroy() {
        const w = this._writableState;
        w.constructed = true;
        w.destroyed = false;
        w.closed = false;
        w.closeEmitted = false;
        w.errored = null;
        w.errorEmitted = false;
        w.ended = false;
        w.ending = false;
        w.finalCalled = false;
        w.prefinished = false;
        w.finished = false;
    }
    _destroy(err, cb) {
        cb(err);
    }
    destroy(err, cb) {
        const state = this._writableState;
        if (!state.destroyed) {
            queueMicrotask(()=>errorBuffer(state));
        }
        destroy.call(this, err, cb);
        return this;
    }
    end(x, y, z) {
        const state = this._writableState;
        let chunk;
        let encoding;
        let cb;
        if (typeof x === "function") {
            chunk = null;
            encoding = null;
            cb = x;
        } else if (typeof y === "function") {
            chunk = x;
            encoding = null;
            cb = y;
        } else {
            chunk = x;
            encoding = y;
            cb = z;
        }
        if (chunk !== null && chunk !== undefined) {
            this.write(chunk, encoding);
        }
        if (state.corked) {
            state.corked = 1;
            this.uncork();
        }
        let err;
        if (!state.errored && !state.ending) {
            state.ending = true;
            finishMaybe(this, state, true);
            state.ended = true;
        } else if (state.finished) {
            err = new ERR_STREAM_ALREADY_FINISHED("end");
        } else if (state.destroyed) {
            err = new ERR_STREAM_DESTROYED("end");
        }
        if (typeof cb === "function") {
            if (err || state.finished) {
                queueMicrotask(()=>{
                    cb(err);
                });
            } else {
                state[kOnFinished].push(cb);
            }
        }
        return this;
    }
    _write(chunk, encoding, cb) {
        if (this._writev) {
            this._writev([
                {
                    chunk,
                    encoding
                }
            ], cb);
        } else {
            throw new ERR_METHOD_NOT_IMPLEMENTED("_write()");
        }
    }
    pipe(dest) {
        errorOrDestroy1(this, new ERR_STREAM_CANNOT_PIPE());
        return dest;
    }
    write(chunk, x, y) {
        const state = this._writableState;
        let encoding;
        let cb;
        if (typeof x === "function") {
            cb = x;
            encoding = state.defaultEncoding;
        } else {
            if (!x) {
                encoding = state.defaultEncoding;
            } else if (x !== "buffer" && !Buffer.isEncoding(x)) {
                throw new ERR_UNKNOWN_ENCODING(x);
            } else {
                encoding = x;
            }
            if (typeof y !== "function") {
                cb = nop1;
            } else {
                cb = y;
            }
        }
        if (chunk === null) {
            throw new ERR_STREAM_NULL_VALUES();
        } else if (!state.objectMode) {
            if (typeof chunk === "string") {
                if (state.decodeStrings !== false) {
                    chunk = Buffer.from(chunk, encoding);
                    encoding = "buffer";
                }
            } else if (chunk instanceof Buffer) {
                encoding = "buffer";
            } else if (Stream._isUint8Array(chunk)) {
                chunk = Stream._uint8ArrayToBuffer(chunk);
                encoding = "buffer";
            } else {
                throw new ERR_INVALID_ARG_TYPE("chunk", [
                    "string",
                    "Buffer",
                    "Uint8Array"
                ], chunk);
            }
        }
        let err;
        if (state.ending) {
            err = new ERR_STREAM_WRITE_AFTER_END();
        } else if (state.destroyed) {
            err = new ERR_STREAM_DESTROYED("write");
        }
        if (err) {
            queueMicrotask(()=>cb(err));
            errorOrDestroy1(this, err, true);
            return false;
        }
        state.pendingcb++;
        return writeOrBuffer(this, state, chunk, encoding, cb);
    }
    cork() {
        this._writableState.corked++;
    }
    uncork() {
        const state = this._writableState;
        if (state.corked) {
            state.corked--;
            if (!state.writing) {
                clearBuffer(this, state);
            }
        }
    }
    setDefaultEncoding(encoding) {
        if (typeof encoding === "string") {
            encoding = encoding.toLowerCase();
        }
        if (!Buffer.isEncoding(encoding)) {
            throw new ERR_UNKNOWN_ENCODING(encoding);
        }
        this._writableState.defaultEncoding = encoding;
        return this;
    }
}
function endDuplex(stream) {
    const state = stream._readableState;
    if (!state.endEmitted) {
        state.ended = true;
        queueMicrotask(()=>endReadableNT1(state, stream));
    }
}
function endReadableNT1(state, stream) {
    if (!state.errorEmitted && !state.closeEmitted && !state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.emit("end");
        if (stream.writable && stream.allowHalfOpen === false) {
            queueMicrotask(()=>endWritableNT(state, stream));
        } else if (state.autoDestroy) {
            const wState = stream._writableState;
            const autoDestroy = !wState || wState.autoDestroy && (wState.finished || wState.writable === false);
            if (autoDestroy) {
                stream.destroy();
            }
        }
    }
}
function endWritableNT(_state, stream) {
    const writable = stream.writable && !stream.writableEnded && !stream.destroyed;
    if (writable) {
        stream.end();
    }
}
function errorOrDestroy2(stream, err, sync = false) {
    const r = stream._readableState;
    const w = stream._writableState;
    if (w.destroyed || r.destroyed) {
        return this;
    }
    if (r.autoDestroy || w.autoDestroy) {
        stream.destroy(err);
    } else if (err) {
        err.stack;
        if (w && !w.errored) {
            w.errored = err;
        }
        if (r && !r.errored) {
            r.errored = err;
        }
        if (sync) {
            queueMicrotask(()=>{
                if (w.errorEmitted || r.errorEmitted) {
                    return;
                }
                w.errorEmitted = true;
                r.errorEmitted = true;
                stream.emit("error", err);
            });
        } else {
            if (w.errorEmitted || r.errorEmitted) {
                return;
            }
            w.errorEmitted = true;
            r.errorEmitted = true;
            stream.emit("error", err);
        }
    }
}
function finish1(stream, state) {
    state.pendingcb--;
    if (state.errorEmitted || state.closeEmitted) {
        return;
    }
    state.finished = true;
    for (const callback of state[kOnFinished].splice(0)){
        callback();
    }
    stream.emit("finish");
    if (state.autoDestroy) {
        stream.destroy();
    }
}
function finishMaybe1(stream, state, sync) {
    if (needFinish(state)) {
        prefinish(stream, state);
        if (state.pendingcb === 0 && needFinish(state)) {
            state.pendingcb++;
            if (sync) {
                queueMicrotask(()=>finish1(stream, state));
            } else {
                finish1(stream, state);
            }
        }
    }
}
function onwrite1(stream, er) {
    const state = stream._writableState;
    const sync = state.sync;
    const cb = state.writecb;
    if (typeof cb !== "function") {
        errorOrDestroy2(stream, new ERR_MULTIPLE_CALLBACK());
        return;
    }
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
    if (er) {
        er.stack;
        if (!state.errored) {
            state.errored = er;
        }
        if (stream._readableState && !stream._readableState.errored) {
            stream._readableState.errored = er;
        }
        if (sync) {
            queueMicrotask(()=>onwriteError1(stream, state, er, cb));
        } else {
            onwriteError1(stream, state, er, cb);
        }
    } else {
        if (state.buffered.length > state.bufferedIndex) {
            clearBuffer(stream, state);
        }
        if (sync) {
            if (state.afterWriteTickInfo !== null && state.afterWriteTickInfo.cb === cb) {
                state.afterWriteTickInfo.count++;
            } else {
                state.afterWriteTickInfo = {
                    count: 1,
                    cb: cb,
                    stream: stream,
                    state
                };
                queueMicrotask(()=>afterWriteTick(state.afterWriteTickInfo));
            }
        } else {
            afterWrite(stream, state, 1, cb);
        }
    }
}
function onwriteError1(stream, state, er, cb) {
    --state.pendingcb;
    cb(er);
    errorBuffer(state);
    errorOrDestroy2(stream, er);
}
function readableAddChunk1(stream, chunk, encoding = undefined, addToFront) {
    const state = stream._readableState;
    let usedEncoding = encoding;
    let err;
    if (!state.objectMode) {
        if (typeof chunk === "string") {
            usedEncoding = encoding || state.defaultEncoding;
            if (state.encoding !== usedEncoding) {
                if (addToFront && state.encoding) {
                    chunk = Buffer.from(chunk, usedEncoding).toString(state.encoding);
                } else {
                    chunk = Buffer.from(chunk, usedEncoding);
                    usedEncoding = "";
                }
            }
        } else if (chunk instanceof Uint8Array) {
            chunk = Buffer.from(chunk);
        }
    }
    if (err) {
        errorOrDestroy2(stream, err);
    } else if (chunk === null) {
        state.reading = false;
        onEofChunk(stream, state);
    } else if (state.objectMode || chunk.length > 0) {
        if (addToFront) {
            if (state.endEmitted) {
                errorOrDestroy2(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());
            } else {
                addChunk(stream, state, chunk, true);
            }
        } else if (state.ended) {
            errorOrDestroy2(stream, new ERR_STREAM_PUSH_AFTER_EOF());
        } else if (state.destroyed || state.errored) {
            return false;
        } else {
            state.reading = false;
            if (state.decoder && !usedEncoding) {
                chunk = state.decoder.write(Buffer.from(chunk));
                if (state.objectMode || chunk.length !== 0) {
                    addChunk(stream, state, chunk, false);
                } else {
                    maybeReadMore(stream, state);
                }
            } else {
                addChunk(stream, state, chunk, false);
            }
        }
    } else if (!addToFront) {
        state.reading = false;
        maybeReadMore(stream, state);
    }
    return !state.ended && (state.length < state.highWaterMark || state.length === 0);
}
class ReadableState {
    [kPaused] = null;
    awaitDrainWriters = null;
    buffer = new BufferList();
    closed = false;
    closeEmitted = false;
    constructed;
    decoder = null;
    destroyed = false;
    emittedReadable = false;
    encoding = null;
    ended = false;
    endEmitted = false;
    errored = null;
    errorEmitted = false;
    flowing = null;
    highWaterMark;
    length = 0;
    multiAwaitDrain = false;
    needReadable = false;
    objectMode;
    pipes = [];
    readable = true;
    readableListening = false;
    reading = false;
    readingMore = false;
    resumeScheduled = false;
    sync = true;
    emitClose;
    autoDestroy;
    defaultEncoding;
    constructor(options){
        this.objectMode = !!options?.objectMode;
        this.highWaterMark = options?.highWaterMark ?? (this.objectMode ? 16 : 16 * 1024);
        if (Number.isInteger(this.highWaterMark) && this.highWaterMark >= 0) {
            this.highWaterMark = Math.floor(this.highWaterMark);
        } else {
            throw new ERR_INVALID_OPT_VALUE("highWaterMark", this.highWaterMark);
        }
        this.emitClose = options?.emitClose ?? true;
        this.autoDestroy = options?.autoDestroy ?? true;
        this.defaultEncoding = options?.defaultEncoding || "utf8";
        if (options?.encoding) {
            this.decoder = new StringDecoder(options.encoding);
            this.encoding = options.encoding;
        }
        this.constructed = true;
    }
}
const kLastResolve = Symbol("lastResolve");
function from(iterable, opts) {
    let iterator;
    if (typeof iterable === "string" || iterable instanceof Buffer) {
        return new Readable({
            objectMode: true,
            ...opts,
            read () {
                this.push(iterable);
                this.push(null);
            }
        });
    }
    if (Symbol.asyncIterator in iterable) {
        iterator = iterable[Symbol.asyncIterator]();
    } else if (Symbol.iterator in iterable) {
        iterator = iterable[Symbol.iterator]();
    } else {
        throw new ERR_INVALID_ARG_TYPE("iterable", [
            "Iterable"
        ], iterable);
    }
    const readable = new Readable({
        objectMode: true,
        highWaterMark: 1,
        ...opts
    });
    let reading = false;
    let needToClose = false;
    readable._read = function() {
        if (!reading) {
            reading = true;
            next();
        }
    };
    readable._destroy = function(error, cb) {
        if (needToClose) {
            needToClose = false;
            close().then(()=>queueMicrotask(()=>cb(error)), (e)=>queueMicrotask(()=>cb(error || e)));
        } else {
            cb(error);
        }
    };
    async function close() {
        if (typeof iterator.return === "function") {
            const { value  } = await iterator.return();
            await value;
        }
    }
    async function next() {
        try {
            needToClose = false;
            const { value , done  } = await iterator.next();
            needToClose = !done;
            if (done) {
                readable.push(null);
            } else if (readable.destroyed) {
                await close();
            } else {
                const res = await value;
                if (res === null) {
                    reading = false;
                    throw new ERR_STREAM_NULL_VALUES();
                } else if (readable.push(res)) {
                    next();
                } else {
                    reading = false;
                }
            }
        } catch (err) {
            readable.destroy(err);
        }
    }
    return readable;
}
class Readable extends Stream {
    _readableState;
    constructor(options){
        super();
        if (options) {
            if (typeof options.read === "function") {
                this._read = options.read;
            }
            if (typeof options.destroy === "function") {
                this._destroy = options.destroy;
            }
        }
        this._readableState = new ReadableState(options);
    }
    static from(iterable, opts) {
        return from(iterable, opts);
    }
    static ReadableState = ReadableState;
    static _fromList = fromList;
    read(n) {
        if (n === undefined) {
            n = NaN;
        }
        const state = this._readableState;
        const nOrig = n;
        if (n > state.highWaterMark) {
            state.highWaterMark = computeNewHighWaterMark(n);
        }
        if (n !== 0) {
            state.emittedReadable = false;
        }
        if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
            if (state.length === 0 && state.ended) {
                endReadable(this);
            } else {
                emitReadable(this);
            }
            return null;
        }
        n = howMuchToRead(n, state);
        if (n === 0 && state.ended) {
            if (state.length === 0) {
                endReadable(this);
            }
            return null;
        }
        let doRead = state.needReadable;
        if (state.length === 0 || state.length - n < state.highWaterMark) {
            doRead = true;
        }
        if (state.ended || state.reading || state.destroyed || state.errored || !state.constructed) {
            doRead = false;
        } else if (doRead) {
            state.reading = true;
            state.sync = true;
            if (state.length === 0) {
                state.needReadable = true;
            }
            this._read();
            state.sync = false;
            if (!state.reading) {
                n = howMuchToRead(nOrig, state);
            }
        }
        let ret;
        if (n > 0) {
            ret = fromList(n, state);
        } else {
            ret = null;
        }
        if (ret === null) {
            state.needReadable = state.length <= state.highWaterMark;
            n = 0;
        } else {
            state.length -= n;
            if (state.multiAwaitDrain) {
                state.awaitDrainWriters.clear();
            } else {
                state.awaitDrainWriters = null;
            }
        }
        if (state.length === 0) {
            if (!state.ended) {
                state.needReadable = true;
            }
            if (nOrig !== n && state.ended) {
                endReadable(this);
            }
        }
        if (ret !== null) {
            this.emit("data", ret);
        }
        return ret;
    }
    _read(_size) {
        throw new ERR_METHOD_NOT_IMPLEMENTED("_read()");
    }
    pipe(dest, pipeOpts) {
        const src = this;
        const state = this._readableState;
        if (state.pipes.length === 1) {
            if (!state.multiAwaitDrain) {
                state.multiAwaitDrain = true;
                state.awaitDrainWriters = new Set(state.awaitDrainWriters ? [
                    state.awaitDrainWriters
                ] : []);
            }
        }
        state.pipes.push(dest);
        const doEnd = !pipeOpts || pipeOpts.end !== false;
        const endFn = doEnd ? onend : unpipe;
        if (state.endEmitted) {
            queueMicrotask(endFn);
        } else {
            this.once("end", endFn);
        }
        dest.on("unpipe", onunpipe);
        function onunpipe(readable, unpipeInfo) {
            if (readable === src) {
                if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
                    unpipeInfo.hasUnpiped = true;
                    cleanup();
                }
            }
        }
        function onend() {
            dest.end();
        }
        let ondrain;
        let cleanedUp = false;
        function cleanup() {
            dest.removeListener("close", onclose);
            dest.removeListener("finish", onfinish);
            if (ondrain) {
                dest.removeListener("drain", ondrain);
            }
            dest.removeListener("error", onerror);
            dest.removeListener("unpipe", onunpipe);
            src.removeListener("end", onend);
            src.removeListener("end", unpipe);
            src.removeListener("data", ondata);
            cleanedUp = true;
            if (ondrain && state.awaitDrainWriters && (!dest._writableState || dest._writableState.needDrain)) {
                ondrain();
            }
        }
        this.on("data", ondata);
        function ondata(chunk) {
            const ret = dest.write(chunk);
            if (ret === false) {
                if (!cleanedUp) {
                    if (state.pipes.length === 1 && state.pipes[0] === dest) {
                        state.awaitDrainWriters = dest;
                        state.multiAwaitDrain = false;
                    } else if (state.pipes.length > 1 && state.pipes.includes(dest)) {
                        state.awaitDrainWriters.add(dest);
                    }
                    src.pause();
                }
                if (!ondrain) {
                    ondrain = pipeOnDrain(src, dest);
                    dest.on("drain", ondrain);
                }
            }
        }
        function onerror(er) {
            unpipe();
            dest.removeListener("error", onerror);
            if (dest.listenerCount("error") === 0) {
                const s = dest._writableState || dest._readableState;
                if (s && !s.errorEmitted) {
                    if (dest instanceof Duplex) {
                        errorOrDestroy2(dest, er);
                    } else {
                        errorOrDestroy1(dest, er);
                    }
                } else {
                    dest.emit("error", er);
                }
            }
        }
        prependListener(dest, "error", onerror);
        function onclose() {
            dest.removeListener("finish", onfinish);
            unpipe();
        }
        dest.once("close", onclose);
        function onfinish() {
            dest.removeListener("close", onclose);
            unpipe();
        }
        dest.once("finish", onfinish);
        function unpipe() {
            src.unpipe(dest);
        }
        dest.emit("pipe", this);
        if (!state.flowing) {
            this.resume();
        }
        return dest;
    }
    isPaused() {
        return this._readableState[kPaused] === true || this._readableState.flowing === false;
    }
    setEncoding(enc) {
        const decoder = new StringDecoder(enc);
        this._readableState.decoder = decoder;
        this._readableState.encoding = this._readableState.decoder.encoding;
        const buffer = this._readableState.buffer;
        let content = "";
        for (const data of buffer){
            content += decoder.write(data);
        }
        buffer.clear();
        if (content !== "") {
            buffer.push(content);
        }
        this._readableState.length = content.length;
        return this;
    }
    on(ev, fn) {
        const res = super.on.call(this, ev, fn);
        const state = this._readableState;
        if (ev === "data") {
            state.readableListening = this.listenerCount("readable") > 0;
            if (state.flowing !== false) {
                this.resume();
            }
        } else if (ev === "readable") {
            if (!state.endEmitted && !state.readableListening) {
                state.readableListening = state.needReadable = true;
                state.flowing = false;
                state.emittedReadable = false;
                if (state.length) {
                    emitReadable(this);
                } else if (!state.reading) {
                    queueMicrotask(()=>nReadingNextTick(this));
                }
            }
        }
        return res;
    }
    removeListener(ev, fn) {
        const res = super.removeListener.call(this, ev, fn);
        if (ev === "readable") {
            queueMicrotask(()=>updateReadableListening(this));
        }
        return res;
    }
    off = this.removeListener;
    destroy(err, cb) {
        const r = this._readableState;
        if (r.destroyed) {
            if (typeof cb === "function") {
                cb();
            }
            return this;
        }
        if (err) {
            err.stack;
            if (!r.errored) {
                r.errored = err;
            }
        }
        r.destroyed = true;
        if (!r.constructed) {
            this.once(kDestroy, (er)=>{
                _destroy(this, err || er, cb);
            });
        } else {
            _destroy(this, err, cb);
        }
        return this;
    }
    _undestroy() {
        const r = this._readableState;
        r.constructed = true;
        r.closed = false;
        r.closeEmitted = false;
        r.destroyed = false;
        r.errored = null;
        r.errorEmitted = false;
        r.reading = false;
        r.ended = false;
        r.endEmitted = false;
    }
    _destroy(error, callback) {
        callback(error);
    }
    [captureRejectionSymbol](err) {
        this.destroy(err);
    }
    push(chunk, encoding) {
        return readableAddChunk(this, chunk, encoding, false);
    }
    unshift(chunk, encoding) {
        return readableAddChunk(this, chunk, encoding, true);
    }
    unpipe(dest) {
        const state = this._readableState;
        const unpipeInfo = {
            hasUnpiped: false
        };
        if (state.pipes.length === 0) {
            return this;
        }
        if (!dest) {
            const dests = state.pipes;
            state.pipes = [];
            this.pause();
            for (const dest1 of dests){
                dest1.emit("unpipe", this, {
                    hasUnpiped: false
                });
            }
            return this;
        }
        const index = state.pipes.indexOf(dest);
        if (index === -1) {
            return this;
        }
        state.pipes.splice(index, 1);
        if (state.pipes.length === 0) {
            this.pause();
        }
        dest.emit("unpipe", this, unpipeInfo);
        return this;
    }
    removeAllListeners(ev) {
        const res = super.removeAllListeners(ev);
        if (ev === "readable" || ev === undefined) {
            queueMicrotask(()=>updateReadableListening(this));
        }
        return res;
    }
    resume() {
        const state = this._readableState;
        if (!state.flowing) {
            state.flowing = !state.readableListening;
            resume(this, state);
        }
        state[kPaused] = false;
        return this;
    }
    pause() {
        if (this._readableState.flowing !== false) {
            this._readableState.flowing = false;
            this.emit("pause");
        }
        this._readableState[kPaused] = true;
        return this;
    }
    wrap(stream) {
        const state = this._readableState;
        let paused = false;
        stream.on("end", ()=>{
            if (state.decoder && !state.ended) {
                const chunk = state.decoder.end();
                if (chunk && chunk.length) {
                    this.push(chunk);
                }
            }
            this.push(null);
        });
        stream.on("data", (chunk)=>{
            if (state.decoder) {
                chunk = state.decoder.write(chunk);
            }
            if (state.objectMode && (chunk === null || chunk === undefined)) {
                return;
            } else if (!state.objectMode && (!chunk || !chunk.length)) {
                return;
            }
            const ret = this.push(chunk);
            if (!ret) {
                paused = true;
                stream.pause();
            }
        });
        for(const i in stream){
            if (this[i] === undefined && typeof stream[i] === "function") {
                this[i] = function methodWrap(method) {
                    return function methodWrapReturnFunction() {
                        return stream[method].apply(stream);
                    };
                }(i);
            }
        }
        stream.on("error", (err)=>{
            errorOrDestroy(this, err);
        });
        stream.on("close", ()=>{
            this.emit("close");
        });
        stream.on("destroy", ()=>{
            this.emit("destroy");
        });
        stream.on("pause", ()=>{
            this.emit("pause");
        });
        stream.on("resume", ()=>{
            this.emit("resume");
        });
        this._read = ()=>{
            if (paused) {
                paused = false;
                stream.resume();
            }
        };
        return this;
    }
    [Symbol.asyncIterator]() {
        return createReadableStreamAsyncIterator(this);
    }
    get readable() {
        return this._readableState?.readable && !this._readableState?.destroyed && !this._readableState?.errorEmitted && !this._readableState?.endEmitted;
    }
    set readable(val) {
        if (this._readableState) {
            this._readableState.readable = val;
        }
    }
    get readableHighWaterMark() {
        return this._readableState.highWaterMark;
    }
    get readableBuffer() {
        return this._readableState && this._readableState.buffer;
    }
    get readableFlowing() {
        return this._readableState.flowing;
    }
    set readableFlowing(state) {
        if (this._readableState) {
            this._readableState.flowing = state;
        }
    }
    get readableLength() {
        return this._readableState.length;
    }
    get readableObjectMode() {
        return this._readableState ? this._readableState.objectMode : false;
    }
    get readableEncoding() {
        return this._readableState ? this._readableState.encoding : null;
    }
    get destroyed() {
        if (this._readableState === undefined) {
            return false;
        }
        return this._readableState.destroyed;
    }
    set destroyed(value) {
        if (!this._readableState) {
            return;
        }
        this._readableState.destroyed = value;
    }
    get readableEnded() {
        return this._readableState ? this._readableState.endEmitted : false;
    }
}
class Duplex extends Stream {
    allowHalfOpen = true;
    _final;
    _readableState;
    _writableState;
    _writev;
    constructor(options){
        super();
        if (options) {
            if (options.allowHalfOpen === false) {
                this.allowHalfOpen = false;
            }
            if (typeof options.destroy === "function") {
                this._destroy = options.destroy;
            }
            if (typeof options.final === "function") {
                this._final = options.final;
            }
            if (typeof options.read === "function") {
                this._read = options.read;
            }
            if (options.readable === false) {
                this.readable = false;
            }
            if (options.writable === false) {
                this.writable = false;
            }
            if (typeof options.write === "function") {
                this._write = options.write;
            }
            if (typeof options.writev === "function") {
                this._writev = options.writev;
            }
        }
        const readableOptions = {
            autoDestroy: options?.autoDestroy,
            defaultEncoding: options?.defaultEncoding,
            destroy: options?.destroy,
            emitClose: options?.emitClose,
            encoding: options?.encoding,
            highWaterMark: options?.highWaterMark ?? options?.readableHighWaterMark,
            objectMode: options?.objectMode ?? options?.readableObjectMode,
            read: options?.read
        };
        const writableOptions = {
            autoDestroy: options?.autoDestroy,
            decodeStrings: options?.decodeStrings,
            defaultEncoding: options?.defaultEncoding,
            destroy: options?.destroy,
            emitClose: options?.emitClose,
            final: options?.final,
            highWaterMark: options?.highWaterMark ?? options?.writableHighWaterMark,
            objectMode: options?.objectMode ?? options?.writableObjectMode,
            write: options?.write,
            writev: options?.writev
        };
        this._readableState = new ReadableState(readableOptions);
        this._writableState = new WritableState(writableOptions, this);
        this._writableState.onwrite = onwrite1.bind(undefined, this);
    }
    [captureRejectionSymbol](err) {
        this.destroy(err);
    }
    [Symbol.asyncIterator]() {
        return createReadableStreamAsyncIterator(this);
    }
    _destroy(error, callback) {
        callback(error);
    }
    _read = Readable.prototype._read;
    _undestroy = Readable.prototype._undestroy;
    destroy(err, cb) {
        const r = this._readableState;
        const w = this._writableState;
        if (w.destroyed || r.destroyed) {
            if (typeof cb === "function") {
                cb();
            }
            return this;
        }
        if (err) {
            err.stack;
            if (!w.errored) {
                w.errored = err;
            }
            if (!r.errored) {
                r.errored = err;
            }
        }
        w.destroyed = true;
        r.destroyed = true;
        this._destroy(err || null, (err)=>{
            if (err) {
                err.stack;
                if (!w.errored) {
                    w.errored = err;
                }
                if (!r.errored) {
                    r.errored = err;
                }
            }
            w.closed = true;
            r.closed = true;
            if (typeof cb === "function") {
                cb(err);
            }
            if (err) {
                queueMicrotask(()=>{
                    const r = this._readableState;
                    const w = this._writableState;
                    if (!w.errorEmitted && !r.errorEmitted) {
                        w.errorEmitted = true;
                        r.errorEmitted = true;
                        this.emit("error", err);
                    }
                    r.closeEmitted = true;
                    if (w.emitClose || r.emitClose) {
                        this.emit("close");
                    }
                });
            } else {
                queueMicrotask(()=>{
                    const r = this._readableState;
                    const w = this._writableState;
                    r.closeEmitted = true;
                    if (w.emitClose || r.emitClose) {
                        this.emit("close");
                    }
                });
            }
        });
        return this;
    }
    isPaused = Readable.prototype.isPaused;
    off = this.removeListener;
    on(ev, fn) {
        const res = super.on.call(this, ev, fn);
        const state = this._readableState;
        if (ev === "data") {
            state.readableListening = this.listenerCount("readable") > 0;
            if (state.flowing !== false) {
                this.resume();
            }
        } else if (ev === "readable") {
            if (!state.endEmitted && !state.readableListening) {
                state.readableListening = state.needReadable = true;
                state.flowing = false;
                state.emittedReadable = false;
                if (state.length) {
                    emitReadable(this);
                } else if (!state.reading) {
                    queueMicrotask(()=>nReadingNextTick(this));
                }
            }
        }
        return res;
    }
    pause = Readable.prototype.pause;
    pipe = Readable.prototype.pipe;
    push(chunk, encoding) {
        return readableAddChunk1(this, chunk, encoding, false);
    }
    read(n) {
        if (n === undefined) {
            n = NaN;
        }
        const state = this._readableState;
        const nOrig = n;
        if (n > state.highWaterMark) {
            state.highWaterMark = computeNewHighWaterMark(n);
        }
        if (n !== 0) {
            state.emittedReadable = false;
        }
        if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
            if (state.length === 0 && state.ended) {
                endDuplex(this);
            } else {
                emitReadable(this);
            }
            return null;
        }
        n = howMuchToRead(n, state);
        if (n === 0 && state.ended) {
            if (state.length === 0) {
                endDuplex(this);
            }
            return null;
        }
        let doRead = state.needReadable;
        if (state.length === 0 || state.length - n < state.highWaterMark) {
            doRead = true;
        }
        if (state.ended || state.reading || state.destroyed || state.errored || !state.constructed) {
            doRead = false;
        } else if (doRead) {
            state.reading = true;
            state.sync = true;
            if (state.length === 0) {
                state.needReadable = true;
            }
            this._read();
            state.sync = false;
            if (!state.reading) {
                n = howMuchToRead(nOrig, state);
            }
        }
        let ret;
        if (n > 0) {
            ret = fromList(n, state);
        } else {
            ret = null;
        }
        if (ret === null) {
            state.needReadable = state.length <= state.highWaterMark;
            n = 0;
        } else {
            state.length -= n;
            if (state.multiAwaitDrain) {
                state.awaitDrainWriters.clear();
            } else {
                state.awaitDrainWriters = null;
            }
        }
        if (state.length === 0) {
            if (!state.ended) {
                state.needReadable = true;
            }
            if (nOrig !== n && state.ended) {
                endDuplex(this);
            }
        }
        if (ret !== null) {
            this.emit("data", ret);
        }
        return ret;
    }
    removeAllListeners(ev) {
        const res = super.removeAllListeners(ev);
        if (ev === "readable" || ev === undefined) {
            queueMicrotask(()=>updateReadableListening(this));
        }
        return res;
    }
    removeListener(ev, fn) {
        const res = super.removeListener.call(this, ev, fn);
        if (ev === "readable") {
            queueMicrotask(()=>updateReadableListening(this));
        }
        return res;
    }
    resume = Readable.prototype.resume;
    setEncoding = Readable.prototype.setEncoding;
    unshift(chunk, encoding) {
        return readableAddChunk1(this, chunk, encoding, true);
    }
    unpipe = Readable.prototype.unpipe;
    wrap = Readable.prototype.wrap;
    get readable() {
        return this._readableState?.readable && !this._readableState?.destroyed && !this._readableState?.errorEmitted && !this._readableState?.endEmitted;
    }
    set readable(val) {
        if (this._readableState) {
            this._readableState.readable = val;
        }
    }
    get readableHighWaterMark() {
        return this._readableState.highWaterMark;
    }
    get readableBuffer() {
        return this._readableState && this._readableState.buffer;
    }
    get readableFlowing() {
        return this._readableState.flowing;
    }
    set readableFlowing(state) {
        if (this._readableState) {
            this._readableState.flowing = state;
        }
    }
    get readableLength() {
        return this._readableState.length;
    }
    get readableObjectMode() {
        return this._readableState ? this._readableState.objectMode : false;
    }
    get readableEncoding() {
        return this._readableState ? this._readableState.encoding : null;
    }
    get readableEnded() {
        return this._readableState ? this._readableState.endEmitted : false;
    }
    _write = Writable.prototype._write;
    write = Writable.prototype.write;
    cork = Writable.prototype.cork;
    uncork = Writable.prototype.uncork;
    setDefaultEncoding(encoding) {
        if (typeof encoding === "string") {
            encoding = encoding.toLowerCase();
        }
        if (!Buffer.isEncoding(encoding)) {
            throw new ERR_UNKNOWN_ENCODING(encoding);
        }
        this._writableState.defaultEncoding = encoding;
        return this;
    }
    end(x, y, z) {
        const state = this._writableState;
        let chunk;
        let encoding;
        let cb;
        if (typeof x === "function") {
            chunk = null;
            encoding = null;
            cb = x;
        } else if (typeof y === "function") {
            chunk = x;
            encoding = null;
            cb = y;
        } else {
            chunk = x;
            encoding = y;
            cb = z;
        }
        if (chunk !== null && chunk !== undefined) {
            this.write(chunk, encoding);
        }
        if (state.corked) {
            state.corked = 1;
            this.uncork();
        }
        let err;
        if (!state.errored && !state.ending) {
            state.ending = true;
            finishMaybe1(this, state, true);
            state.ended = true;
        } else if (state.finished) {
            err = new ERR_STREAM_ALREADY_FINISHED("end");
        } else if (state.destroyed) {
            err = new ERR_STREAM_DESTROYED("end");
        }
        if (typeof cb === "function") {
            if (err || state.finished) {
                queueMicrotask(()=>{
                    cb(err);
                });
            } else {
                state[kOnFinished].push(cb);
            }
        }
        return this;
    }
    get destroyed() {
        if (this._readableState === undefined || this._writableState === undefined) {
            return false;
        }
        return this._readableState.destroyed && this._writableState.destroyed;
    }
    set destroyed(value) {
        if (this._readableState && this._writableState) {
            this._readableState.destroyed = value;
            this._writableState.destroyed = value;
        }
    }
    get writable() {
        const w = this._writableState;
        return !w.destroyed && !w.errored && !w.ending && !w.ended;
    }
    set writable(val) {
        if (this._writableState) {
            this._writableState.writable = !!val;
        }
    }
    get writableFinished() {
        return this._writableState ? this._writableState.finished : false;
    }
    get writableObjectMode() {
        return this._writableState ? this._writableState.objectMode : false;
    }
    get writableBuffer() {
        return this._writableState && this._writableState.getBuffer();
    }
    get writableEnded() {
        return this._writableState ? this._writableState.ending : false;
    }
    get writableHighWaterMark() {
        return this._writableState && this._writableState.highWaterMark;
    }
    get writableCorked() {
        return this._writableState ? this._writableState.corked : 0;
    }
    get writableLength() {
        return this._writableState && this._writableState.length;
    }
}
Object.defineProperties(Readable, {
    _readableState: {
        enumerable: false
    },
    destroyed: {
        enumerable: false
    },
    readableBuffer: {
        enumerable: false
    },
    readableEncoding: {
        enumerable: false
    },
    readableEnded: {
        enumerable: false
    },
    readableFlowing: {
        enumerable: false
    },
    readableHighWaterMark: {
        enumerable: false
    },
    readableLength: {
        enumerable: false
    },
    readableObjectMode: {
        enumerable: false
    }
});
const kLastReject = Symbol("lastReject");
const kError = Symbol("error");
const kEnded = Symbol("ended");
const kLastPromise = Symbol("lastPromise");
const kHandlePromise = Symbol("handlePromise");
const kStream = Symbol("stream");
function initIteratorSymbols(o, symbols) {
    const properties = {};
    for(const sym in symbols){
        properties[sym] = {
            configurable: false,
            enumerable: false,
            writable: true
        };
    }
    Object.defineProperties(o, properties);
}
function createIterResult1(value, done) {
    return {
        value,
        done
    };
}
function readAndResolve(iter) {
    const resolve = iter[kLastResolve];
    if (resolve !== null) {
        const data = iter[kStream].read();
        if (data !== null) {
            iter[kLastPromise] = null;
            iter[kLastResolve] = null;
            iter[kLastReject] = null;
            resolve(createIterResult1(data, false));
        }
    }
}
function onReadable(iter) {
    queueMicrotask(()=>readAndResolve(iter));
}
function wrapForNext(lastPromise, iter) {
    return (resolve, reject)=>{
        lastPromise.then(()=>{
            if (iter[kEnded]) {
                resolve(createIterResult1(undefined, true));
                return;
            }
            iter[kHandlePromise](resolve, reject);
        }, reject);
    };
}
function finish2(self, err) {
    return new Promise((resolve, reject)=>{
        const stream = self[kStream];
        eos(stream, (err)=>{
            if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
                reject(err);
            } else {
                resolve(createIterResult1(undefined, true));
            }
        });
        destroyer(stream, err);
    });
}
const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function*() {}).prototype);
class ReadableStreamAsyncIterator {
    [kEnded];
    [kError] = null;
    [kHandlePromise] = (resolve, reject)=>{
        const data = this[kStream].read();
        if (data) {
            this[kLastPromise] = null;
            this[kLastResolve] = null;
            this[kLastReject] = null;
            resolve(createIterResult1(data, false));
        } else {
            this[kLastResolve] = resolve;
            this[kLastReject] = reject;
        }
    };
    [kLastPromise];
    [kLastReject] = null;
    [kLastResolve] = null;
    [kStream];
    [Symbol.asyncIterator] = AsyncIteratorPrototype[Symbol.asyncIterator];
    constructor(stream){
        this[kEnded] = stream.readableEnded || stream._readableState.endEmitted;
        this[kStream] = stream;
        initIteratorSymbols(this, [
            kEnded,
            kError,
            kHandlePromise,
            kLastPromise,
            kLastReject,
            kLastResolve,
            kStream
        ]);
    }
    get stream() {
        return this[kStream];
    }
    next() {
        const error = this[kError];
        if (error !== null) {
            return Promise.reject(error);
        }
        if (this[kEnded]) {
            return Promise.resolve(createIterResult1(undefined, true));
        }
        if (this[kStream].destroyed) {
            return new Promise((resolve, reject)=>{
                if (this[kError]) {
                    reject(this[kError]);
                } else if (this[kEnded]) {
                    resolve(createIterResult1(undefined, true));
                } else {
                    eos(this[kStream], (err)=>{
                        if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
                            reject(err);
                        } else {
                            resolve(createIterResult1(undefined, true));
                        }
                    });
                }
            });
        }
        const lastPromise = this[kLastPromise];
        let promise;
        if (lastPromise) {
            promise = new Promise(wrapForNext(lastPromise, this));
        } else {
            const data = this[kStream].read();
            if (data !== null) {
                return Promise.resolve(createIterResult1(data, false));
            }
            promise = new Promise(this[kHandlePromise]);
        }
        this[kLastPromise] = promise;
        return promise;
    }
    return() {
        return finish2(this);
    }
    throw(err) {
        return finish2(this, err);
    }
}
const createReadableStreamAsyncIterator = (stream)=>{
    if (typeof stream.read !== "function") {
        const src = stream;
        stream = new Readable({
            objectMode: true
        }).wrap(src);
        eos(stream, (err)=>destroyer(src, err));
    }
    const iterator = new ReadableStreamAsyncIterator(stream);
    iterator[kLastPromise] = null;
    eos(stream, {
        writable: false
    }, (err)=>{
        if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
            const reject = iterator[kLastReject];
            if (reject !== null) {
                iterator[kLastPromise] = null;
                iterator[kLastResolve] = null;
                iterator[kLastReject] = null;
                reject(err);
            }
            iterator[kError] = err;
            return;
        }
        const resolve = iterator[kLastResolve];
        if (resolve !== null) {
            iterator[kLastPromise] = null;
            iterator[kLastResolve] = null;
            iterator[kLastReject] = null;
            resolve(createIterResult1(undefined, true));
        }
        iterator[kEnded] = true;
    });
    stream.on("readable", onReadable.bind(null, iterator));
    return iterator;
};
const kCallback = Symbol("kCallback");
class Transform extends Duplex {
    [kCallback];
    _flush;
    constructor(options){
        super(options);
        this._readableState.sync = false;
        this[kCallback] = null;
        if (options) {
            if (typeof options.transform === "function") {
                this._transform = options.transform;
            }
            if (typeof options.flush === "function") {
                this._flush = options.flush;
            }
        }
        this.on("prefinish", function() {
            if (typeof this._flush === "function" && !this.destroyed) {
                this._flush((er, data)=>{
                    if (er) {
                        this.destroy(er);
                        return;
                    }
                    if (data != null) {
                        this.push(data);
                    }
                    this.push(null);
                });
            } else {
                this.push(null);
            }
        });
    }
    _read = ()=>{
        if (this[kCallback]) {
            const callback = this[kCallback];
            this[kCallback] = null;
            callback();
        }
    };
    _transform(_chunk, _encoding, _callback) {
        throw new ERR_METHOD_NOT_IMPLEMENTED("_transform()");
    }
    _write = (chunk, encoding, callback)=>{
        const rState = this._readableState;
        const wState = this._writableState;
        const length = rState.length;
        this._transform(chunk, encoding, (err, val)=>{
            if (err) {
                callback(err);
                return;
            }
            if (val != null) {
                this.push(val);
            }
            if (wState.ended || length === rState.length || rState.length < rState.highWaterMark || rState.length === 0) {
                callback();
            } else {
                this[kCallback] = callback;
            }
        });
    };
}
class PassThrough extends Transform {
    constructor(options){
        super(options);
    }
    _transform(chunk, _encoding, cb) {
        cb(null, chunk);
    }
}
function destroyer1(stream, reading, writing, callback) {
    callback = once(callback);
    let finished = false;
    stream.on("close", ()=>{
        finished = true;
    });
    eos(stream, {
        readable: reading,
        writable: writing
    }, (err)=>{
        finished = !err;
        const rState = stream?._readableState;
        if (err && err.code === "ERR_STREAM_PREMATURE_CLOSE" && reading && rState?.ended && !rState?.errored && !rState?.errorEmitted) {
            stream.once("end", callback).once("error", callback);
        } else {
            callback(err);
        }
    });
    return (err)=>{
        if (finished) return;
        finished = true;
        destroyer(stream, err);
        callback(err || new ERR_STREAM_DESTROYED("pipe"));
    };
}
function popCallback(streams) {
    if (typeof streams[streams.length - 1] !== "function") {
        throw new ERR_INVALID_CALLBACK(streams[streams.length - 1]);
    }
    return streams.pop();
}
function isReadable1(obj) {
    return !!(obj && typeof obj.pipe === "function");
}
function isWritable1(obj) {
    return !!(obj && typeof obj.write === "function");
}
function isStream(obj) {
    return isReadable1(obj) || isWritable1(obj);
}
function isIterable(obj, isAsync) {
    if (!obj) return false;
    if (isAsync === true) return typeof obj[Symbol.asyncIterator] === "function";
    if (isAsync === false) return typeof obj[Symbol.iterator] === "function";
    return typeof obj[Symbol.asyncIterator] === "function" || typeof obj[Symbol.iterator] === "function";
}
function makeAsyncIterable(val) {
    if (isIterable(val)) {
        return val;
    } else if (isReadable1(val)) {
        return fromReadable(val);
    }
    throw new ERR_INVALID_ARG_TYPE("val", [
        "Readable",
        "Iterable",
        "AsyncIterable"
    ], val);
}
async function* fromReadable(val) {
    yield* createReadableStreamAsyncIterator(val);
}
async function pump(iterable, writable, finish) {
    let error;
    try {
        for await (const chunk of iterable){
            if (!writable.write(chunk)) {
                if (writable.destroyed) return;
                await once1(writable, "drain");
            }
        }
        writable.end();
    } catch (err) {
        error = err;
    } finally{
        finish(error);
    }
}
function pipeline(...args) {
    const callback = once(popCallback(args));
    let streams;
    if (args.length > 1) {
        streams = args;
    } else {
        throw new ERR_MISSING_ARGS("streams");
    }
    let error;
    let value;
    const destroys = [];
    let finishCount = 0;
    function finish(err) {
        const __final = --finishCount === 0;
        if (err && (!error || error.code === "ERR_STREAM_PREMATURE_CLOSE")) {
            error = err;
        }
        if (!error && !__final) {
            return;
        }
        while(destroys.length){
            destroys.shift()(error);
        }
        if (__final) {
            callback(error, value);
        }
    }
    let ret;
    for(let i = 0; i < streams.length; i++){
        const stream = streams[i];
        const reading = i < streams.length - 1;
        const writing = i > 0;
        if (isStream(stream)) {
            finishCount++;
            destroys.push(destroyer1(stream, reading, writing, finish));
        }
        if (i === 0) {
            if (typeof stream === "function") {
                ret = stream();
                if (!isIterable(ret)) {
                    throw new ERR_INVALID_RETURN_VALUE("Iterable, AsyncIterable or Stream", "source", ret);
                }
            } else if (isIterable(stream) || isReadable1(stream)) {
                ret = stream;
            } else {
                throw new ERR_INVALID_ARG_TYPE("source", [
                    "Stream",
                    "Iterable",
                    "AsyncIterable",
                    "Function"
                ], stream);
            }
        } else if (typeof stream === "function") {
            ret = makeAsyncIterable(ret);
            ret = stream(ret);
            if (reading) {
                if (!isIterable(ret, true)) {
                    throw new ERR_INVALID_RETURN_VALUE("AsyncIterable", `transform[${i - 1}]`, ret);
                }
            } else {
                const pt = new PassThrough({
                    objectMode: true
                });
                if (ret instanceof Promise) {
                    ret.then((val)=>{
                        value = val;
                        pt.end(val);
                    }, (err)=>{
                        pt.destroy(err);
                    });
                } else if (isIterable(ret, true)) {
                    finishCount++;
                    pump(ret, pt, finish);
                } else {
                    throw new ERR_INVALID_RETURN_VALUE("AsyncIterable or Promise", "destination", ret);
                }
                ret = pt;
                finishCount++;
                destroys.push(destroyer1(ret, false, true, finish));
            }
        } else if (isStream(stream)) {
            if (isReadable1(ret)) {
                ret.pipe(stream);
            } else {
                ret = makeAsyncIterable(ret);
                finishCount++;
                pump(ret, stream, finish);
            }
            ret = stream;
        } else {
            const name = reading ? `transform[${i - 1}]` : "destination";
            throw new ERR_INVALID_ARG_TYPE(name, [
                "Stream",
                "Function"
            ], ret);
        }
    }
    return ret;
}
function pipeline1(...streams) {
    return new Promise((resolve, reject)=>{
        pipeline(...streams, (err, value)=>{
            if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        });
    });
}
function finished(stream, opts) {
    return new Promise((resolve, reject)=>{
        eos(stream, opts || null, (err)=>{
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
const mod4 = {
    pipeline: pipeline1,
    finished: finished
};
Stream.Readable = Readable;
Stream.Writable = Writable;
Stream.Duplex = Duplex;
Stream.Transform = Transform;
Stream.PassThrough = PassThrough;
Stream.pipeline = pipeline;
Stream.finished = eos;
Stream.promises = mod4;
Stream.Stream = Stream;
const { _isUint8Array , _uint8ArrayToBuffer  } = Stream;
class Hash1 extends Transform {
    hash;
    constructor(algorithm, _opts){
        super({
            transform (chunk, _encoding, callback) {
                hash.update(chunk);
                callback();
            },
            flush (callback) {
                this.push(hash.digest());
                callback();
            }
        });
        const hash = this.hash = createHash(algorithm);
    }
    update(data, _encoding) {
        if (typeof data === "string") {
            data = new TextEncoder().encode(data);
            this.hash.update(data);
        } else {
            this.hash.update(data);
        }
        return this;
    }
    digest(encoding) {
        const digest = this.hash.digest();
        if (encoding === undefined) {
            return Buffer.from(digest);
        }
        switch(encoding){
            case "hex":
                {
                    return new TextDecoder().decode(encode(new Uint8Array(digest)));
                }
            default:
                {
                    throw new Error(`The output encoding for hash digest is not impelemented: ${encoding}`);
                }
        }
    }
}
function createHash1(algorithm, opts) {
    return new Hash1(algorithm, opts);
}
function getHashes() {
    return supportedAlgorithms.slice();
}
const __default6 = {
    Hash: Hash1,
    createHash: createHash1,
    getHashes,
    pbkdf2,
    pbkdf2Sync,
    randomBytes
};
const { assert: assert3 , clear , count , countReset , debug , dir , dirxml , error , group , groupCollapsed , groupEnd , info , log , table , time , timeEnd , timeLog , trace , warn  } = console;
function access(_path, _modeOrCallback, _callback) {
    notImplemented("Not yet available");
}
function accessSync(_path, _mode) {
    notImplemented("Not yet available");
}
function isFileOptions(fileOptions) {
    if (!fileOptions) return false;
    return fileOptions.encoding != undefined || fileOptions.flag != undefined || fileOptions.mode != undefined;
}
function getEncoding(optOrCallback) {
    if (!optOrCallback || typeof optOrCallback === "function") {
        return null;
    }
    const encoding = typeof optOrCallback === "string" ? optOrCallback : optOrCallback.encoding;
    if (!encoding) return null;
    return encoding;
}
function checkEncoding1(encoding) {
    if (!encoding) return null;
    encoding = encoding.toLowerCase();
    if ([
        "utf8",
        "hex",
        "base64"
    ].includes(encoding)) return encoding;
    if (encoding === "utf-8") {
        return "utf8";
    }
    if (encoding === "binary") {
        return "binary";
    }
    const notImplementedEncodings = [
        "utf16le",
        "latin1",
        "ascii",
        "ucs2"
    ];
    if (notImplementedEncodings.includes(encoding)) {
        notImplemented(`"${encoding}" encoding`);
    }
    throw new Error(`The value "${encoding}" is invalid for option "encoding"`);
}
function getOpenOptions(flag) {
    if (!flag) {
        return {
            create: true,
            append: true
        };
    }
    let openOptions;
    switch(flag){
        case "a":
            {
                openOptions = {
                    create: true,
                    append: true
                };
                break;
            }
        case "ax":
            {
                openOptions = {
                    createNew: true,
                    write: true,
                    append: true
                };
                break;
            }
        case "a+":
            {
                openOptions = {
                    read: true,
                    create: true,
                    append: true
                };
                break;
            }
        case "ax+":
            {
                openOptions = {
                    read: true,
                    createNew: true,
                    append: true
                };
                break;
            }
        case "r":
            {
                openOptions = {
                    read: true
                };
                break;
            }
        case "r+":
            {
                openOptions = {
                    read: true,
                    write: true
                };
                break;
            }
        case "w":
            {
                openOptions = {
                    create: true,
                    write: true,
                    truncate: true
                };
                break;
            }
        case "wx":
            {
                openOptions = {
                    createNew: true,
                    write: true
                };
                break;
            }
        case "w+":
            {
                openOptions = {
                    create: true,
                    write: true,
                    truncate: true,
                    read: true
                };
                break;
            }
        case "wx+":
            {
                openOptions = {
                    createNew: true,
                    write: true,
                    read: true
                };
                break;
            }
        case "as":
            {
                openOptions = {
                    create: true,
                    append: true
                };
                break;
            }
        case "as+":
            {
                openOptions = {
                    create: true,
                    read: true,
                    append: true
                };
                break;
            }
        case "rs+":
            {
                openOptions = {
                    create: true,
                    read: true,
                    write: true
                };
                break;
            }
        default:
            {
                throw new Error(`Unrecognized file system flag: ${flag}`);
            }
    }
    return openOptions;
}
const __default7 = {
    ...mod3
};
function appendFile(pathOrRid, data, optionsOrCallback, callback) {
    pathOrRid = pathOrRid instanceof URL ? fromFileUrl2(pathOrRid) : pathOrRid;
    const callbackFn = optionsOrCallback instanceof Function ? optionsOrCallback : callback;
    const options = optionsOrCallback instanceof Function ? undefined : optionsOrCallback;
    if (!callbackFn) {
        throw new Error("No callback function supplied");
    }
    validateEncoding(options);
    let rid = -1;
    const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    new Promise((resolve, reject)=>{
        if (typeof pathOrRid === "number") {
            rid = pathOrRid;
            Deno.write(rid, buffer).then(resolve, reject);
        } else {
            const mode = isFileOptions(options) ? options.mode : undefined;
            const flag = isFileOptions(options) ? options.flag : undefined;
            if (mode) {
                notImplemented("Deno does not yet support setting mode on create");
            }
            Deno.open(pathOrRid, getOpenOptions(flag)).then(({ rid: openedFileRid  })=>{
                rid = openedFileRid;
                return Deno.write(openedFileRid, buffer);
            }).then(resolve, reject);
        }
    }).then(()=>{
        closeRidIfNecessary(typeof pathOrRid === "string", rid);
        callbackFn(null);
    }, (err)=>{
        closeRidIfNecessary(typeof pathOrRid === "string", rid);
        callbackFn(err);
    });
}
function closeRidIfNecessary(isPathString, rid) {
    if (isPathString && rid != -1) {
        Deno.close(rid);
    }
}
function appendFileSync(pathOrRid, data, options) {
    let rid = -1;
    validateEncoding(options);
    pathOrRid = pathOrRid instanceof URL ? fromFileUrl2(pathOrRid) : pathOrRid;
    try {
        if (typeof pathOrRid === "number") {
            rid = pathOrRid;
        } else {
            const mode = isFileOptions(options) ? options.mode : undefined;
            const flag = isFileOptions(options) ? options.flag : undefined;
            if (mode) {
                notImplemented("Deno does not yet support setting mode on create");
            }
            const file = Deno.openSync(pathOrRid, getOpenOptions(flag));
            rid = file.rid;
        }
        const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
        Deno.writeSync(rid, buffer);
    } finally{
        closeRidIfNecessary(typeof pathOrRid === "string", rid);
    }
}
function validateEncoding(encodingOption) {
    if (!encodingOption) return;
    if (typeof encodingOption === "string") {
        if (encodingOption !== "utf8") {
            throw new Error("Only 'utf8' encoding is currently supported");
        }
    } else if (encodingOption.encoding && encodingOption.encoding !== "utf8") {
        throw new Error("Only 'utf8' encoding is currently supported");
    }
}
const allowedModes = /^[0-7]{3}/;
function chmod(path, mode, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    Deno.chmod(path, getResolvedMode(mode)).then(()=>callback(null), callback);
}
function chmodSync(path, mode) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    Deno.chmodSync(path, getResolvedMode(mode));
}
function getResolvedMode(mode) {
    if (typeof mode === "number") {
        return mode;
    }
    if (typeof mode === "string" && !allowedModes.test(mode)) {
        throw new Error("Unrecognized mode: " + mode);
    }
    return parseInt(mode, 8);
}
function chown(path, uid, gid, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    Deno.chown(path, uid, gid).then(()=>callback(null), callback);
}
function chownSync(path, uid, gid) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    Deno.chownSync(path, uid, gid);
}
function close(fd, callback) {
    setTimeout(()=>{
        let error = null;
        try {
            Deno.close(fd);
        } catch (err) {
            error = err;
        }
        callback(error);
    }, 0);
}
function closeSync(fd) {
    Deno.close(fd);
}
const mod5 = function() {
    return {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1,
        S_IRUSR: 0o400,
        S_IWUSR: 0o200,
        S_IXUSR: 0o100,
        S_IRGRP: 0o40,
        S_IWGRP: 0o20,
        S_IXGRP: 0o10,
        S_IROTH: 0o4,
        S_IWOTH: 0o2,
        S_IXOTH: 0o1
    };
}();
function copyFile(source, destination, callback) {
    source = source instanceof URL ? fromFileUrl2(source) : source;
    Deno.copyFile(source, destination).then(()=>callback(null), callback);
}
function copyFileSync(source, destination) {
    source = source instanceof URL ? fromFileUrl2(source) : source;
    Deno.copyFileSync(source, destination);
}
class Dirent {
    constructor(entry){
        this.entry = entry;
    }
    isBlockDevice() {
        notImplemented("Deno does not yet support identification of block devices");
        return false;
    }
    isCharacterDevice() {
        notImplemented("Deno does not yet support identification of character devices");
        return false;
    }
    isDirectory() {
        return this.entry.isDirectory;
    }
    isFIFO() {
        notImplemented("Deno does not yet support identification of FIFO named pipes");
        return false;
    }
    isFile() {
        return this.entry.isFile;
    }
    isSocket() {
        notImplemented("Deno does not yet support identification of sockets");
        return false;
    }
    isSymbolicLink() {
        return this.entry.isSymlink;
    }
    get name() {
        return this.entry.name;
    }
    entry;
}
class Dir {
    dirPath;
    syncIterator;
    asyncIterator;
    constructor(path){
        this.dirPath = path;
    }
    get path() {
        if (this.dirPath instanceof Uint8Array) {
            return new TextDecoder().decode(this.dirPath);
        }
        return this.dirPath;
    }
    read(callback) {
        return new Promise((resolve, reject)=>{
            if (!this.asyncIterator) {
                this.asyncIterator = Deno.readDir(this.path)[Symbol.asyncIterator]();
            }
            assert1(this.asyncIterator);
            this.asyncIterator.next().then(({ value  })=>{
                resolve(value ? value : null);
                if (callback) {
                    callback(null, value ? value : null);
                }
            }, (err)=>{
                if (callback) {
                    callback(err);
                }
                reject(err);
            });
        });
    }
    readSync() {
        if (!this.syncIterator) {
            this.syncIterator = Deno.readDirSync(this.path)[Symbol.iterator]();
        }
        const file = this.syncIterator.next().value;
        return file ? new Dirent(file) : null;
    }
    close(callback) {
        return new Promise((resolve)=>{
            if (callback) {
                callback(null);
            }
            resolve();
        });
    }
    closeSync() {}
    async *[Symbol.asyncIterator]() {
        try {
            while(true){
                const dirent = await this.read();
                if (dirent === null) {
                    break;
                }
                yield dirent;
            }
        } finally{
            await this.close();
        }
    }
}
function exists(path, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    Deno.lstat(path).then(()=>callback(true), ()=>callback(false));
}
function existsSync(path) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    try {
        Deno.lstatSync(path);
        return true;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
function fdatasync(fd, callback) {
    Deno.fdatasync(fd).then(()=>callback(null), callback);
}
function fdatasyncSync(fd) {
    Deno.fdatasyncSync(fd);
}
function convertFileInfoToStats(origin) {
    return {
        dev: origin.dev,
        ino: origin.ino,
        mode: origin.mode,
        nlink: origin.nlink,
        uid: origin.uid,
        gid: origin.gid,
        rdev: origin.rdev,
        size: origin.size,
        blksize: origin.blksize,
        blocks: origin.blocks,
        mtime: origin.mtime,
        atime: origin.atime,
        birthtime: origin.birthtime,
        mtimeMs: origin.mtime?.getTime() || null,
        atimeMs: origin.atime?.getTime() || null,
        birthtimeMs: origin.birthtime?.getTime() || null,
        isFile: ()=>origin.isFile,
        isDirectory: ()=>origin.isDirectory,
        isSymbolicLink: ()=>origin.isSymlink,
        isBlockDevice: ()=>false,
        isFIFO: ()=>false,
        isCharacterDevice: ()=>false,
        isSocket: ()=>false,
        ctime: origin.mtime,
        ctimeMs: origin.mtime?.getTime() || null
    };
}
function toBigInt(number) {
    if (number === null || number === undefined) return null;
    return BigInt(number);
}
function convertFileInfoToBigIntStats(origin) {
    return {
        dev: toBigInt(origin.dev),
        ino: toBigInt(origin.ino),
        mode: toBigInt(origin.mode),
        nlink: toBigInt(origin.nlink),
        uid: toBigInt(origin.uid),
        gid: toBigInt(origin.gid),
        rdev: toBigInt(origin.rdev),
        size: toBigInt(origin.size) || 0n,
        blksize: toBigInt(origin.blksize),
        blocks: toBigInt(origin.blocks),
        mtime: origin.mtime,
        atime: origin.atime,
        birthtime: origin.birthtime,
        mtimeMs: origin.mtime ? BigInt(origin.mtime.getTime()) : null,
        atimeMs: origin.atime ? BigInt(origin.atime.getTime()) : null,
        birthtimeMs: origin.birthtime ? BigInt(origin.birthtime.getTime()) : null,
        mtimeNs: origin.mtime ? BigInt(origin.mtime.getTime()) * 1000000n : null,
        atimeNs: origin.atime ? BigInt(origin.atime.getTime()) * 1000000n : null,
        birthtimeNs: origin.birthtime ? BigInt(origin.birthtime.getTime()) * 1000000n : null,
        isFile: ()=>origin.isFile,
        isDirectory: ()=>origin.isDirectory,
        isSymbolicLink: ()=>origin.isSymlink,
        isBlockDevice: ()=>false,
        isFIFO: ()=>false,
        isCharacterDevice: ()=>false,
        isSocket: ()=>false,
        ctime: origin.mtime,
        ctimeMs: origin.mtime ? BigInt(origin.mtime.getTime()) : null,
        ctimeNs: origin.mtime ? BigInt(origin.mtime.getTime()) * 1000000n : null
    };
}
function CFISBIS(fileInfo, bigInt) {
    if (bigInt) return convertFileInfoToBigIntStats(fileInfo);
    return convertFileInfoToStats(fileInfo);
}
function stat(path, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : {
        bigint: false
    };
    if (!callback) throw new Error("No callback function supplied");
    Deno.stat(path).then((stat)=>callback(null, CFISBIS(stat, options.bigint)), (err)=>callback(err));
}
function statSync(path, options = {
    bigint: false
}) {
    const origin = Deno.statSync(path);
    return CFISBIS(origin, options.bigint);
}
function fstat(fd, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : {
        bigint: false
    };
    if (!callback) throw new Error("No callback function supplied");
    Deno.fstat(fd).then((stat)=>callback(null, CFISBIS(stat, options.bigint)), (err)=>callback(err));
}
function fstatSync(fd, options) {
    const origin = Deno.fstatSync(fd);
    return CFISBIS(origin, options?.bigint || false);
}
function fsync(fd, callback) {
    Deno.fsync(fd).then(()=>callback(null), callback);
}
function fsyncSync(fd) {
    Deno.fsyncSync(fd);
}
function ftruncate(fd, lenOrCallback, maybeCallback) {
    const len = typeof lenOrCallback === "number" ? lenOrCallback : undefined;
    const callback = typeof lenOrCallback === "function" ? lenOrCallback : maybeCallback;
    if (!callback) throw new Error("No callback function supplied");
    Deno.ftruncate(fd, len).then(()=>callback(null), callback);
}
function ftruncateSync(fd, len) {
    Deno.ftruncateSync(fd, len);
}
function getValidTime(time, name) {
    if (typeof time === "string") {
        time = Number(time);
    }
    if (typeof time === "number" && (Number.isNaN(time) || !Number.isFinite(time))) {
        throw new Deno.errors.InvalidData(`invalid ${name}, must not be infitiny or NaN`);
    }
    return time;
}
function futimes(fd, atime, mtime, callback) {
    if (!callback) {
        throw new Deno.errors.InvalidData("No callback function supplied");
    }
    atime = getValidTime(atime, "atime");
    mtime = getValidTime(mtime, "mtime");
    Deno.futime(fd, atime, mtime).then(()=>callback(null), callback);
}
function futimesSync(fd, atime, mtime) {
    atime = getValidTime(atime, "atime");
    mtime = getValidTime(mtime, "mtime");
    Deno.futimeSync(fd, atime, mtime);
}
function link(existingPath, newPath, callback) {
    existingPath = existingPath instanceof URL ? fromFileUrl2(existingPath) : existingPath;
    newPath = newPath instanceof URL ? fromFileUrl2(newPath) : newPath;
    Deno.link(existingPath, newPath).then(()=>callback(null), callback);
}
function linkSync(existingPath, newPath) {
    existingPath = existingPath instanceof URL ? fromFileUrl2(existingPath) : existingPath;
    newPath = newPath instanceof URL ? fromFileUrl2(newPath) : newPath;
    Deno.linkSync(existingPath, newPath);
}
function lstat(path, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : {
        bigint: false
    };
    if (!callback) throw new Error("No callback function supplied");
    Deno.lstat(path).then((stat)=>callback(null, CFISBIS(stat, options.bigint)), (err)=>callback(err));
}
function lstatSync(path, options) {
    const origin = Deno.lstatSync(path);
    return CFISBIS(origin, options?.bigint || false);
}
function mkdir(path, options, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    let mode = 0o777;
    let recursive = false;
    if (typeof options == "function") {
        callback = options;
    } else if (typeof options === "number") {
        mode = options;
    } else if (typeof options === "boolean") {
        recursive = options;
    } else if (options) {
        if (options.recursive !== undefined) recursive = options.recursive;
        if (options.mode !== undefined) mode = options.mode;
    }
    if (typeof recursive !== "boolean") {
        throw new Deno.errors.InvalidData("invalid recursive option , must be a boolean");
    }
    Deno.mkdir(path, {
        recursive,
        mode
    }).then(()=>{
        if (typeof callback === "function") {
            callback(null);
        }
    }, (err)=>{
        if (typeof callback === "function") {
            callback(err);
        }
    });
}
function mkdirSync(path, options) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    let mode = 0o777;
    let recursive = false;
    if (typeof options === "number") {
        mode = options;
    } else if (typeof options === "boolean") {
        recursive = options;
    } else if (options) {
        if (options.recursive !== undefined) recursive = options.recursive;
        if (options.mode !== undefined) mode = options.mode;
    }
    if (typeof recursive !== "boolean") {
        throw new Deno.errors.InvalidData("invalid recursive option , must be a boolean");
    }
    Deno.mkdirSync(path, {
        recursive,
        mode
    });
}
function mkdtemp(prefix, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback == "function" ? optionsOrCallback : maybeCallback;
    if (!callback) throw new ERR_INVALID_CALLBACK(callback);
    const encoding = parseEncoding(optionsOrCallback);
    const path = tempDirPath(prefix);
    mkdir(path, {
        recursive: false,
        mode: 0o700
    }, (err)=>{
        if (err) callback(err);
        else callback(null, decode2(path, encoding));
    });
}
function mkdtempSync(prefix, options) {
    const encoding = parseEncoding(options);
    const path = tempDirPath(prefix);
    mkdirSync(path, {
        recursive: false,
        mode: 0o700
    });
    return decode2(path, encoding);
}
function parseEncoding(optionsOrCallback) {
    let encoding;
    if (typeof optionsOrCallback == "function") encoding = undefined;
    else if (optionsOrCallback instanceof Object) {
        encoding = optionsOrCallback?.encoding;
    } else encoding = optionsOrCallback;
    if (encoding) {
        try {
            new TextDecoder(encoding);
        } catch  {
            throw new ERR_INVALID_OPT_VALUE_ENCODING(encoding);
        }
    }
    return encoding;
}
function decode2(str, encoding) {
    if (!encoding) return str;
    else {
        const decoder = new TextDecoder(encoding);
        const encoder = new TextEncoder();
        return decoder.decode(encoder.encode(str));
    }
}
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randomName() {
    return [
        ...Array(6)
    ].map(()=>CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}
function tempDirPath(prefix) {
    let path;
    do {
        path = prefix + randomName();
    }while (existsSync(path))
    return path;
}
function existsSync1(filePath) {
    try {
        Deno.lstatSync(filePath);
        return true;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
function convertFlagAndModeToOptions(flag, mode) {
    if (!flag && !mode) return undefined;
    if (!flag && mode) return {
        mode
    };
    return {
        ...getOpenOptions(flag),
        mode
    };
}
function open(path, flagsOrCallback, callbackOrMode, maybeCallback) {
    const flags = typeof flagsOrCallback === "string" ? flagsOrCallback : undefined;
    const callback = typeof flagsOrCallback === "function" ? flagsOrCallback : typeof callbackOrMode === "function" ? callbackOrMode : maybeCallback;
    const mode = typeof callbackOrMode === "number" ? callbackOrMode : undefined;
    path = path instanceof URL ? fromFileUrl2(path) : path;
    if (!callback) throw new Error("No callback function supplied");
    if ([
        "ax",
        "ax+",
        "wx",
        "wx+"
    ].includes(flags || "") && existsSync1(path)) {
        const err = new Error(`EEXIST: file already exists, open '${path}'`);
        callback(err);
    } else {
        if (flags === "as" || flags === "as+") {
            let err1 = null, res;
            try {
                res = openSync(path, flags, mode);
            } catch (error) {
                err1 = error;
            }
            if (err1) {
                callback(err1);
            } else {
                callback(null, res);
            }
            return;
        }
        Deno.open(path, convertFlagAndModeToOptions(flags, mode)).then((file)=>callback(null, file.rid), (err)=>callback(err));
    }
}
function openSync(path, flagsOrMode, maybeMode) {
    const flags = typeof flagsOrMode === "string" ? flagsOrMode : undefined;
    const mode = typeof flagsOrMode === "number" ? flagsOrMode : maybeMode;
    path = path instanceof URL ? fromFileUrl2(path) : path;
    if ([
        "ax",
        "ax+",
        "wx",
        "wx+"
    ].includes(flags || "") && existsSync1(path)) {
        throw new Error(`EEXIST: file already exists, open '${path}'`);
    }
    return Deno.openSync(path, convertFlagAndModeToOptions(flags, mode)).rid;
}
function asyncIterableToCallback(iter, callback) {
    const iterator = iter[Symbol.asyncIterator]();
    function next() {
        iterator.next().then((obj)=>{
            if (obj.done) {
                callback(obj.value, true);
                return;
            }
            callback(obj.value);
            next();
        });
    }
    next();
}
function watch(filename, optionsOrListener, optionsOrListener2) {
    const listener = typeof optionsOrListener === "function" ? optionsOrListener : typeof optionsOrListener2 === "function" ? optionsOrListener2 : undefined;
    const options = typeof optionsOrListener === "object" ? optionsOrListener : typeof optionsOrListener2 === "object" ? optionsOrListener2 : undefined;
    filename = filename instanceof URL ? fromFileUrl2(filename) : filename;
    const iterator = Deno.watchFs(filename, {
        recursive: options?.recursive || false
    });
    if (!listener) throw new Error("No callback function supplied");
    const fsWatcher = new FSWatcher(()=>{
        if (iterator.return) iterator.return();
    });
    fsWatcher.on("change", listener);
    asyncIterableToCallback(iterator, (val, done)=>{
        if (done) return;
        fsWatcher.emit("change", val.kind, val.paths[0]);
    });
    return fsWatcher;
}
class FSWatcher extends EventEmitter {
    close;
    constructor(closer){
        super();
        this.close = closer;
    }
    ref() {
        notImplemented("FSWatcher.ref() is not implemented");
    }
    unref() {
        notImplemented("FSWatcher.unref() is not implemented");
    }
}
function toDirent(val) {
    return new Dirent(val);
}
function readdir(path, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : null;
    const result = [];
    path = path instanceof URL ? fromFileUrl2(path) : path;
    if (!callback) throw new Error("No callback function supplied");
    if (options?.encoding) {
        try {
            new TextDecoder(options.encoding);
        } catch  {
            throw new Error(`TypeError [ERR_INVALID_OPT_VALUE_ENCODING]: The value "${options.encoding}" is invalid for option "encoding"`);
        }
    }
    try {
        asyncIterableToCallback(Deno.readDir(path), (val, done)=>{
            if (typeof path !== "string") return;
            if (done) {
                callback(null, result);
                return;
            }
            if (options?.withFileTypes) {
                result.push(toDirent(val));
            } else result.push(decode3(val.name));
        });
    } catch (error) {
        callback(error);
    }
}
function decode3(str, encoding) {
    if (!encoding) return str;
    else {
        const decoder = new TextDecoder(encoding);
        const encoder = new TextEncoder();
        return decoder.decode(encoder.encode(str));
    }
}
function readdirSync(path, options) {
    const result = [];
    path = path instanceof URL ? fromFileUrl2(path) : path;
    if (options?.encoding) {
        try {
            new TextDecoder(options.encoding);
        } catch  {
            throw new Error(`TypeError [ERR_INVALID_OPT_VALUE_ENCODING]: The value "${options.encoding}" is invalid for option "encoding"`);
        }
    }
    for (const file of Deno.readDirSync(path)){
        if (options?.withFileTypes) {
            result.push(toDirent(file));
        } else result.push(decode3(file.name));
    }
    return result;
}
function maybeDecode(data, encoding) {
    const buffer = new Buffer(data.buffer, data.byteOffset, data.byteLength);
    if (encoding && encoding !== "binary") return buffer.toString(encoding);
    return buffer;
}
function readFile(path, optOrCallback, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    let cb;
    if (typeof optOrCallback === "function") {
        cb = optOrCallback;
    } else {
        cb = callback;
    }
    const encoding = getEncoding(optOrCallback);
    const p = Deno.readFile(path);
    if (cb) {
        p.then((data)=>{
            if (encoding && encoding !== "binary") {
                const text = maybeDecode(data, encoding);
                return cb(null, text);
            }
            const buffer = maybeDecode(data, encoding);
            cb(null, buffer);
        }, (err)=>cb && cb(err));
    }
}
function readFileSync(path, opt) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    const data = Deno.readFileSync(path);
    const encoding = getEncoding(opt);
    if (encoding && encoding !== "binary") {
        const text = maybeDecode(data, encoding);
        return text;
    }
    const buffer = maybeDecode(data, encoding);
    return buffer;
}
function maybeEncode(data, encoding) {
    if (encoding === "buffer") {
        return new TextEncoder().encode(data);
    }
    return data;
}
function getEncoding1(optOrCallback) {
    if (!optOrCallback || typeof optOrCallback === "function") {
        return null;
    } else {
        if (optOrCallback.encoding) {
            if (optOrCallback.encoding === "utf8" || optOrCallback.encoding === "utf-8") {
                return "utf8";
            } else if (optOrCallback.encoding === "buffer") {
                return "buffer";
            } else {
                notImplemented();
            }
        }
        return null;
    }
}
function readlink(path, optOrCallback, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    let cb;
    if (typeof optOrCallback === "function") {
        cb = optOrCallback;
    } else {
        cb = callback;
    }
    const encoding = getEncoding1(optOrCallback);
    intoCallbackAPIWithIntercept(Deno.readLink, (data)=>maybeEncode(data, encoding), cb, path);
}
function readlinkSync(path, opt) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    return maybeEncode(Deno.readLinkSync(path), getEncoding1(opt));
}
function realpath(path, options, callback) {
    if (typeof options === "function") {
        callback = options;
    }
    if (!callback) {
        throw new Error("No callback function supplied");
    }
    Deno.realPath(path).then((path)=>callback(null, path), (err)=>callback(err));
}
function realpathSync(path) {
    return Deno.realPathSync(path);
}
function rename(oldPath, newPath, callback) {
    oldPath = oldPath instanceof URL ? fromFileUrl2(oldPath) : oldPath;
    newPath = newPath instanceof URL ? fromFileUrl2(newPath) : newPath;
    if (!callback) throw new Error("No callback function supplied");
    Deno.rename(oldPath, newPath).then((_)=>callback(), callback);
}
function renameSync(oldPath, newPath) {
    oldPath = oldPath instanceof URL ? fromFileUrl2(oldPath) : oldPath;
    newPath = newPath instanceof URL ? fromFileUrl2(newPath) : newPath;
    Deno.renameSync(oldPath, newPath);
}
function rmdir(path, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : undefined;
    if (!callback) throw new Error("No callback function supplied");
    Deno.remove(path, {
        recursive: options?.recursive
    }).then((_)=>callback(), callback);
}
function rmdirSync(path, options) {
    Deno.removeSync(path, {
        recursive: options?.recursive
    });
}
function symlink(target, path, typeOrCallback, maybeCallback) {
    target = target instanceof URL ? fromFileUrl2(target) : target;
    path = path instanceof URL ? fromFileUrl2(path) : path;
    const type = typeof typeOrCallback === "string" ? typeOrCallback : "file";
    const callback = typeof typeOrCallback === "function" ? typeOrCallback : maybeCallback;
    if (!callback) throw new Error("No callback function supplied");
    Deno.symlink(target, path, {
        type
    }).then(()=>callback(null), callback);
}
function symlinkSync(target, path, type) {
    target = target instanceof URL ? fromFileUrl2(target) : target;
    path = path instanceof URL ? fromFileUrl2(path) : path;
    type = type || "file";
    Deno.symlinkSync(target, path, {
        type
    });
}
function truncate(path, lenOrCallback, maybeCallback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    const len = typeof lenOrCallback === "number" ? lenOrCallback : undefined;
    const callback = typeof lenOrCallback === "function" ? lenOrCallback : maybeCallback;
    if (!callback) throw new Error("No callback function supplied");
    Deno.truncate(path, len).then(()=>callback(null), callback);
}
function truncateSync(path, len) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    Deno.truncateSync(path, len);
}
function unlink(path, callback) {
    if (!callback) throw new Error("No callback function supplied");
    Deno.remove(path).then((_)=>callback(), callback);
}
function unlinkSync(path) {
    Deno.removeSync(path);
}
function getValidTime1(time, name) {
    if (typeof time === "string") {
        time = Number(time);
    }
    if (typeof time === "number" && (Number.isNaN(time) || !Number.isFinite(time))) {
        throw new Deno.errors.InvalidData(`invalid ${name}, must not be infitiny or NaN`);
    }
    return time;
}
function utimes(path, atime, mtime, callback) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    if (!callback) {
        throw new Deno.errors.InvalidData("No callback function supplied");
    }
    atime = getValidTime1(atime, "atime");
    mtime = getValidTime1(mtime, "mtime");
    Deno.utime(path, atime, mtime).then(()=>callback(null), callback);
}
function utimesSync(path, atime, mtime) {
    path = path instanceof URL ? fromFileUrl2(path) : path;
    atime = getValidTime1(atime, "atime");
    mtime = getValidTime1(mtime, "mtime");
    Deno.utimeSync(path, atime, mtime);
}
function writeFile(pathOrRid, data, optOrCallback, callback) {
    const callbackFn = optOrCallback instanceof Function ? optOrCallback : callback;
    const options = optOrCallback instanceof Function ? undefined : optOrCallback;
    if (!callbackFn) {
        throw new TypeError("Callback must be a function.");
    }
    pathOrRid = pathOrRid instanceof URL ? fromFileUrl2(pathOrRid) : pathOrRid;
    const flag = isFileOptions(options) ? options.flag : undefined;
    const mode = isFileOptions(options) ? options.mode : undefined;
    const encoding = checkEncoding1(getEncoding(options)) || "utf8";
    const openOptions = getOpenOptions(flag || "w");
    if (typeof data === "string") data = Buffer.from(data, encoding);
    const isRid = typeof pathOrRid === "number";
    let file;
    let error = null;
    (async ()=>{
        try {
            file = isRid ? new Deno.File(pathOrRid) : await Deno.open(pathOrRid, openOptions);
            if (!isRid && mode) {
                if (Deno.build.os === "windows") notImplemented(`"mode" on Windows`);
                await Deno.chmod(pathOrRid, mode);
            }
            await writeAll(file, data);
        } catch (e) {
            error = e;
        } finally{
            if (!isRid && file) file.close();
            callbackFn(error);
        }
    })();
}
function writeFileSync(pathOrRid, data, options) {
    pathOrRid = pathOrRid instanceof URL ? fromFileUrl2(pathOrRid) : pathOrRid;
    const flag = isFileOptions(options) ? options.flag : undefined;
    const mode = isFileOptions(options) ? options.mode : undefined;
    const encoding = checkEncoding1(getEncoding(options)) || "utf8";
    const openOptions = getOpenOptions(flag || "w");
    if (typeof data === "string") data = Buffer.from(data, encoding);
    const isRid = typeof pathOrRid === "number";
    let file;
    let error = null;
    try {
        file = isRid ? new Deno.File(pathOrRid) : Deno.openSync(pathOrRid, openOptions);
        if (!isRid && mode) {
            if (Deno.build.os === "windows") notImplemented(`"mode" on Windows`);
            Deno.chmodSync(pathOrRid, mode);
        }
        writeAllSync(file, data);
    } catch (e) {
        error = e;
    } finally{
        if (!isRid && file) file.close();
    }
    if (error) throw error;
}
function writeFile1(pathOrRid, data, options) {
    return new Promise((resolve, reject)=>{
        writeFile(pathOrRid, data, options, (err)=>{
            if (err) return reject(err);
            resolve();
        });
    });
}
function readFile1(path, options) {
    return new Promise((resolve, reject)=>{
        readFile(path, options, (err, data)=>{
            if (err) return reject(err);
            if (data == null) {
                return reject(new Error("Invalid state: data missing, but no error"));
            }
            resolve(data);
        });
    });
}
const mod6 = {
    writeFile: writeFile1,
    readFile: readFile1
};
const __default8 = {
    access,
    accessSync,
    appendFile,
    appendFileSync,
    chmod,
    chmodSync,
    chown,
    chownSync,
    close,
    closeSync,
    constants: mod5,
    copyFile,
    copyFileSync,
    Dir,
    Dirent,
    exists,
    existsSync,
    fdatasync,
    fdatasyncSync,
    fstat,
    fstatSync,
    fsync,
    fsyncSync,
    ftruncate,
    ftruncateSync,
    futimes,
    futimesSync,
    link,
    linkSync,
    lstat,
    lstatSync,
    mkdir,
    mkdirSync,
    mkdtemp,
    mkdtempSync,
    open,
    openSync,
    promises: mod6,
    readdir,
    readdirSync,
    readFile,
    readFileSync,
    readlink,
    readlinkSync,
    realpath,
    realpathSync,
    rename,
    renameSync,
    rmdir,
    rmdirSync,
    stat,
    statSync,
    symlink,
    symlinkSync,
    truncate,
    truncateSync,
    unlink,
    unlinkSync,
    utimes,
    utimesSync,
    watch,
    writeFile,
    writeFileSync
};
var EOL;
(function(EOL) {
    EOL["LF"] = "\n";
    EOL["CRLF"] = "\r\n";
})(EOL || (EOL = {}));
const SEE_GITHUB_ISSUE = "See https://github.com/denoland/deno/issues/3802";
arch1[Symbol.toPrimitive] = ()=>arch1();
endianness[Symbol.toPrimitive] = ()=>endianness();
freemem[Symbol.toPrimitive] = ()=>freemem();
homedir[Symbol.toPrimitive] = ()=>homedir();
hostname[Symbol.toPrimitive] = ()=>hostname();
platform1[Symbol.toPrimitive] = ()=>platform1();
release[Symbol.toPrimitive] = ()=>release();
totalmem[Symbol.toPrimitive] = ()=>totalmem();
type[Symbol.toPrimitive] = ()=>type();
uptime[Symbol.toPrimitive] = ()=>uptime();
function arch1() {
    return Deno.build.arch;
}
function cpus() {
    notImplemented(SEE_GITHUB_ISSUE);
}
function endianness() {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256 ? "LE" : "BE";
}
function freemem() {
    return Deno.systemMemoryInfo().free;
}
function getPriority(pid = 0) {
    validateIntegerRange(pid, "pid");
    notImplemented(SEE_GITHUB_ISSUE);
}
function homedir() {
    switch(Deno.build.os){
        case "windows":
            return Deno.env.get("USERPROFILE") || null;
        case "linux":
        case "darwin":
            return Deno.env.get("HOME") || null;
        default:
            throw Error("unreachable");
    }
}
function hostname() {
    notImplemented(SEE_GITHUB_ISSUE);
}
function loadavg() {
    if (Deno.build.os === "windows") {
        return [
            0,
            0,
            0
        ];
    }
    return Deno.loadavg();
}
function networkInterfaces() {
    notImplemented(SEE_GITHUB_ISSUE);
}
function platform1() {
    return process.platform;
}
function release() {
    return Deno.osRelease();
}
function setPriority(pid, priority) {
    if (priority === undefined) {
        priority = pid;
        pid = 0;
    }
    validateIntegerRange(pid, "pid");
    validateIntegerRange(priority, "priority", -20, 19);
    notImplemented(SEE_GITHUB_ISSUE);
}
function tmpdir() {
    notImplemented(SEE_GITHUB_ISSUE);
}
function totalmem() {
    return Deno.systemMemoryInfo().total;
}
function type() {
    switch(Deno.build.os){
        case "windows":
            return "Windows_NT";
        case "linux":
            return "Linux";
        case "darwin":
            return "Darwin";
        default:
            throw Error("unreachable");
    }
}
function uptime() {
    notImplemented(SEE_GITHUB_ISSUE);
}
function userInfo(options = {
    encoding: "utf-8"
}) {
    notImplemented(SEE_GITHUB_ISSUE);
}
const constants = {
    dlopen: {},
    errno: {},
    signals: Deno.Signal,
    priority: {}
};
const EOL1 = Deno.build.os == "windows" ? EOL.CRLF : EOL.LF;
const __default9 = {
    arch: arch1,
    cpus,
    endianness,
    freemem,
    getPriority,
    homedir,
    hostname,
    loadavg,
    networkInterfaces,
    platform: platform1,
    release,
    setPriority,
    tmpdir,
    totalmem,
    type,
    uptime,
    userInfo,
    constants,
    EOL: EOL1
};
const __default10 = {
    ...mod5,
    ...constants.dlopen,
    ...constants.errno,
    ...constants.signals,
    ...constants.priority
};
const MIN_BUF_SIZE = 16;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
class BufferFullError extends Error {
    name;
    constructor(partial){
        super("Buffer full");
        this.partial = partial;
        this.name = "BufferFullError";
    }
    partial;
}
class PartialReadError extends Error {
    name = "PartialReadError";
    partial;
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader {
    buf;
    rd;
    r = 0;
    w = 0;
    eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd, size = 4096){
        if (size < 16) {
            size = MIN_BUF_SIZE;
        }
        this._reset(new Uint8Array(size), rd);
    }
    size() {
        return this.buf.byteLength;
    }
    buffered() {
        return this.w - this.r;
    }
    async _fill() {
        if (this.r > 0) {
            this.buf.copyWithin(0, this.r, this.w);
            this.w -= this.r;
            this.r = 0;
        }
        if (this.w >= this.buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.rd.read(this.buf.subarray(this.w));
            if (rr === null) {
                this.eof = true;
                return;
            }
            assert1(rr >= 0, "negative read");
            this.w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    }
    reset(r) {
        this._reset(this.buf, r);
    }
    _reset(buf, rd) {
        this.buf = buf;
        this.rd = rd;
        this.eof = false;
    }
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.r === this.w) {
            if (p.byteLength >= this.buf.byteLength) {
                const rr1 = await this.rd.read(p);
                const nread = rr1 ?? 0;
                assert1(nread >= 0, "negative read");
                return rr1;
            }
            this.r = 0;
            this.w = 0;
            rr = await this.rd.read(this.buf);
            if (rr === 0 || rr === null) return rr;
            assert1(rr >= 0, "negative read");
            this.w += rr;
        }
        const copied = copy(this.buf.subarray(this.r, this.w), p, 0);
        this.r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                err.partial = p.subarray(0, bytesRead);
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.r === this.w){
            if (this.eof) return null;
            await this._fill();
        }
        const c = this.buf[this.r];
        this.r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line;
        try {
            line = await this.readSlice(LF);
        } catch (err) {
            if (err instanceof Deno.errors.BadResource) {
                throw err;
            }
            let { partial  } = err;
            assert1(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            if (!this.eof && partial.byteLength > 0 && partial[partial.byteLength - 1] === CR) {
                assert1(this.r > 0, "bufio: tried to rewind past start of buffer");
                this.r--;
                partial = partial.subarray(0, partial.byteLength - 1);
            }
            return {
                line: partial,
                more: !this.eof
            };
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.buf.subarray(this.r + s, this.w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.buf.subarray(this.r, this.r + i + 1);
                this.r += i + 1;
                break;
            }
            if (this.eof) {
                if (this.r === this.w) {
                    return null;
                }
                slice = this.buf.subarray(this.r, this.w);
                this.r = this.w;
                break;
            }
            if (this.buffered() >= this.buf.byteLength) {
                this.r = this.w;
                const oldbuf = this.buf;
                const newbuf = this.buf.slice(0);
                this.buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.w - this.r;
            try {
                await this._fill();
            } catch (err) {
                err.partial = slice;
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.w - this.r;
        while(avail < n && avail < this.buf.byteLength && !this.eof){
            try {
                await this._fill();
            } catch (err) {
                err.partial = this.buf.subarray(this.r, this.w);
                throw err;
            }
            avail = this.w - this.r;
        }
        if (avail === 0 && this.eof) {
            return null;
        } else if (avail < n && this.eof) {
            return this.buf.subarray(this.r, this.r + avail);
        } else if (avail < n) {
            throw new BufferFullError(this.buf.subarray(this.r, this.w));
        }
        return this.buf.subarray(this.r, this.r + n);
    }
}
async function* readLines(reader, decoderOpts) {
    const bufReader = new BufReader(reader);
    let chunks = [];
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    while(true){
        const res = await bufReader.readLine();
        if (!res) {
            if (chunks.length > 0) {
                yield decoder.decode(concat(...chunks));
            }
            break;
        }
        chunks.push(res.line);
        if (!res.more) {
            yield decoder.decode(concat(...chunks));
            chunks = [];
        }
    }
}
class ChildProcess extends EventEmitter {
    exitCode = null;
    killed = false;
    pid;
    spawnargs;
    spawnfile;
    stdin = null;
    stdout = null;
    stderr = null;
    stdio = [
        null,
        null,
        null
    ];
    #process;
    #spawned = deferred();
    constructor(command, args, options){
        super();
        const { env ={} , stdio =[
            "pipe",
            "pipe",
            "pipe"
        ] , shell =false  } = options || {};
        const [stdin = "pipe", stdout = "pipe", stderr = "pipe"] = normalizeStdioOption(stdio);
        const cmd = buildCommand(command, args || [], shell);
        this.spawnfile = cmd[0];
        this.spawnargs = cmd;
        try {
            this.#process = Deno.run({
                cmd,
                env,
                stdin: toDenoStdio(stdin),
                stdout: toDenoStdio(stdout),
                stderr: toDenoStdio(stderr)
            });
            this.pid = this.#process.pid;
            if (stdin === "pipe") {
                assert1(this.#process.stdin);
                this.stdin = createWritableFromStdin(this.#process.stdin);
            }
            if (stdout === "pipe") {
                assert1(this.#process.stdout);
                this.stdout = createReadableFromReader(this.#process.stdout);
            }
            if (stderr === "pipe") {
                assert1(this.#process.stderr);
                this.stderr = createReadableFromReader(this.#process.stderr);
            }
            this.stdio[0] = this.stdin;
            this.stdio[1] = this.stdout;
            this.stdio[2] = this.stderr;
            queueMicrotask(()=>{
                this.emit("spawn");
                this.#spawned.resolve();
            });
            (async ()=>{
                const status = await this.#process.status();
                this.exitCode = status.code;
                this.#spawned.then(async ()=>{
                    this.emit("exit", this.exitCode, status.signal ?? null);
                    await this._waitForChildStreamsToClose();
                    this.kill();
                    this.emit("close", this.exitCode, status.signal ?? null);
                });
            })();
        } catch (err) {
            this._handleError(err);
        }
    }
    kill(signal) {
        if (signal != null) {
            notImplemented("`ChildProcess.kill()` with the `signal` parameter");
        }
        if (this.killed) {
            return this.killed;
        }
        if (this.#process.stdin) {
            assert1(this.stdin);
            ensureClosed(this.#process.stdin);
        }
        if (this.#process.stdout) {
            ensureClosed(this.#process.stdout);
        }
        if (this.#process.stderr) {
            ensureClosed(this.#process.stderr);
        }
        ensureClosed(this.#process);
        this.killed = true;
        return this.killed;
    }
    ref() {
        notImplemented("ChildProcess.ref()");
    }
    unref() {
        notImplemented("ChildProcess.unref()");
    }
    async _waitForChildStreamsToClose() {
        const promises = [];
        if (this.stdin && !this.stdin.destroyed) {
            assert1(this.stdin);
            this.stdin.destroy();
            promises.push(waitForStreamToClose(this.stdin));
        }
        if (this.stdout && !this.stdout.destroyed) {
            promises.push(waitForReadableToClose(this.stdout));
        }
        if (this.stderr && !this.stderr.destroyed) {
            promises.push(waitForReadableToClose(this.stderr));
        }
        await Promise.all(promises);
    }
    _handleError(err) {
        queueMicrotask(()=>{
            this.emit("error", err);
        });
    }
}
const supportedNodeStdioTypes = [
    "pipe",
    "ignore",
    "inherit"
];
function toDenoStdio(pipe) {
    if (!supportedNodeStdioTypes.includes(pipe) || typeof pipe === "number" || pipe instanceof Stream) {
        notImplemented();
    }
    switch(pipe){
        case "pipe":
        case undefined:
        case null:
            return "piped";
        case "ignore":
            return "null";
        case "inherit":
            return "inherit";
        default:
            notImplemented();
    }
}
function spawn(command, argsOrOptions, maybeOptions) {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : [];
    const options = !Array.isArray(argsOrOptions) && argsOrOptions != null ? argsOrOptions : maybeOptions;
    return new ChildProcess(command, args, options);
}
function ensureClosed(closer) {
    try {
        closer.close();
    } catch (err) {
        if (isAlreadyClosed(err)) {
            return;
        }
        throw err;
    }
}
function isAlreadyClosed(err) {
    return err instanceof Deno.errors.BadResource;
}
async function* readLinesSafely(reader) {
    try {
        for await (const line of readLines(reader)){
            yield line.length === 0 ? line : line + "\n";
        }
    } catch (err) {
        if (isAlreadyClosed(err)) {
            return;
        }
        throw err;
    }
}
function createReadableFromReader(reader) {
    return Readable.from(readLinesSafely(reader), {
        objectMode: false
    });
}
function createWritableFromStdin(stdin) {
    const encoder = new TextEncoder();
    return new Writable({
        async write (chunk, _, callback) {
            try {
                const bytes = encoder.encode(chunk);
                await stdin.write(bytes);
                callback();
            } catch (err) {
                callback(err);
            }
        },
        final (callback) {
            try {
                ensureClosed(stdin);
            } catch (err) {
                callback(err);
            }
        }
    });
}
function normalizeStdioOption(stdio = [
    "pipe",
    "pipe",
    "pipe"
]) {
    if (Array.isArray(stdio)) {
        if (stdio.length > 3) {
            notImplemented();
        } else {
            return stdio;
        }
    } else {
        switch(stdio){
            case "overlapped":
                if (Deno.build.os === "windows") {
                    notImplemented();
                }
                return [
                    "pipe",
                    "pipe",
                    "pipe"
                ];
            case "pipe":
                return [
                    "pipe",
                    "pipe",
                    "pipe"
                ];
            case "inherit":
                return [
                    "inherit",
                    "inherit",
                    "inherit"
                ];
            case "ignore":
                return [
                    "ignore",
                    "ignore",
                    "ignore"
                ];
            default:
                notImplemented();
        }
    }
}
function waitForReadableToClose(readable) {
    readable.resume();
    return waitForStreamToClose(readable);
}
function waitForStreamToClose(stream) {
    const promise = deferred();
    const cleanup = ()=>{
        stream.removeListener("close", onClose);
        stream.removeListener("error", onError);
    };
    const onClose = ()=>{
        cleanup();
        promise.resolve();
    };
    const onError = (err)=>{
        cleanup();
        promise.reject(err);
    };
    stream.once("close", onClose);
    stream.once("error", onError);
    return promise;
}
function buildCommand(file, args, shell) {
    const command = [
        file,
        ...args
    ].join(" ");
    if (shell) {
        if (Deno.build.os === "windows") {
            if (typeof shell === "string") {
                file = shell;
            } else {
                file = Deno.env.get("comspec") || "cmd.exe";
            }
            if (/^(?:.*\\)?cmd(?:\.exe)?$/i.test(file)) {
                args = [
                    "/d",
                    "/s",
                    "/c",
                    `"${command}"`
                ];
            } else {
                args = [
                    "-c",
                    command
                ];
            }
        } else {
            if (typeof shell === "string") {
                file = shell;
            } else {
                file = "/bin/sh";
            }
            args = [
                "-c",
                command
            ];
        }
    }
    return [
        file,
        ...args
    ];
}
const __default11 = {
    spawn
};
const hexTable1 = new Array(256);
for(let i = 0; i < 256; ++i){
    hexTable1[i] = "%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase();
}
function parse3(str, sep = "&", eq = "=", { decodeURIComponent: decodeURIComponent1 = unescape , maxKeys =1000  } = {}) {
    const entries = str.split(sep).map((entry)=>entry.split(eq).map(decodeURIComponent1));
    const __final = {};
    let i = 0;
    while(true){
        if (Object.keys(__final).length === maxKeys && !!maxKeys || !entries[i]) {
            break;
        }
        const [key, val] = entries[i];
        if (__final[key]) {
            if (Array.isArray(__final[key])) {
                __final[key].push(val);
            } else {
                __final[key] = [
                    __final[key],
                    val
                ];
            }
        } else {
            __final[key] = val;
        }
        i++;
    }
    return __final;
}
function encodeStr(str, noEscapeTable, hexTable) {
    const len = str.length;
    if (len === 0) return "";
    let out = "";
    let lastPos = 0;
    for(let i = 0; i < len; i++){
        let c = str.charCodeAt(i);
        if (c < 0x80) {
            if (noEscapeTable[c] === 1) continue;
            if (lastPos < i) out += str.slice(lastPos, i);
            lastPos = i + 1;
            out += hexTable[c];
            continue;
        }
        if (lastPos < i) out += str.slice(lastPos, i);
        if (c < 0x800) {
            lastPos = i + 1;
            out += hexTable[0xc0 | c >> 6] + hexTable[0x80 | c & 0x3f];
            continue;
        }
        if (c < 0xd800 || c >= 0xe000) {
            lastPos = i + 1;
            out += hexTable[0xe0 | c >> 12] + hexTable[0x80 | c >> 6 & 0x3f] + hexTable[0x80 | c & 0x3f];
            continue;
        }
        ++i;
        if (i >= len) throw new Deno.errors.InvalidData("invalid URI");
        const c2 = str.charCodeAt(i) & 0x3ff;
        lastPos = i + 1;
        c = 0x10000 + ((c & 0x3ff) << 10 | c2);
        out += hexTable[0xf0 | c >> 18] + hexTable[0x80 | c >> 12 & 0x3f] + hexTable[0x80 | c >> 6 & 0x3f] + hexTable[0x80 | c & 0x3f];
    }
    if (lastPos === 0) return str;
    if (lastPos < len) return out + str.slice(lastPos);
    return out;
}
function stringify(obj, sep = "&", eq = "=", { encodeURIComponent: encodeURIComponent1 = escape  } = {}) {
    const __final = [];
    for (const entry of Object.entries(obj)){
        if (Array.isArray(entry[1])) {
            for (const val of entry[1]){
                __final.push(encodeURIComponent1(entry[0]) + eq + encodeURIComponent1(val));
            }
        } else if (typeof entry[1] !== "object" && entry[1] !== undefined) {
            __final.push(entry.map(encodeURIComponent1).join(eq));
        } else {
            __final.push(encodeURIComponent1(entry[0]) + eq);
        }
    }
    return __final.join(sep);
}
const decode4 = parse3;
const encode2 = stringify;
const unescape = decodeURIComponent;
const escape = encodeURIComponent;
const __default12 = {
    parse: parse3,
    encodeStr,
    stringify,
    hexTable: hexTable1,
    decode: decode4,
    encode: encode2,
    unescape,
    escape
};
function isatty(fd) {
    if (typeof fd !== "number") {
        return false;
    }
    try {
        return Deno.isatty(fd);
    } catch (_) {
        return false;
    }
}
const __default13 = {
    isatty
};
const forwardSlashRegEx = /\//g;
const percentRegEx = /%/g;
const backslashRegEx = /\\/g;
const newlineRegEx = /\n/g;
const carriageReturnRegEx = /\r/g;
const tabRegEx = /\t/g;
URL;
function fileURLToPath(path) {
    if (typeof path === "string") path = new URL(path);
    else if (!(path instanceof URL)) {
        throw new Deno.errors.InvalidData("invalid argument path , must be a string or URL");
    }
    if (path.protocol !== "file:") {
        throw new Deno.errors.InvalidData("invalid url scheme");
    }
    return isWindows ? getPathFromURLWin(path) : getPathFromURLPosix(path);
}
function getPathFromURLWin(url) {
    const hostname = url.hostname;
    let pathname = url.pathname;
    for(let n = 0; n < pathname.length; n++){
        if (pathname[n] === "%") {
            const third = pathname.codePointAt(n + 2) || 0x20;
            if (pathname[n + 1] === "2" && third === 102 || pathname[n + 1] === "5" && third === 99) {
                throw new Deno.errors.InvalidData("must not include encoded \\ or / characters");
            }
        }
    }
    pathname = pathname.replace(forwardSlashRegEx, "\\");
    pathname = decodeURIComponent(pathname);
    if (hostname !== "") {
        return `\\\\${hostname}${pathname}`;
    } else {
        const letter = pathname.codePointAt(1) | 0x20;
        const sep = pathname[2];
        if (letter < 97 || letter > 122 || sep !== ":") {
            throw new Deno.errors.InvalidData("file url path must be absolute");
        }
        return pathname.slice(1);
    }
}
function getPathFromURLPosix(url) {
    if (url.hostname !== "") {
        throw new Deno.errors.InvalidData("invalid file url hostname");
    }
    const pathname = url.pathname;
    for(let n = 0; n < pathname.length; n++){
        if (pathname[n] === "%") {
            const third = pathname.codePointAt(n + 2) || 0x20;
            if (pathname[n + 1] === "2" && third === 102) {
                throw new Deno.errors.InvalidData("must not include encoded / characters");
            }
        }
    }
    return decodeURIComponent(pathname);
}
function pathToFileURL(filepath) {
    let resolved = resolve2(filepath);
    const filePathLast = filepath.charCodeAt(filepath.length - 1);
    if ((filePathLast === 47 || isWindows && filePathLast === 92) && resolved[resolved.length - 1] !== sep2) {
        resolved += "/";
    }
    const outURL = new URL("file://");
    if (resolved.includes("%")) resolved = resolved.replace(percentRegEx, "%25");
    if (!isWindows && resolved.includes("\\")) {
        resolved = resolved.replace(backslashRegEx, "%5C");
    }
    if (resolved.includes("\n")) resolved = resolved.replace(newlineRegEx, "%0A");
    if (resolved.includes("\r")) {
        resolved = resolved.replace(carriageReturnRegEx, "%0D");
    }
    if (resolved.includes("\t")) resolved = resolved.replace(tabRegEx, "%09");
    outURL.pathname = resolved;
    return outURL;
}
const __default14 = {
    fileURLToPath,
    pathToFileURL,
    URL
};
const CHAR_FORWARD_SLASH1 = "/".charCodeAt(0);
const CHAR_BACKWARD_SLASH = "\\".charCodeAt(0);
const CHAR_COLON = ":".charCodeAt(0);
const relativeResolveCache = Object.create(null);
let requireDepth = 0;
let statCache = null;
function stat1(filename) {
    filename = toNamespacedPath2(filename);
    if (statCache !== null) {
        const result = statCache.get(filename);
        if (result !== undefined) return result;
    }
    try {
        const info = Deno.statSync(filename);
        const result1 = info.isFile ? 0 : 1;
        if (statCache !== null) statCache.set(filename, result1);
        return result1;
    } catch (e) {
        if (e instanceof Deno.errors.PermissionDenied) {
            throw new Error("CJS loader requires --allow-read.");
        }
        return -1;
    }
}
function updateChildren(parent, child, scan) {
    const children = parent && parent.children;
    if (children && !(scan && children.includes(child))) {
        children.push(child);
    }
}
class Module {
    id;
    exports;
    parent;
    filename;
    loaded;
    children;
    paths;
    path;
    constructor(id = "", parent){
        this.id = id;
        this.exports = {};
        this.parent = parent || null;
        updateChildren(parent || null, this, false);
        this.filename = null;
        this.loaded = false;
        this.children = [];
        this.paths = [];
        this.path = dirname2(id);
    }
    static builtinModules = [];
    static _extensions = Object.create(null);
    static _cache = Object.create(null);
    static _pathCache = Object.create(null);
    static globalPaths = [];
    static wrapper = [
        "(function (exports, require, module, __filename, __dirname) { ",
        "\n});"
    ];
    require(id) {
        if (id === "") {
            throw new Error(`id '${id}' must be a non-empty string`);
        }
        requireDepth++;
        try {
            return Module._load(id, this, false);
        } finally{
            requireDepth--;
        }
    }
    load(filename) {
        assert1(!this.loaded);
        this.filename = filename;
        this.paths = Module._nodeModulePaths(dirname2(filename));
        const extension = findLongestRegisteredExtension(filename);
        Module._extensions[extension](this, filename);
        this.loaded = true;
    }
    _compile(content, filename) {
        const compiledWrapper = wrapSafe(filename, content);
        const dirname = dirname2(filename);
        const require = makeRequireFunction(this);
        const exports = this.exports;
        const thisValue = exports;
        if (requireDepth === 0) {
            statCache = new Map();
        }
        const result = compiledWrapper.call(thisValue, exports, require, this, filename, dirname);
        if (requireDepth === 0) {
            statCache = null;
        }
        return result;
    }
    static _resolveLookupPaths(request, parent) {
        if (request.charAt(0) !== "." || request.length > 1 && request.charAt(1) !== "." && request.charAt(1) !== "/" && (!isWindows || request.charAt(1) !== "\\")) {
            let paths = modulePaths;
            if (parent !== null && parent.paths && parent.paths.length) {
                paths = parent.paths.concat(paths);
            }
            return paths.length > 0 ? paths : null;
        }
        if (!parent || !parent.id || !parent.filename) {
            return [
                "."
            ].concat(Module._nodeModulePaths("."), modulePaths);
        }
        return [
            dirname2(parent.filename)
        ];
    }
    static _resolveFilename(request, parent, isMain, options) {
        if (nativeModuleCanBeRequiredByUsers(request)) {
            return request;
        }
        let paths;
        if (typeof options === "object" && options !== null) {
            if (Array.isArray(options.paths)) {
                const isRelative = request.startsWith("./") || request.startsWith("../") || isWindows && request.startsWith(".\\") || request.startsWith("..\\");
                if (isRelative) {
                    paths = options.paths;
                } else {
                    const fakeParent = new Module("", null);
                    paths = [];
                    for(let i = 0; i < options.paths.length; i++){
                        const path = options.paths[i];
                        fakeParent.paths = Module._nodeModulePaths(path);
                        const lookupPaths = Module._resolveLookupPaths(request, fakeParent);
                        for(let j = 0; j < lookupPaths.length; j++){
                            if (!paths.includes(lookupPaths[j])) {
                                paths.push(lookupPaths[j]);
                            }
                        }
                    }
                }
            } else if (options.paths === undefined) {
                paths = Module._resolveLookupPaths(request, parent);
            } else {
                throw new Error("options.paths is invalid");
            }
        } else {
            paths = Module._resolveLookupPaths(request, parent);
        }
        const filename = Module._findPath(request, paths, isMain);
        if (!filename) {
            const requireStack = [];
            for(let cursor = parent; cursor; cursor = cursor.parent){
                requireStack.push(cursor.filename || cursor.id);
            }
            let message = `Cannot find module '${request}'`;
            if (requireStack.length > 0) {
                message = message + "\nRequire stack:\n- " + requireStack.join("\n- ");
            }
            const err = new Error(message);
            err.code = "MODULE_NOT_FOUND";
            err.requireStack = requireStack;
            throw err;
        }
        return filename;
    }
    static _findPath(request, paths, isMain) {
        const absoluteRequest = isAbsolute2(request);
        if (absoluteRequest) {
            paths = [
                ""
            ];
        } else if (!paths || paths.length === 0) {
            return false;
        }
        const cacheKey = request + "\x00" + (paths.length === 1 ? paths[0] : paths.join("\x00"));
        const entry = Module._pathCache[cacheKey];
        if (entry) {
            return entry;
        }
        let exts;
        let trailingSlash = request.length > 0 && request.charCodeAt(request.length - 1) === CHAR_FORWARD_SLASH1;
        if (!trailingSlash) {
            trailingSlash = /(?:^|\/)\.?\.$/.test(request);
        }
        for(let i = 0; i < paths.length; i++){
            const curPath = paths[i];
            if (curPath && stat1(curPath) < 1) continue;
            const basePath = resolveExports(curPath, request, absoluteRequest);
            let filename;
            const rc = stat1(basePath);
            if (!trailingSlash) {
                if (rc === 0) {
                    filename = toRealPath(basePath);
                }
                if (!filename) {
                    if (exts === undefined) exts = Object.keys(Module._extensions);
                    filename = tryExtensions(basePath, exts, isMain);
                }
            }
            if (!filename && rc === 1) {
                if (exts === undefined) exts = Object.keys(Module._extensions);
                filename = tryPackage(basePath, exts, isMain, request);
            }
            if (filename) {
                Module._pathCache[cacheKey] = filename;
                return filename;
            }
        }
        return false;
    }
    static _load(request, parent, isMain) {
        let relResolveCacheIdentifier;
        if (parent) {
            relResolveCacheIdentifier = `${parent.path}\x00${request}`;
            const filename = relativeResolveCache[relResolveCacheIdentifier];
            if (filename !== undefined) {
                const cachedModule = Module._cache[filename];
                if (cachedModule !== undefined) {
                    updateChildren(parent, cachedModule, true);
                    if (!cachedModule.loaded) {
                        return getExportsForCircularRequire(cachedModule);
                    }
                    return cachedModule.exports;
                }
                delete relativeResolveCache[relResolveCacheIdentifier];
            }
        }
        const filename1 = Module._resolveFilename(request, parent, isMain);
        const cachedModule1 = Module._cache[filename1];
        if (cachedModule1 !== undefined) {
            updateChildren(parent, cachedModule1, true);
            if (!cachedModule1.loaded) {
                return getExportsForCircularRequire(cachedModule1);
            }
            return cachedModule1.exports;
        }
        const mod = loadNativeModule(filename1, request);
        if (mod) return mod.exports;
        const module = new Module(filename1, parent);
        if (isMain) {
            module.id = ".";
        }
        Module._cache[filename1] = module;
        if (parent !== undefined) {
            assert1(relResolveCacheIdentifier);
            relativeResolveCache[relResolveCacheIdentifier] = filename1;
        }
        let threw = true;
        try {
            module.load(filename1);
            threw = false;
        } finally{
            if (threw) {
                delete Module._cache[filename1];
                if (parent !== undefined) {
                    assert1(relResolveCacheIdentifier);
                    delete relativeResolveCache[relResolveCacheIdentifier];
                }
            } else if (module.exports && Object.getPrototypeOf(module.exports) === CircularRequirePrototypeWarningProxy) {
                Object.setPrototypeOf(module.exports, PublicObjectPrototype);
            }
        }
        return module.exports;
    }
    static wrap(script) {
        script = script.replace(/^#!.*?\n/, "");
        return `${Module.wrapper[0]}${script}${Module.wrapper[1]}`;
    }
    static _nodeModulePaths(from) {
        if (isWindows) {
            from = resolve2(from);
            if (from.charCodeAt(from.length - 1) === CHAR_BACKWARD_SLASH && from.charCodeAt(from.length - 2) === CHAR_COLON) {
                return [
                    from + "node_modules"
                ];
            }
            const paths = [];
            for(let i = from.length - 1, p = 0, last = from.length; i >= 0; --i){
                const code = from.charCodeAt(i);
                if (code === CHAR_BACKWARD_SLASH || code === CHAR_FORWARD_SLASH1 || code === CHAR_COLON) {
                    if (p !== nmLen) paths.push(from.slice(0, last) + "\\node_modules");
                    last = i;
                    p = 0;
                } else if (p !== -1) {
                    if (nmChars[p] === code) {
                        ++p;
                    } else {
                        p = -1;
                    }
                }
            }
            return paths;
        } else {
            from = resolve2(from);
            if (from === "/") return [
                "/node_modules"
            ];
            const paths1 = [];
            for(let i1 = from.length - 1, p1 = 0, last1 = from.length; i1 >= 0; --i1){
                const code1 = from.charCodeAt(i1);
                if (code1 === CHAR_FORWARD_SLASH1) {
                    if (p1 !== nmLen) paths1.push(from.slice(0, last1) + "/node_modules");
                    last1 = i1;
                    p1 = 0;
                } else if (p1 !== -1) {
                    if (nmChars[p1] === code1) {
                        ++p1;
                    } else {
                        p1 = -1;
                    }
                }
            }
            paths1.push("/node_modules");
            return paths1;
        }
    }
    static createRequire(filename) {
        let filepath;
        if (filename instanceof URL || typeof filename === "string" && !isAbsolute2(filename)) {
            try {
                filepath = fileURLToPath(filename);
            } catch (err) {
                if (err instanceof Deno.errors.InvalidData && err.message.includes("invalid url scheme")) {
                    throw new Error(`${createRequire.name} only supports 'file://' URLs for the 'filename' parameter`);
                } else {
                    throw err;
                }
            }
        } else if (typeof filename !== "string") {
            throw new Error("filename should be a string");
        } else {
            filepath = filename;
        }
        return createRequireFromPath(filepath);
    }
    static _initPaths() {
        const homeDir = Deno.env.get("HOME");
        const nodePath = Deno.env.get("NODE_PATH");
        let paths = [];
        if (homeDir) {
            paths.unshift(resolve2(homeDir, ".node_libraries"));
            paths.unshift(resolve2(homeDir, ".node_modules"));
        }
        if (nodePath) {
            paths = nodePath.split(delimiter2).filter(function pathsFilterCB(path) {
                return !!path;
            }).concat(paths);
        }
        modulePaths = paths;
        Module.globalPaths = modulePaths.slice(0);
    }
    static _preloadModules(requests) {
        if (!Array.isArray(requests)) {
            return;
        }
        const parent = new Module("internal/preload", null);
        try {
            parent.paths = Module._nodeModulePaths(Deno.cwd());
        } catch (e) {
            if (e.code !== "ENOENT") {
                throw e;
            }
        }
        for(let n = 0; n < requests.length; n++){
            parent.require(requests[n]);
        }
    }
}
const nativeModulePolyfill = new Map();
function createNativeModule(id, exports) {
    const mod = new Module(id);
    mod.exports = exports;
    mod.loaded = true;
    return mod;
}
nativeModulePolyfill.set("assert", createNativeModule("assert", __default4));
nativeModulePolyfill.set("buffer", createNativeModule("buffer", __default2));
nativeModulePolyfill.set("constants", createNativeModule("constants", __default10));
nativeModulePolyfill.set("child_process", createNativeModule("child_process", __default11));
nativeModulePolyfill.set("crypto", createNativeModule("crypto", __default6));
nativeModulePolyfill.set("events", createNativeModule("events", __default1));
nativeModulePolyfill.set("fs", createNativeModule("fs", __default8));
nativeModulePolyfill.set("module", createNativeModule("module", Module));
nativeModulePolyfill.set("os", createNativeModule("os", __default9));
nativeModulePolyfill.set("path", createNativeModule("path", __default7));
nativeModulePolyfill.set("querystring", createNativeModule("querystring", __default12));
nativeModulePolyfill.set("stream", createNativeModule("stream", Stream));
nativeModulePolyfill.set("string_decoder", createNativeModule("string_decoder", __default5));
nativeModulePolyfill.set("timers", createNativeModule("timers", __default3));
nativeModulePolyfill.set("tty", createNativeModule("tty", __default13));
nativeModulePolyfill.set("url", createNativeModule("url", __default14));
nativeModulePolyfill.set("util", createNativeModule("util", __default));
nativeModulePolyfill.set("console", createNativeModule("console", console));
function loadNativeModule(_filename, request) {
    return nativeModulePolyfill.get(request);
}
function nativeModuleCanBeRequiredByUsers(request) {
    return nativeModulePolyfill.has(request);
}
for (const id of nativeModulePolyfill.keys()){
    Module.builtinModules.push(id);
}
let modulePaths = [];
const packageJsonCache = new Map();
function readPackage(requestPath) {
    const jsonPath = resolve2(requestPath, "package.json");
    const existing = packageJsonCache.get(jsonPath);
    if (existing !== undefined) {
        return existing;
    }
    let json;
    try {
        json = new TextDecoder().decode(Deno.readFileSync(toNamespacedPath2(jsonPath)));
    } catch  {}
    if (json === undefined) {
        packageJsonCache.set(jsonPath, null);
        return null;
    }
    try {
        const parsed = JSON.parse(json);
        const filtered = {
            name: parsed.name,
            main: parsed.main,
            exports: parsed.exports,
            type: parsed.type
        };
        packageJsonCache.set(jsonPath, filtered);
        return filtered;
    } catch (e) {
        e.path = jsonPath;
        e.message = "Error parsing " + jsonPath + ": " + e.message;
        throw e;
    }
}
function readPackageScope(checkPath) {
    const rootSeparatorIndex = checkPath.indexOf(sep2);
    let separatorIndex;
    while((separatorIndex = checkPath.lastIndexOf(sep2)) > rootSeparatorIndex){
        checkPath = checkPath.slice(0, separatorIndex);
        if (checkPath.endsWith(sep2 + "node_modules")) return false;
        const pjson = readPackage(checkPath);
        if (pjson) {
            return {
                path: checkPath,
                data: pjson
            };
        }
    }
    return false;
}
function readPackageMain(requestPath) {
    const pkg = readPackage(requestPath);
    return pkg ? pkg.main : undefined;
}
function readPackageExports(requestPath) {
    const pkg = readPackage(requestPath);
    return pkg ? pkg.exports : undefined;
}
function tryPackage(requestPath, exts, isMain, _originalPath) {
    const pkg = readPackageMain(requestPath);
    if (!pkg) {
        return tryExtensions(resolve2(requestPath, "index"), exts, isMain);
    }
    const filename = resolve2(requestPath, pkg);
    let actual = tryFile(filename, isMain) || tryExtensions(filename, exts, isMain) || tryExtensions(resolve2(filename, "index"), exts, isMain);
    if (actual === false) {
        actual = tryExtensions(resolve2(requestPath, "index"), exts, isMain);
        if (!actual) {
            const err = new Error(`Cannot find module '${filename}'. ` + 'Please verify that the package.json has a valid "main" entry');
            err.code = "MODULE_NOT_FOUND";
            throw err;
        }
    }
    return actual;
}
function tryFile(requestPath, _isMain) {
    const rc = stat1(requestPath);
    return rc === 0 && toRealPath(requestPath);
}
function toRealPath(requestPath) {
    return Deno.realPathSync(requestPath);
}
function tryExtensions(p, exts, isMain) {
    for(let i = 0; i < exts.length; i++){
        const filename = tryFile(p + exts[i], isMain);
        if (filename) {
            return filename;
        }
    }
    return false;
}
function findLongestRegisteredExtension(filename) {
    const name = basename2(filename);
    let currentExtension;
    let index;
    let startIndex = 0;
    while((index = name.indexOf(".", startIndex)) !== -1){
        startIndex = index + 1;
        if (index === 0) continue;
        currentExtension = name.slice(index);
        if (Module._extensions[currentExtension]) return currentExtension;
    }
    return ".js";
}
function isConditionalDotExportSugar(exports, _basePath) {
    if (typeof exports === "string") return true;
    if (Array.isArray(exports)) return true;
    if (typeof exports !== "object") return false;
    let isConditional = false;
    let firstCheck = true;
    for (const key of Object.keys(exports)){
        const curIsConditional = key[0] !== ".";
        if (firstCheck) {
            firstCheck = false;
            isConditional = curIsConditional;
        } else if (isConditional !== curIsConditional) {
            throw new Error('"exports" cannot ' + "contain some keys starting with '.' and some not. The exports " + "object must either be an object of package subpath keys or an " + "object of main entry condition name keys only.");
        }
    }
    return isConditional;
}
function applyExports(basePath, expansion) {
    const mappingKey = `.${expansion}`;
    let pkgExports = readPackageExports(basePath);
    if (pkgExports === undefined || pkgExports === null) {
        return resolve2(basePath, mappingKey);
    }
    if (isConditionalDotExportSugar(pkgExports, basePath)) {
        pkgExports = {
            ".": pkgExports
        };
    }
    if (typeof pkgExports === "object") {
        if (Object.prototype.hasOwnProperty.call(pkgExports, mappingKey)) {
            const mapping = pkgExports[mappingKey];
            return resolveExportsTarget(pathToFileURL(basePath + "/"), mapping, "", basePath, mappingKey);
        }
        if (mappingKey === ".") return basePath;
        let dirMatch = "";
        for (const candidateKey of Object.keys(pkgExports)){
            if (candidateKey[candidateKey.length - 1] !== "/") continue;
            if (candidateKey.length > dirMatch.length && mappingKey.startsWith(candidateKey)) {
                dirMatch = candidateKey;
            }
        }
        if (dirMatch !== "") {
            const mapping1 = pkgExports[dirMatch];
            const subpath = mappingKey.slice(dirMatch.length);
            return resolveExportsTarget(pathToFileURL(basePath + "/"), mapping1, subpath, basePath, mappingKey);
        }
    }
    if (mappingKey === ".") return basePath;
    const e = new Error(`Package exports for '${basePath}' do not define ` + `a '${mappingKey}' subpath`);
    e.code = "MODULE_NOT_FOUND";
    throw e;
}
const EXPORTS_PATTERN = /^((?:@[^/\\%]+\/)?[^./\\%][^/\\%]*)(\/.*)?$/;
function resolveExports(nmPath, request, absoluteRequest) {
    if (!absoluteRequest) {
        const [, name, expansion = ""] = request.match(EXPORTS_PATTERN) || [];
        if (!name) {
            return resolve2(nmPath, request);
        }
        const basePath = resolve2(nmPath, name);
        return applyExports(basePath, expansion);
    }
    return resolve2(nmPath, request);
}
const cjsConditions = new Set([
    "require",
    "node"
]);
function resolveExportsTarget(pkgPath, target, subpath, basePath, mappingKey) {
    if (typeof target === "string") {
        if (target.startsWith("./") && (subpath.length === 0 || target.endsWith("/"))) {
            const resolvedTarget = new URL(target, pkgPath);
            const pkgPathPath = pkgPath.pathname;
            const resolvedTargetPath = resolvedTarget.pathname;
            if (resolvedTargetPath.startsWith(pkgPathPath) && resolvedTargetPath.indexOf("/node_modules/", pkgPathPath.length - 1) === -1) {
                const resolved = new URL(subpath, resolvedTarget);
                const resolvedPath = resolved.pathname;
                if (resolvedPath.startsWith(resolvedTargetPath) && resolvedPath.indexOf("/node_modules/", pkgPathPath.length - 1) === -1) {
                    return fileURLToPath(resolved);
                }
            }
        }
    } else if (Array.isArray(target)) {
        for (const targetValue of target){
            if (Array.isArray(targetValue)) continue;
            try {
                return resolveExportsTarget(pkgPath, targetValue, subpath, basePath, mappingKey);
            } catch (e) {
                if (e.code !== "MODULE_NOT_FOUND") throw e;
            }
        }
    } else if (typeof target === "object" && target !== null) {
        for (const key of Object.keys(target)){
            if (key !== "default" && !cjsConditions.has(key)) {
                continue;
            }
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                try {
                    return resolveExportsTarget(pkgPath, target[key], subpath, basePath, mappingKey);
                } catch (e1) {
                    if (e1.code !== "MODULE_NOT_FOUND") throw e1;
                }
            }
        }
    }
    let e2;
    if (mappingKey !== ".") {
        e2 = new Error(`Package exports for '${basePath}' do not define a ` + `valid '${mappingKey}' target${subpath ? " for " + subpath : ""}`);
    } else {
        e2 = new Error(`No valid exports main found for '${basePath}'`);
    }
    e2.code = "MODULE_NOT_FOUND";
    throw e2;
}
const nmChars = [
    115,
    101,
    108,
    117,
    100,
    111,
    109,
    95,
    101,
    100,
    111,
    110
];
const nmLen = nmChars.length;
function emitCircularRequireWarning(prop) {
    console.error(`Accessing non-existent property '${String(prop)}' of module exports inside circular dependency`);
}
const CircularRequirePrototypeWarningProxy = new Proxy({}, {
    get (target, prop) {
        if (prop in target) return target[prop];
        emitCircularRequireWarning(prop);
        return undefined;
    },
    getOwnPropertyDescriptor (target, prop) {
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
            return Object.getOwnPropertyDescriptor(target, prop);
        }
        emitCircularRequireWarning(prop);
        return undefined;
    }
});
const PublicObjectPrototype = globalThis.Object.prototype;
function getExportsForCircularRequire(module) {
    if (module.exports && Object.getPrototypeOf(module.exports) === PublicObjectPrototype && !module.exports.__esModule) {
        Object.setPrototypeOf(module.exports, CircularRequirePrototypeWarningProxy);
    }
    return module.exports;
}
function wrapSafe(filename, content) {
    const wrapper = Module.wrap(content);
    const [f, err] = Deno.core.evalContext(wrapper, filename);
    if (err) {
        throw err;
    }
    return f;
}
Module._extensions[".js"] = (module, filename)=>{
    if (filename.endsWith(".js")) {
        const pkg = readPackageScope(filename);
        if (pkg !== false && pkg.data && pkg.data.type === "module") {
            throw new Error("Importing ESM module");
        }
    }
    const content = new TextDecoder().decode(Deno.readFileSync(filename));
    module._compile(content, filename);
};
Module._extensions[".json"] = (module, filename)=>{
    const content = new TextDecoder().decode(Deno.readFileSync(filename));
    try {
        module.exports = JSON.parse(stripBOM(content));
    } catch (err) {
        err.message = filename + ": " + err.message;
        throw err;
    }
};
function createRequireFromPath(filename) {
    const trailingSlash = filename.endsWith("/") || isWindows && filename.endsWith("\\");
    const proxyPath = trailingSlash ? join3(filename, "noop.js") : filename;
    const m = new Module(proxyPath);
    m.filename = proxyPath;
    m.paths = Module._nodeModulePaths(m.path);
    return makeRequireFunction(m);
}
function makeRequireFunction(mod) {
    const require = function require(path) {
        return mod.require(path);
    };
    function resolve(request, options) {
        return Module._resolveFilename(request, mod, false, options);
    }
    require.resolve = resolve;
    function paths(request) {
        return Module._resolveLookupPaths(request, mod);
    }
    resolve.paths = paths;
    require.extensions = Module._extensions;
    require.cache = Module._cache;
    return require;
}
function stripBOM(content) {
    if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
    }
    return content;
}
Module.builtinModules;
const createRequire = Module.createRequire;
const WASM_BIN = new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    166,
    1,
    21,
    96,
    3,
    127,
    127,
    127,
    0,
    96,
    1,
    127,
    0,
    96,
    2,
    127,
    127,
    0,
    96,
    2,
    127,
    127,
    1,
    127,
    96,
    2,
    127,
    127,
    1,
    126,
    96,
    1,
    127,
    1,
    126,
    96,
    6,
    127,
    127,
    127,
    127,
    127,
    126,
    1,
    126,
    96,
    5,
    127,
    127,
    127,
    127,
    127,
    0,
    96,
    4,
    127,
    127,
    127,
    127,
    0,
    96,
    2,
    127,
    126,
    0,
    96,
    6,
    127,
    127,
    127,
    127,
    127,
    127,
    0,
    96,
    13,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    0,
    96,
    9,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    0,
    96,
    7,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    0,
    96,
    1,
    127,
    1,
    127,
    96,
    4,
    127,
    127,
    127,
    127,
    1,
    127,
    96,
    3,
    127,
    127,
    127,
    1,
    127,
    96,
    8,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    0,
    96,
    8,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    127,
    1,
    127,
    96,
    6,
    127,
    127,
    127,
    127,
    127,
    127,
    1,
    127,
    96,
    0,
    0,
    3,
    95,
    94,
    3,
    4,
    5,
    3,
    3,
    2,
    0,
    2,
    2,
    6,
    6,
    7,
    7,
    7,
    2,
    0,
    0,
    1,
    2,
    8,
    8,
    0,
    0,
    1,
    2,
    2,
    9,
    10,
    0,
    1,
    0,
    2,
    11,
    2,
    8,
    1,
    1,
    12,
    0,
    8,
    2,
    0,
    2,
    0,
    2,
    2,
    2,
    0,
    2,
    2,
    8,
    13,
    0,
    14,
    2,
    8,
    1,
    1,
    2,
    2,
    0,
    7,
    8,
    14,
    3,
    2,
    0,
    15,
    7,
    15,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    3,
    16,
    0,
    0,
    0,
    2,
    2,
    17,
    10,
    18,
    10,
    19,
    2,
    14,
    14,
    1,
    20,
    4,
    5,
    1,
    112,
    1,
    5,
    5,
    5,
    3,
    1,
    0,
    2,
    6,
    8,
    1,
    127,
    1,
    65,
    240,
    166,
    4,
    11,
    7,
    161,
    5,
    34,
    6,
    109,
    101,
    109,
    111,
    114,
    121,
    2,
    0,
    15,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    118,
    101,
    114,
    105,
    102,
    121,
    49,
    54,
    0,
    0,
    15,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    118,
    101,
    114,
    105,
    102,
    121,
    51,
    50,
    0,
    3,
    15,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    118,
    101,
    114,
    105,
    102,
    121,
    54,
    52,
    0,
    4,
    11,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    119,
    105,
    112,
    101,
    0,
    5,
    16,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    104,
    99,
    104,
    97,
    99,
    104,
    97,
    50,
    48,
    0,
    6,
    15,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    99,
    104,
    97,
    99,
    104,
    97,
    50,
    48,
    0,
    11,
    20,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    105,
    101,
    116,
    102,
    95,
    99,
    104,
    97,
    99,
    104,
    97,
    50,
    48,
    0,
    12,
    16,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    120,
    99,
    104,
    97,
    99,
    104,
    97,
    50,
    48,
    0,
    13,
    15,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    112,
    111,
    108,
    121,
    49,
    51,
    48,
    53,
    0,
    19,
    22,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    98,
    108,
    97,
    107,
    101,
    50,
    98,
    95,
    103,
    101,
    110,
    101,
    114,
    97,
    108,
    0,
    27,
    14,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    98,
    108,
    97,
    107,
    101,
    50,
    98,
    0,
    28,
    22,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    97,
    114,
    103,
    111,
    110,
    50,
    105,
    95,
    103,
    101,
    110,
    101,
    114,
    97,
    108,
    0,
    32,
    14,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    97,
    114,
    103,
    111,
    110,
    50,
    105,
    0,
    37,
    13,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    120,
    50,
    53,
    53,
    49,
    57,
    0,
    38,
    24,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    120,
    50,
    53,
    53,
    49,
    57,
    95,
    112,
    117,
    98,
    108,
    105,
    99,
    95,
    107,
    101,
    121,
    0,
    46,
    22,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    115,
    105,
    103,
    110,
    95,
    112,
    117,
    98,
    108,
    105,
    99,
    95,
    107,
    101,
    121,
    0,
    54,
    11,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    115,
    105,
    103,
    110,
    0,
    61,
    12,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    99,
    104,
    101,
    99,
    107,
    0,
    69,
    25,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    102,
    114,
    111,
    109,
    95,
    101,
    100,
    100,
    115,
    97,
    95,
    112,
    114,
    105,
    118,
    97,
    116,
    101,
    0,
    70,
    24,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    102,
    114,
    111,
    109,
    95,
    101,
    100,
    100,
    115,
    97,
    95,
    112,
    117,
    98,
    108,
    105,
    99,
    0,
    71,
    25,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    120,
    50,
    53,
    53,
    49,
    57,
    95,
    100,
    105,
    114,
    116,
    121,
    95,
    115,
    109,
    97,
    108,
    108,
    0,
    73,
    24,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    120,
    50,
    53,
    53,
    49,
    57,
    95,
    100,
    105,
    114,
    116,
    121,
    95,
    102,
    97,
    115,
    116,
    0,
    75,
    22,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    104,
    105,
    100,
    100,
    101,
    110,
    95,
    116,
    111,
    95,
    99,
    117,
    114,
    118,
    101,
    0,
    76,
    22,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    99,
    117,
    114,
    118,
    101,
    95,
    116,
    111,
    95,
    104,
    105,
    100,
    100,
    101,
    110,
    0,
    78,
    22,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    104,
    105,
    100,
    100,
    101,
    110,
    95,
    107,
    101,
    121,
    95,
    112,
    97,
    105,
    114,
    0,
    79,
    19,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    107,
    101,
    121,
    95,
    101,
    120,
    99,
    104,
    97,
    110,
    103,
    101,
    0,
    80,
    21,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    120,
    50,
    53,
    53,
    49,
    57,
    95,
    105,
    110,
    118,
    101,
    114,
    115,
    101,
    0,
    81,
    16,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    108,
    111,
    99,
    107,
    95,
    97,
    101,
    97,
    100,
    0,
    84,
    18,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    117,
    110,
    108,
    111,
    99,
    107,
    95,
    97,
    101,
    97,
    100,
    0,
    86,
    11,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    108,
    111,
    99,
    107,
    0,
    87,
    13,
    99,
    114,
    121,
    112,
    116,
    111,
    95,
    117,
    110,
    108,
    111,
    99,
    107,
    0,
    88,
    6,
    109,
    97,
    108,
    108,
    111,
    99,
    0,
    90,
    4,
    102,
    114,
    101,
    101,
    0,
    92,
    9,
    10,
    1,
    0,
    65,
    1,
    11,
    4,
    28,
    29,
    30,
    31,
    10,
    252,
    167,
    2,
    94,
    42,
    1,
    1,
    126,
    32,
    0,
    32,
    1,
    16,
    129,
    128,
    128,
    128,
    0,
    34,
    2,
    66,
    32,
    136,
    32,
    2,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    132,
    66,
    127,
    124,
    66,
    32,
    136,
    167,
    65,
    1,
    113,
    65,
    127,
    106,
    11,
    53,
    1,
    2,
    126,
    32,
    0,
    16,
    130,
    128,
    128,
    128,
    0,
    33,
    2,
    32,
    1,
    16,
    130,
    128,
    128,
    128,
    0,
    33,
    3,
    32,
    0,
    65,
    8,
    106,
    16,
    130,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    8,
    106,
    16,
    130,
    128,
    128,
    128,
    0,
    133,
    32,
    3,
    32,
    2,
    133,
    132,
    11,
    7,
    0,
    32,
    0,
    41,
    0,
    0,
    11,
    59,
    1,
    1,
    126,
    32,
    0,
    32,
    1,
    16,
    129,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    16,
    129,
    128,
    128,
    128,
    0,
    132,
    34,
    2,
    66,
    32,
    136,
    32,
    2,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    132,
    66,
    127,
    124,
    66,
    32,
    136,
    167,
    65,
    1,
    113,
    65,
    127,
    106,
    11,
    93,
    1,
    1,
    126,
    32,
    0,
    32,
    1,
    16,
    129,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    16,
    129,
    128,
    128,
    128,
    0,
    132,
    32,
    0,
    65,
    32,
    106,
    32,
    1,
    65,
    32,
    106,
    16,
    129,
    128,
    128,
    128,
    0,
    132,
    32,
    0,
    65,
    48,
    106,
    32,
    1,
    65,
    48,
    106,
    16,
    129,
    128,
    128,
    128,
    0,
    132,
    34,
    2,
    66,
    32,
    136,
    32,
    2,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    132,
    66,
    127,
    124,
    66,
    32,
    136,
    167,
    65,
    1,
    113,
    65,
    127,
    106,
    11,
    36,
    0,
    2,
    64,
    32,
    1,
    69,
    13,
    0,
    3,
    64,
    32,
    0,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    33,
    0,
    32,
    1,
    65,
    127,
    106,
    34,
    1,
    13,
    0,
    11,
    11,
    11,
    206,
    1,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    0,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    3,
    32,
    1,
    16,
    135,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    48,
    106,
    33,
    4,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    4,
    32,
    1,
    106,
    32,
    2,
    32,
    1,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    16,
    71,
    13,
    0,
    11,
    32,
    3,
    32,
    3,
    16,
    136,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    0,
    32,
    1,
    106,
    32,
    3,
    32,
    1,
    106,
    40,
    2,
    0,
    54,
    0,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    16,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    48,
    106,
    33,
    2,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    0,
    32,
    1,
    106,
    65,
    16,
    106,
    32,
    2,
    32,
    1,
    106,
    40,
    2,
    0,
    54,
    0,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    16,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    192,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    77,
    1,
    1,
    127,
    32,
    0,
    66,
    178,
    218,
    136,
    203,
    199,
    174,
    153,
    144,
    235,
    0,
    55,
    2,
    8,
    32,
    0,
    66,
    229,
    240,
    193,
    139,
    230,
    141,
    153,
    144,
    51,
    55,
    2,
    0,
    32,
    0,
    65,
    16,
    106,
    33,
    2,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    32,
    0,
    106,
    32,
    1,
    32,
    0,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    0,
    65,
    4,
    106,
    34,
    0,
    65,
    32,
    71,
    13,
    0,
    11,
    11,
    156,
    5,
    1,
    19,
    127,
    32,
    1,
    40,
    2,
    60,
    33,
    2,
    32,
    1,
    40,
    2,
    56,
    33,
    3,
    32,
    1,
    40,
    2,
    52,
    33,
    4,
    32,
    1,
    40,
    2,
    48,
    33,
    5,
    32,
    1,
    40,
    2,
    44,
    33,
    6,
    32,
    1,
    40,
    2,
    40,
    33,
    7,
    32,
    1,
    40,
    2,
    36,
    33,
    8,
    32,
    1,
    40,
    2,
    32,
    33,
    9,
    32,
    1,
    40,
    2,
    28,
    33,
    10,
    32,
    1,
    40,
    2,
    24,
    33,
    11,
    32,
    1,
    40,
    2,
    20,
    33,
    12,
    32,
    1,
    40,
    2,
    16,
    33,
    13,
    32,
    1,
    40,
    2,
    12,
    33,
    14,
    32,
    1,
    40,
    2,
    8,
    33,
    15,
    32,
    1,
    40,
    2,
    4,
    33,
    16,
    32,
    1,
    40,
    2,
    0,
    33,
    1,
    65,
    10,
    33,
    17,
    3,
    64,
    32,
    5,
    32,
    13,
    32,
    1,
    106,
    34,
    1,
    115,
    65,
    16,
    119,
    34,
    5,
    32,
    9,
    106,
    34,
    9,
    32,
    13,
    115,
    65,
    12,
    119,
    34,
    13,
    32,
    1,
    106,
    34,
    1,
    32,
    5,
    115,
    65,
    8,
    119,
    34,
    5,
    32,
    9,
    106,
    34,
    9,
    32,
    13,
    115,
    65,
    7,
    119,
    34,
    13,
    32,
    2,
    32,
    10,
    32,
    14,
    106,
    34,
    14,
    115,
    65,
    16,
    119,
    34,
    2,
    32,
    6,
    106,
    34,
    6,
    32,
    10,
    115,
    65,
    12,
    119,
    34,
    10,
    32,
    14,
    106,
    34,
    18,
    106,
    34,
    14,
    32,
    3,
    32,
    11,
    32,
    15,
    106,
    34,
    15,
    115,
    65,
    16,
    119,
    34,
    3,
    32,
    7,
    106,
    34,
    7,
    32,
    11,
    115,
    65,
    12,
    119,
    34,
    11,
    32,
    15,
    106,
    34,
    15,
    32,
    3,
    115,
    65,
    8,
    119,
    34,
    19,
    115,
    65,
    16,
    119,
    34,
    3,
    32,
    4,
    32,
    12,
    32,
    16,
    106,
    34,
    16,
    115,
    65,
    16,
    119,
    34,
    4,
    32,
    8,
    106,
    34,
    8,
    32,
    12,
    115,
    65,
    12,
    119,
    34,
    12,
    32,
    16,
    106,
    34,
    16,
    32,
    4,
    115,
    65,
    8,
    119,
    34,
    4,
    32,
    8,
    106,
    34,
    20,
    106,
    34,
    8,
    32,
    13,
    115,
    65,
    12,
    119,
    34,
    13,
    32,
    14,
    106,
    34,
    14,
    32,
    3,
    115,
    65,
    8,
    119,
    34,
    3,
    32,
    8,
    106,
    34,
    8,
    32,
    13,
    115,
    65,
    7,
    119,
    33,
    13,
    32,
    18,
    32,
    2,
    115,
    65,
    8,
    119,
    34,
    2,
    32,
    6,
    106,
    34,
    6,
    32,
    10,
    115,
    65,
    7,
    119,
    34,
    10,
    32,
    15,
    106,
    34,
    15,
    32,
    4,
    115,
    65,
    16,
    119,
    34,
    4,
    32,
    9,
    106,
    34,
    9,
    32,
    10,
    115,
    65,
    12,
    119,
    34,
    10,
    32,
    15,
    106,
    34,
    15,
    32,
    4,
    115,
    65,
    8,
    119,
    34,
    4,
    32,
    9,
    106,
    34,
    9,
    32,
    10,
    115,
    65,
    7,
    119,
    33,
    10,
    32,
    19,
    32,
    7,
    106,
    34,
    7,
    32,
    11,
    115,
    65,
    7,
    119,
    34,
    11,
    32,
    16,
    106,
    34,
    16,
    32,
    5,
    115,
    65,
    16,
    119,
    34,
    5,
    32,
    6,
    106,
    34,
    6,
    32,
    11,
    115,
    65,
    12,
    119,
    34,
    11,
    32,
    16,
    106,
    34,
    16,
    32,
    5,
    115,
    65,
    8,
    119,
    34,
    5,
    32,
    6,
    106,
    34,
    6,
    32,
    11,
    115,
    65,
    7,
    119,
    33,
    11,
    32,
    20,
    32,
    12,
    115,
    65,
    7,
    119,
    34,
    12,
    32,
    1,
    106,
    34,
    1,
    32,
    2,
    115,
    65,
    16,
    119,
    34,
    2,
    32,
    7,
    106,
    34,
    7,
    32,
    12,
    115,
    65,
    12,
    119,
    34,
    12,
    32,
    1,
    106,
    34,
    1,
    32,
    2,
    115,
    65,
    8,
    119,
    34,
    2,
    32,
    7,
    106,
    34,
    7,
    32,
    12,
    115,
    65,
    7,
    119,
    33,
    12,
    32,
    17,
    65,
    127,
    106,
    34,
    17,
    13,
    0,
    11,
    32,
    0,
    32,
    2,
    54,
    2,
    60,
    32,
    0,
    32,
    3,
    54,
    2,
    56,
    32,
    0,
    32,
    4,
    54,
    2,
    52,
    32,
    0,
    32,
    5,
    54,
    2,
    48,
    32,
    0,
    32,
    6,
    54,
    2,
    44,
    32,
    0,
    32,
    7,
    54,
    2,
    40,
    32,
    0,
    32,
    8,
    54,
    2,
    36,
    32,
    0,
    32,
    9,
    54,
    2,
    32,
    32,
    0,
    32,
    10,
    54,
    2,
    28,
    32,
    0,
    32,
    11,
    54,
    2,
    24,
    32,
    0,
    32,
    12,
    54,
    2,
    20,
    32,
    0,
    32,
    13,
    54,
    2,
    16,
    32,
    0,
    32,
    14,
    54,
    2,
    12,
    32,
    0,
    32,
    15,
    54,
    2,
    8,
    32,
    0,
    32,
    16,
    54,
    2,
    4,
    32,
    0,
    32,
    1,
    54,
    2,
    0,
    11,
    128,
    5,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    1,
    107,
    34,
    6,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    128,
    1,
    106,
    32,
    3,
    16,
    135,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    184,
    1,
    106,
    33,
    7,
    32,
    6,
    32,
    5,
    55,
    3,
    176,
    1,
    32,
    5,
    167,
    33,
    8,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    7,
    32,
    3,
    106,
    32,
    4,
    32,
    3,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    8,
    71,
    13,
    0,
    11,
    2,
    64,
    32,
    2,
    65,
    192,
    0,
    73,
    13,
    0,
    32,
    2,
    65,
    6,
    118,
    33,
    7,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    6,
    65,
    192,
    0,
    106,
    32,
    6,
    65,
    128,
    1,
    106,
    16,
    136,
    128,
    128,
    128,
    0,
    2,
    64,
    2,
    64,
    32,
    1,
    69,
    13,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    0,
    32,
    3,
    106,
    32,
    1,
    32,
    3,
    106,
    40,
    0,
    0,
    32,
    6,
    65,
    128,
    1,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    32,
    6,
    65,
    192,
    0,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    106,
    115,
    54,
    0,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    1,
    32,
    3,
    106,
    33,
    1,
    32,
    0,
    32,
    3,
    106,
    33,
    0,
    12,
    1,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    0,
    32,
    3,
    106,
    32,
    6,
    65,
    128,
    1,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    32,
    6,
    65,
    192,
    0,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    106,
    54,
    0,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    3,
    106,
    33,
    0,
    65,
    0,
    33,
    1,
    11,
    32,
    6,
    32,
    6,
    40,
    2,
    176,
    1,
    34,
    3,
    65,
    1,
    106,
    34,
    8,
    54,
    2,
    176,
    1,
    2,
    64,
    32,
    8,
    32,
    3,
    79,
    13,
    0,
    32,
    6,
    32,
    6,
    40,
    2,
    180,
    1,
    65,
    1,
    106,
    54,
    2,
    180,
    1,
    11,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    32,
    7,
    71,
    13,
    0,
    11,
    11,
    2,
    64,
    32,
    2,
    65,
    63,
    113,
    34,
    4,
    69,
    13,
    0,
    32,
    6,
    65,
    192,
    0,
    106,
    32,
    6,
    65,
    128,
    1,
    106,
    16,
    136,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    6,
    32,
    3,
    106,
    32,
    6,
    65,
    128,
    1,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    32,
    6,
    65,
    192,
    0,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    128,
    136,
    128,
    128,
    0,
    32,
    1,
    27,
    33,
    3,
    32,
    6,
    33,
    1,
    32,
    4,
    33,
    8,
    3,
    64,
    32,
    0,
    32,
    3,
    45,
    0,
    0,
    32,
    1,
    45,
    0,
    0,
    115,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    33,
    1,
    32,
    3,
    65,
    1,
    106,
    33,
    3,
    32,
    0,
    65,
    1,
    106,
    33,
    0,
    32,
    8,
    65,
    127,
    106,
    34,
    8,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    6,
    32,
    3,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    6,
    40,
    2,
    176,
    1,
    33,
    8,
    11,
    32,
    6,
    53,
    2,
    180,
    1,
    33,
    5,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    6,
    65,
    192,
    0,
    106,
    32,
    3,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    6,
    65,
    128,
    1,
    106,
    32,
    3,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    6,
    65,
    192,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    5,
    66,
    32,
    134,
    32,
    8,
    173,
    132,
    32,
    4,
    65,
    0,
    71,
    173,
    124,
    11,
    98,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    32,
    107,
    34,
    6,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    6,
    32,
    3,
    32,
    4,
    16,
    134,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    6,
    32,
    4,
    65,
    16,
    106,
    32,
    5,
    16,
    137,
    128,
    128,
    128,
    0,
    33,
    5,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    6,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    6,
    65,
    32,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    5,
    11,
    21,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    32,
    4,
    66,
    0,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    11,
    57,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    32,
    4,
    65,
    4,
    106,
    32,
    4,
    49,
    0,
    1,
    66,
    40,
    134,
    32,
    4,
    49,
    0,
    0,
    66,
    32,
    134,
    132,
    32,
    4,
    49,
    0,
    2,
    66,
    48,
    134,
    132,
    32,
    4,
    49,
    0,
    3,
    66,
    56,
    134,
    132,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    11,
    21,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    32,
    4,
    66,
    0,
    16,
    138,
    128,
    128,
    128,
    0,
    26,
    11,
    209,
    1,
    1,
    2,
    127,
    65,
    0,
    33,
    2,
    32,
    0,
    65,
    0,
    54,
    2,
    72,
    32,
    0,
    65,
    32,
    106,
    65,
    0,
    54,
    2,
    0,
    32,
    0,
    65,
    24,
    106,
    66,
    0,
    55,
    2,
    0,
    32,
    0,
    65,
    16,
    106,
    66,
    0,
    55,
    2,
    0,
    32,
    0,
    65,
    52,
    106,
    65,
    1,
    54,
    2,
    0,
    32,
    0,
    65,
    36,
    106,
    66,
    0,
    55,
    2,
    0,
    32,
    0,
    65,
    44,
    106,
    66,
    0,
    55,
    2,
    0,
    3,
    64,
    32,
    0,
    32,
    2,
    106,
    32,
    1,
    32,
    2,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    56,
    106,
    33,
    3,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    3,
    32,
    2,
    106,
    32,
    1,
    32,
    2,
    106,
    65,
    16,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    0,
    40,
    2,
    0,
    65,
    255,
    255,
    255,
    255,
    0,
    113,
    54,
    2,
    0,
    65,
    4,
    33,
    2,
    3,
    64,
    32,
    0,
    32,
    2,
    106,
    34,
    1,
    32,
    1,
    40,
    2,
    0,
    65,
    252,
    255,
    255,
    255,
    0,
    113,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    11,
    195,
    1,
    1,
    3,
    127,
    2,
    64,
    32,
    2,
    69,
    13,
    0,
    65,
    0,
    33,
    3,
    32,
    0,
    32,
    1,
    32,
    2,
    65,
    0,
    32,
    0,
    40,
    2,
    72,
    107,
    65,
    15,
    113,
    34,
    4,
    32,
    4,
    32,
    2,
    75,
    27,
    34,
    4,
    16,
    144,
    128,
    128,
    128,
    0,
    32,
    1,
    32,
    4,
    106,
    33,
    1,
    2,
    64,
    32,
    2,
    32,
    4,
    107,
    34,
    5,
    65,
    16,
    73,
    13,
    0,
    32,
    5,
    65,
    4,
    118,
    33,
    4,
    3,
    64,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    0,
    32,
    2,
    106,
    65,
    36,
    106,
    32,
    1,
    32,
    2,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    32,
    0,
    16,
    145,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    16,
    106,
    33,
    1,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    32,
    4,
    71,
    13,
    0,
    11,
    32,
    5,
    65,
    16,
    73,
    13,
    0,
    32,
    0,
    65,
    0,
    54,
    2,
    72,
    32,
    0,
    65,
    44,
    106,
    66,
    0,
    55,
    2,
    0,
    32,
    0,
    65,
    36,
    106,
    66,
    0,
    55,
    2,
    0,
    11,
    32,
    0,
    32,
    1,
    32,
    5,
    65,
    15,
    113,
    16,
    144,
    128,
    128,
    128,
    0,
    11,
    11,
    146,
    1,
    1,
    6,
    127,
    2,
    64,
    32,
    2,
    69,
    13,
    0,
    32,
    0,
    40,
    2,
    72,
    33,
    3,
    32,
    0,
    65,
    36,
    106,
    34,
    4,
    65,
    8,
    106,
    33,
    5,
    3,
    64,
    32,
    1,
    45,
    0,
    0,
    33,
    6,
    32,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    7,
    54,
    2,
    72,
    32,
    0,
    32,
    3,
    65,
    124,
    113,
    106,
    65,
    36,
    106,
    34,
    8,
    32,
    6,
    32,
    3,
    65,
    3,
    116,
    116,
    32,
    8,
    40,
    2,
    0,
    114,
    54,
    2,
    0,
    2,
    64,
    32,
    7,
    65,
    16,
    71,
    13,
    0,
    32,
    0,
    16,
    145,
    128,
    128,
    128,
    0,
    32,
    5,
    66,
    0,
    55,
    2,
    0,
    32,
    4,
    66,
    0,
    55,
    2,
    0,
    65,
    0,
    33,
    7,
    32,
    0,
    65,
    0,
    54,
    2,
    72,
    11,
    32,
    1,
    65,
    1,
    106,
    33,
    1,
    32,
    7,
    33,
    3,
    32,
    2,
    65,
    127,
    106,
    34,
    2,
    13,
    0,
    11,
    11,
    11,
    188,
    3,
    13,
    1,
    126,
    1,
    127,
    1,
    126,
    3,
    127,
    1,
    126,
    3,
    127,
    1,
    126,
    2,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    2,
    127,
    6,
    126,
    32,
    0,
    32,
    0,
    53,
    2,
    36,
    32,
    0,
    53,
    2,
    16,
    124,
    34,
    1,
    32,
    0,
    40,
    2,
    0,
    34,
    2,
    173,
    34,
    3,
    126,
    32,
    0,
    65,
    52,
    106,
    40,
    2,
    0,
    32,
    0,
    65,
    32,
    106,
    34,
    4,
    40,
    2,
    0,
    106,
    34,
    5,
    32,
    2,
    65,
    2,
    118,
    108,
    65,
    5,
    108,
    173,
    124,
    32,
    0,
    65,
    48,
    106,
    53,
    2,
    0,
    32,
    0,
    65,
    28,
    106,
    34,
    6,
    53,
    2,
    0,
    124,
    34,
    7,
    32,
    0,
    40,
    2,
    4,
    34,
    8,
    65,
    2,
    118,
    32,
    8,
    106,
    34,
    9,
    173,
    126,
    124,
    32,
    0,
    65,
    44,
    106,
    53,
    2,
    0,
    32,
    0,
    65,
    24,
    106,
    34,
    10,
    53,
    2,
    0,
    124,
    34,
    11,
    32,
    0,
    40,
    2,
    8,
    34,
    12,
    65,
    2,
    118,
    32,
    12,
    106,
    34,
    13,
    173,
    34,
    14,
    126,
    124,
    32,
    0,
    65,
    40,
    106,
    53,
    2,
    0,
    32,
    0,
    65,
    20,
    106,
    34,
    15,
    53,
    2,
    0,
    124,
    34,
    16,
    32,
    0,
    40,
    2,
    12,
    34,
    17,
    65,
    2,
    118,
    32,
    17,
    106,
    34,
    18,
    173,
    34,
    19,
    126,
    124,
    34,
    20,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    2,
    65,
    3,
    113,
    32,
    5,
    108,
    32,
    11,
    32,
    8,
    173,
    34,
    21,
    126,
    32,
    7,
    32,
    3,
    126,
    124,
    32,
    16,
    32,
    12,
    173,
    34,
    22,
    126,
    124,
    32,
    1,
    32,
    17,
    173,
    126,
    124,
    32,
    18,
    32,
    5,
    108,
    173,
    124,
    34,
    23,
    66,
    32,
    136,
    167,
    106,
    34,
    2,
    65,
    2,
    118,
    65,
    5,
    108,
    173,
    124,
    34,
    24,
    62,
    2,
    16,
    32,
    15,
    32,
    20,
    66,
    32,
    136,
    32,
    1,
    32,
    21,
    126,
    32,
    16,
    32,
    3,
    126,
    124,
    32,
    9,
    32,
    5,
    108,
    173,
    124,
    32,
    7,
    32,
    14,
    126,
    124,
    32,
    11,
    32,
    19,
    126,
    124,
    34,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    124,
    32,
    24,
    66,
    32,
    136,
    124,
    34,
    20,
    62,
    2,
    0,
    32,
    10,
    32,
    14,
    66,
    32,
    136,
    32,
    16,
    32,
    21,
    126,
    32,
    11,
    32,
    3,
    126,
    124,
    32,
    1,
    32,
    22,
    126,
    124,
    32,
    13,
    32,
    5,
    108,
    173,
    124,
    32,
    7,
    32,
    19,
    126,
    124,
    34,
    1,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    124,
    32,
    20,
    66,
    32,
    136,
    124,
    34,
    3,
    62,
    2,
    0,
    32,
    6,
    32,
    1,
    66,
    32,
    136,
    32,
    23,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    124,
    32,
    3,
    66,
    32,
    136,
    124,
    34,
    1,
    62,
    2,
    0,
    32,
    4,
    32,
    2,
    65,
    3,
    113,
    32,
    1,
    66,
    32,
    136,
    167,
    106,
    54,
    2,
    0,
    11,
    233,
    1,
    2,
    2,
    127,
    1,
    126,
    2,
    64,
    32,
    0,
    40,
    2,
    72,
    34,
    2,
    69,
    13,
    0,
    32,
    0,
    65,
    52,
    106,
    65,
    0,
    54,
    2,
    0,
    32,
    0,
    32,
    2,
    65,
    1,
    106,
    54,
    2,
    72,
    32,
    0,
    32,
    2,
    65,
    124,
    113,
    106,
    65,
    36,
    106,
    34,
    3,
    32,
    3,
    40,
    2,
    0,
    65,
    1,
    32,
    2,
    65,
    3,
    116,
    116,
    114,
    54,
    2,
    0,
    32,
    0,
    16,
    145,
    128,
    128,
    128,
    0,
    11,
    32,
    0,
    65,
    16,
    106,
    33,
    3,
    66,
    5,
    33,
    4,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    3,
    32,
    2,
    106,
    53,
    2,
    0,
    124,
    66,
    32,
    136,
    33,
    4,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    32,
    4,
    32,
    0,
    65,
    32,
    106,
    53,
    2,
    0,
    124,
    66,
    2,
    136,
    66,
    5,
    126,
    33,
    4,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    1,
    32,
    2,
    106,
    32,
    4,
    32,
    0,
    32,
    2,
    106,
    34,
    3,
    65,
    16,
    106,
    53,
    2,
    0,
    124,
    32,
    3,
    65,
    56,
    106,
    53,
    2,
    0,
    124,
    34,
    4,
    62,
    0,
    0,
    32,
    4,
    66,
    32,
    136,
    33,
    4,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    0,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    204,
    0,
    71,
    13,
    0,
    11,
    11,
    66,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    208,
    0,
    107,
    34,
    4,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    3,
    16,
    142,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    1,
    32,
    2,
    16,
    143,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    0,
    16,
    146,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    208,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    208,
    1,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    128,
    1,
    107,
    34,
    4,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    128,
    137,
    128,
    128,
    0,
    65,
    192,
    0,
    252,
    10,
    0,
    0,
    32,
    0,
    66,
    0,
    55,
    3,
    64,
    32,
    0,
    65,
    200,
    0,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    0,
    32,
    1,
    54,
    2,
    212,
    1,
    65,
    0,
    33,
    5,
    32,
    0,
    65,
    0,
    54,
    2,
    208,
    1,
    32,
    0,
    32,
    3,
    65,
    8,
    116,
    32,
    1,
    115,
    173,
    66,
    136,
    146,
    247,
    149,
    255,
    204,
    249,
    132,
    234,
    0,
    133,
    55,
    3,
    0,
    2,
    64,
    32,
    3,
    69,
    13,
    0,
    32,
    4,
    32,
    3,
    106,
    65,
    0,
    65,
    0,
    65,
    128,
    1,
    32,
    3,
    107,
    32,
    3,
    65,
    255,
    0,
    75,
    27,
    252,
    11,
    0,
    32,
    4,
    32,
    2,
    32,
    3,
    252,
    10,
    0,
    0,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    3,
    3,
    64,
    32,
    3,
    32,
    5,
    106,
    32,
    4,
    32,
    5,
    106,
    16,
    130,
    128,
    128,
    128,
    0,
    55,
    3,
    0,
    32,
    5,
    65,
    8,
    106,
    34,
    5,
    65,
    128,
    1,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    128,
    1,
    54,
    2,
    208,
    1,
    11,
    32,
    4,
    65,
    128,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    184,
    1,
    1,
    4,
    127,
    2,
    64,
    32,
    2,
    69,
    13,
    0,
    65,
    0,
    33,
    3,
    32,
    0,
    32,
    1,
    32,
    2,
    65,
    0,
    32,
    0,
    40,
    2,
    208,
    1,
    107,
    65,
    255,
    0,
    113,
    34,
    4,
    32,
    4,
    32,
    2,
    75,
    27,
    34,
    4,
    16,
    150,
    128,
    128,
    128,
    0,
    32,
    1,
    32,
    4,
    106,
    33,
    1,
    2,
    64,
    32,
    2,
    32,
    4,
    107,
    34,
    5,
    65,
    128,
    1,
    73,
    13,
    0,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    4,
    32,
    5,
    65,
    7,
    118,
    33,
    6,
    3,
    64,
    32,
    0,
    16,
    151,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    2,
    106,
    32,
    1,
    32,
    2,
    106,
    16,
    130,
    128,
    128,
    128,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    8,
    106,
    34,
    2,
    65,
    128,
    1,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    128,
    1,
    54,
    2,
    208,
    1,
    32,
    1,
    65,
    128,
    1,
    106,
    33,
    1,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    32,
    6,
    71,
    13,
    0,
    11,
    11,
    32,
    0,
    32,
    1,
    32,
    5,
    65,
    255,
    0,
    113,
    16,
    150,
    128,
    128,
    128,
    0,
    11,
    11,
    127,
    3,
    1,
    127,
    1,
    126,
    2,
    127,
    2,
    64,
    32,
    2,
    69,
    13,
    0,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    3,
    3,
    64,
    32,
    0,
    16,
    151,
    128,
    128,
    128,
    0,
    32,
    1,
    49,
    0,
    0,
    33,
    4,
    2,
    64,
    32,
    0,
    40,
    2,
    208,
    1,
    34,
    5,
    13,
    0,
    32,
    3,
    65,
    0,
    65,
    128,
    1,
    252,
    11,
    0,
    11,
    32,
    0,
    32,
    5,
    65,
    1,
    106,
    54,
    2,
    208,
    1,
    32,
    0,
    32,
    5,
    65,
    120,
    113,
    106,
    65,
    208,
    0,
    106,
    34,
    6,
    32,
    6,
    41,
    3,
    0,
    32,
    4,
    32,
    5,
    65,
    3,
    116,
    65,
    56,
    113,
    173,
    134,
    132,
    55,
    3,
    0,
    32,
    1,
    65,
    1,
    106,
    33,
    1,
    32,
    2,
    65,
    127,
    106,
    34,
    2,
    13,
    0,
    11,
    11,
    11,
    85,
    2,
    1,
    126,
    1,
    127,
    2,
    64,
    32,
    0,
    40,
    2,
    208,
    1,
    65,
    128,
    1,
    71,
    13,
    0,
    32,
    0,
    32,
    0,
    41,
    3,
    64,
    34,
    1,
    66,
    128,
    1,
    124,
    55,
    3,
    64,
    2,
    64,
    32,
    1,
    66,
    128,
    127,
    84,
    13,
    0,
    32,
    0,
    65,
    200,
    0,
    106,
    34,
    2,
    32,
    2,
    41,
    3,
    0,
    66,
    1,
    124,
    55,
    3,
    0,
    11,
    32,
    0,
    65,
    0,
    16,
    152,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    0,
    54,
    2,
    208,
    1,
    11,
    11,
    181,
    46,
    1,
    43,
    126,
    32,
    0,
    32,
    0,
    41,
    3,
    32,
    34,
    2,
    32,
    0,
    41,
    3,
    0,
    34,
    3,
    124,
    32,
    0,
    41,
    3,
    80,
    34,
    4,
    124,
    34,
    5,
    32,
    0,
    65,
    216,
    0,
    106,
    41,
    3,
    0,
    34,
    6,
    124,
    32,
    0,
    41,
    3,
    64,
    32,
    5,
    133,
    66,
    209,
    133,
    154,
    239,
    250,
    207,
    148,
    135,
    209,
    0,
    133,
    66,
    32,
    137,
    34,
    7,
    66,
    136,
    146,
    243,
    157,
    255,
    204,
    249,
    132,
    234,
    0,
    124,
    34,
    8,
    32,
    2,
    133,
    66,
    40,
    137,
    34,
    9,
    124,
    34,
    10,
    32,
    0,
    65,
    144,
    1,
    106,
    41,
    3,
    0,
    34,
    5,
    124,
    32,
    0,
    41,
    3,
    40,
    34,
    11,
    32,
    0,
    41,
    3,
    8,
    34,
    12,
    124,
    32,
    0,
    65,
    224,
    0,
    106,
    41,
    3,
    0,
    34,
    13,
    124,
    34,
    14,
    32,
    0,
    65,
    232,
    0,
    106,
    41,
    3,
    0,
    34,
    15,
    124,
    32,
    0,
    65,
    200,
    0,
    106,
    41,
    3,
    0,
    32,
    14,
    133,
    66,
    159,
    216,
    249,
    217,
    194,
    145,
    218,
    130,
    155,
    127,
    133,
    66,
    32,
    137,
    34,
    14,
    66,
    187,
    206,
    170,
    166,
    216,
    208,
    235,
    179,
    187,
    127,
    124,
    34,
    16,
    32,
    11,
    133,
    66,
    40,
    137,
    34,
    17,
    124,
    34,
    18,
    32,
    14,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    16,
    124,
    34,
    20,
    32,
    17,
    133,
    66,
    1,
    137,
    34,
    21,
    124,
    34,
    22,
    32,
    0,
    65,
    152,
    1,
    106,
    41,
    3,
    0,
    34,
    14,
    124,
    32,
    22,
    32,
    0,
    41,
    3,
    56,
    34,
    23,
    32,
    0,
    41,
    3,
    24,
    34,
    24,
    124,
    32,
    0,
    65,
    128,
    1,
    106,
    41,
    3,
    0,
    34,
    16,
    124,
    34,
    25,
    32,
    0,
    65,
    136,
    1,
    106,
    41,
    3,
    0,
    34,
    17,
    124,
    32,
    25,
    66,
    249,
    194,
    248,
    155,
    145,
    163,
    179,
    240,
    219,
    0,
    133,
    66,
    32,
    137,
    34,
    25,
    66,
    241,
    237,
    244,
    248,
    165,
    167,
    253,
    167,
    165,
    127,
    124,
    34,
    26,
    32,
    23,
    133,
    66,
    40,
    137,
    34,
    27,
    124,
    34,
    28,
    32,
    25,
    133,
    66,
    48,
    137,
    34,
    29,
    133,
    66,
    32,
    137,
    34,
    30,
    32,
    0,
    41,
    3,
    48,
    34,
    31,
    32,
    0,
    41,
    3,
    16,
    34,
    32,
    124,
    32,
    0,
    65,
    240,
    0,
    106,
    41,
    3,
    0,
    34,
    22,
    124,
    34,
    33,
    32,
    0,
    65,
    248,
    0,
    106,
    41,
    3,
    0,
    34,
    25,
    124,
    32,
    33,
    65,
    0,
    32,
    1,
    107,
    172,
    133,
    66,
    235,
    250,
    134,
    218,
    191,
    181,
    246,
    193,
    31,
    133,
    66,
    32,
    137,
    34,
    33,
    66,
    171,
    240,
    211,
    244,
    175,
    238,
    188,
    183,
    60,
    124,
    34,
    34,
    32,
    31,
    133,
    66,
    40,
    137,
    34,
    35,
    124,
    34,
    36,
    32,
    33,
    133,
    66,
    48,
    137,
    34,
    33,
    32,
    34,
    124,
    34,
    34,
    124,
    34,
    37,
    32,
    21,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    39,
    32,
    0,
    65,
    192,
    1,
    106,
    41,
    3,
    0,
    34,
    21,
    124,
    32,
    10,
    32,
    7,
    133,
    66,
    48,
    137,
    34,
    40,
    32,
    8,
    124,
    34,
    41,
    32,
    9,
    133,
    66,
    1,
    137,
    34,
    8,
    32,
    21,
    124,
    32,
    28,
    124,
    34,
    9,
    32,
    0,
    65,
    200,
    1,
    106,
    41,
    3,
    0,
    34,
    7,
    124,
    32,
    9,
    32,
    33,
    133,
    66,
    32,
    137,
    34,
    9,
    32,
    20,
    124,
    34,
    10,
    32,
    8,
    133,
    66,
    40,
    137,
    34,
    8,
    124,
    34,
    20,
    32,
    9,
    133,
    66,
    48,
    137,
    34,
    28,
    32,
    10,
    124,
    34,
    33,
    32,
    8,
    133,
    66,
    1,
    137,
    34,
    42,
    124,
    34,
    43,
    32,
    0,
    65,
    160,
    1,
    106,
    41,
    3,
    0,
    34,
    8,
    124,
    32,
    36,
    32,
    0,
    65,
    176,
    1,
    106,
    41,
    3,
    0,
    34,
    9,
    124,
    32,
    29,
    32,
    26,
    124,
    34,
    26,
    32,
    27,
    133,
    66,
    1,
    137,
    34,
    27,
    124,
    34,
    29,
    32,
    0,
    65,
    184,
    1,
    106,
    41,
    3,
    0,
    34,
    10,
    124,
    32,
    29,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    41,
    124,
    34,
    29,
    32,
    27,
    133,
    66,
    40,
    137,
    34,
    27,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    29,
    124,
    34,
    29,
    32,
    43,
    32,
    18,
    32,
    8,
    124,
    32,
    34,
    32,
    35,
    133,
    66,
    1,
    137,
    34,
    34,
    124,
    34,
    35,
    32,
    0,
    65,
    168,
    1,
    106,
    41,
    3,
    0,
    34,
    18,
    124,
    32,
    35,
    32,
    40,
    133,
    66,
    32,
    137,
    34,
    35,
    32,
    26,
    124,
    34,
    26,
    32,
    34,
    133,
    66,
    40,
    137,
    34,
    34,
    124,
    34,
    40,
    32,
    35,
    133,
    66,
    48,
    137,
    34,
    35,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    42,
    133,
    66,
    40,
    137,
    34,
    42,
    124,
    34,
    44,
    32,
    6,
    124,
    32,
    40,
    32,
    22,
    124,
    32,
    39,
    32,
    30,
    133,
    66,
    48,
    137,
    34,
    30,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    39,
    32,
    5,
    124,
    32,
    39,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    33,
    124,
    34,
    33,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    39,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    33,
    124,
    34,
    33,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    9,
    124,
    32,
    40,
    32,
    20,
    32,
    10,
    124,
    32,
    29,
    32,
    27,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    27,
    32,
    16,
    124,
    32,
    27,
    32,
    30,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    35,
    32,
    26,
    124,
    34,
    26,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    30,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    133,
    66,
    32,
    137,
    34,
    35,
    32,
    36,
    32,
    14,
    124,
    32,
    26,
    32,
    34,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    34,
    32,
    7,
    124,
    32,
    34,
    32,
    28,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    37,
    124,
    34,
    34,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    32,
    34,
    124,
    34,
    34,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    18,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    42,
    133,
    66,
    1,
    137,
    34,
    42,
    32,
    25,
    124,
    32,
    30,
    124,
    34,
    30,
    32,
    15,
    124,
    32,
    30,
    32,
    28,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    33,
    124,
    34,
    30,
    32,
    42,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    42,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    5,
    124,
    32,
    36,
    32,
    18,
    124,
    32,
    27,
    32,
    29,
    124,
    34,
    27,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    29,
    32,
    17,
    124,
    32,
    29,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    29,
    124,
    34,
    29,
    32,
    44,
    32,
    39,
    32,
    4,
    124,
    32,
    34,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    34,
    32,
    13,
    124,
    32,
    34,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    27,
    124,
    34,
    27,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    39,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    8,
    124,
    32,
    39,
    32,
    9,
    124,
    32,
    40,
    32,
    35,
    133,
    66,
    48,
    137,
    34,
    35,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    39,
    32,
    4,
    124,
    32,
    39,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    39,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    21,
    124,
    32,
    40,
    32,
    42,
    32,
    7,
    124,
    32,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    29,
    32,
    10,
    124,
    32,
    29,
    32,
    35,
    133,
    66,
    32,
    137,
    34,
    29,
    32,
    34,
    32,
    27,
    124,
    34,
    27,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    29,
    133,
    66,
    48,
    137,
    34,
    29,
    133,
    66,
    32,
    137,
    34,
    40,
    32,
    36,
    32,
    25,
    124,
    32,
    27,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    27,
    32,
    13,
    124,
    32,
    27,
    32,
    28,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    17,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    14,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    22,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    14,
    124,
    32,
    36,
    32,
    17,
    124,
    32,
    29,
    32,
    34,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    6,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    39,
    32,
    15,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    16,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    39,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    13,
    124,
    32,
    39,
    32,
    15,
    124,
    32,
    42,
    32,
    40,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    6,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    16,
    124,
    32,
    42,
    32,
    35,
    32,
    18,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    21,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    10,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    9,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    14,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    7,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    5,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    4,
    124,
    32,
    36,
    32,
    22,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    4,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    25,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    8,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    21,
    124,
    32,
    40,
    32,
    25,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    17,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    6,
    124,
    32,
    42,
    32,
    35,
    32,
    8,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    7,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    13,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    22,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    13,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    15,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    10,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    9,
    124,
    32,
    36,
    32,
    16,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    5,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    18,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    9,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    22,
    124,
    32,
    40,
    32,
    16,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    8,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    10,
    124,
    32,
    42,
    32,
    35,
    32,
    5,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    15,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    4,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    18,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    9,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    6,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    14,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    25,
    124,
    32,
    36,
    32,
    7,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    21,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    17,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    25,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    4,
    124,
    32,
    40,
    32,
    6,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    7,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    17,
    124,
    32,
    42,
    32,
    35,
    32,
    22,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    8,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    21,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    10,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    10,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    5,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    18,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    18,
    124,
    32,
    36,
    32,
    14,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    13,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    16,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    15,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    25,
    124,
    32,
    40,
    32,
    17,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    21,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    4,
    124,
    32,
    42,
    32,
    35,
    32,
    15,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    14,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    9,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    6,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    16,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    13,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    8,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    7,
    124,
    32,
    36,
    32,
    5,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    16,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    7,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    22,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    9,
    124,
    32,
    40,
    32,
    21,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    14,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    13,
    124,
    32,
    42,
    32,
    35,
    32,
    4,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    5,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    18,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    15,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    8,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    8,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    25,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    13,
    124,
    32,
    36,
    32,
    6,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    22,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    10,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    17,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    7,
    124,
    32,
    40,
    32,
    5,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    22,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    18,
    124,
    32,
    42,
    32,
    35,
    32,
    6,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    25,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    17,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    16,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    4,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    10,
    124,
    32,
    35,
    124,
    34,
    35,
    32,
    4,
    124,
    32,
    35,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    35,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    30,
    124,
    34,
    30,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    6,
    124,
    32,
    36,
    32,
    15,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    9,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    44,
    32,
    40,
    32,
    14,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    21,
    124,
    32,
    28,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    28,
    32,
    29,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    40,
    32,
    28,
    133,
    66,
    48,
    137,
    34,
    28,
    133,
    66,
    32,
    137,
    34,
    41,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    33,
    124,
    34,
    44,
    32,
    5,
    124,
    32,
    40,
    32,
    13,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    39,
    32,
    37,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    15,
    124,
    32,
    40,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    40,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    30,
    124,
    34,
    30,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    14,
    124,
    32,
    42,
    32,
    35,
    32,
    16,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    17,
    124,
    32,
    34,
    32,
    39,
    133,
    66,
    32,
    137,
    34,
    34,
    32,
    28,
    32,
    29,
    124,
    34,
    28,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    35,
    32,
    34,
    133,
    66,
    48,
    137,
    34,
    34,
    133,
    66,
    32,
    137,
    34,
    39,
    32,
    36,
    32,
    22,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    26,
    124,
    34,
    28,
    32,
    25,
    124,
    32,
    28,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    37,
    124,
    34,
    28,
    32,
    26,
    133,
    66,
    40,
    137,
    34,
    26,
    124,
    34,
    36,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    27,
    32,
    28,
    124,
    34,
    28,
    124,
    34,
    37,
    32,
    38,
    133,
    66,
    40,
    137,
    34,
    38,
    124,
    34,
    42,
    32,
    21,
    124,
    32,
    44,
    32,
    41,
    133,
    66,
    48,
    137,
    34,
    41,
    32,
    43,
    124,
    34,
    43,
    32,
    33,
    133,
    66,
    1,
    137,
    34,
    33,
    32,
    21,
    124,
    32,
    35,
    124,
    34,
    21,
    32,
    7,
    124,
    32,
    21,
    32,
    27,
    133,
    66,
    32,
    137,
    34,
    21,
    32,
    30,
    124,
    34,
    27,
    32,
    33,
    133,
    66,
    40,
    137,
    34,
    30,
    124,
    34,
    33,
    32,
    21,
    133,
    66,
    48,
    137,
    34,
    21,
    32,
    27,
    124,
    34,
    27,
    32,
    30,
    133,
    66,
    1,
    137,
    34,
    30,
    124,
    34,
    35,
    32,
    8,
    124,
    32,
    36,
    32,
    9,
    124,
    32,
    34,
    32,
    29,
    124,
    34,
    29,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    20,
    124,
    34,
    34,
    32,
    10,
    124,
    32,
    34,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    19,
    32,
    43,
    124,
    34,
    34,
    32,
    20,
    133,
    66,
    40,
    137,
    34,
    20,
    124,
    34,
    36,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    19,
    32,
    34,
    124,
    34,
    34,
    32,
    35,
    32,
    40,
    32,
    8,
    124,
    32,
    28,
    32,
    26,
    133,
    66,
    1,
    137,
    34,
    8,
    124,
    34,
    26,
    32,
    18,
    124,
    32,
    26,
    32,
    41,
    133,
    66,
    32,
    137,
    34,
    26,
    32,
    29,
    124,
    34,
    28,
    32,
    8,
    133,
    66,
    40,
    137,
    34,
    8,
    124,
    34,
    29,
    32,
    26,
    133,
    66,
    48,
    137,
    34,
    26,
    133,
    66,
    32,
    137,
    34,
    35,
    124,
    34,
    40,
    32,
    30,
    133,
    66,
    40,
    137,
    34,
    30,
    124,
    34,
    41,
    32,
    6,
    124,
    32,
    29,
    32,
    22,
    124,
    32,
    42,
    32,
    39,
    133,
    66,
    48,
    137,
    34,
    6,
    32,
    37,
    124,
    34,
    22,
    32,
    38,
    133,
    66,
    1,
    137,
    34,
    29,
    124,
    34,
    37,
    32,
    5,
    124,
    32,
    37,
    32,
    19,
    133,
    66,
    32,
    137,
    34,
    5,
    32,
    27,
    124,
    34,
    19,
    32,
    29,
    133,
    66,
    40,
    137,
    34,
    27,
    124,
    34,
    29,
    32,
    5,
    133,
    66,
    48,
    137,
    34,
    5,
    32,
    19,
    124,
    34,
    19,
    32,
    27,
    133,
    66,
    1,
    137,
    34,
    27,
    124,
    34,
    37,
    32,
    9,
    124,
    32,
    37,
    32,
    33,
    32,
    10,
    124,
    32,
    34,
    32,
    20,
    133,
    66,
    1,
    137,
    34,
    9,
    124,
    34,
    10,
    32,
    16,
    124,
    32,
    10,
    32,
    6,
    133,
    66,
    32,
    137,
    34,
    6,
    32,
    26,
    32,
    28,
    124,
    34,
    16,
    124,
    34,
    10,
    32,
    9,
    133,
    66,
    40,
    137,
    34,
    9,
    124,
    34,
    20,
    32,
    6,
    133,
    66,
    48,
    137,
    34,
    6,
    133,
    66,
    32,
    137,
    34,
    26,
    32,
    36,
    32,
    14,
    124,
    32,
    16,
    32,
    8,
    133,
    66,
    1,
    137,
    34,
    14,
    124,
    34,
    16,
    32,
    7,
    124,
    32,
    16,
    32,
    21,
    133,
    66,
    32,
    137,
    34,
    16,
    32,
    22,
    124,
    34,
    22,
    32,
    14,
    133,
    66,
    40,
    137,
    34,
    14,
    124,
    34,
    21,
    32,
    16,
    133,
    66,
    48,
    137,
    34,
    16,
    32,
    22,
    124,
    34,
    22,
    124,
    34,
    7,
    32,
    27,
    133,
    66,
    40,
    137,
    34,
    8,
    124,
    34,
    27,
    32,
    3,
    133,
    32,
    21,
    32,
    18,
    124,
    32,
    6,
    32,
    10,
    124,
    34,
    6,
    32,
    9,
    133,
    66,
    1,
    137,
    34,
    21,
    124,
    34,
    9,
    32,
    17,
    124,
    32,
    9,
    32,
    5,
    133,
    66,
    32,
    137,
    34,
    5,
    32,
    41,
    32,
    35,
    133,
    66,
    48,
    137,
    34,
    17,
    32,
    40,
    124,
    34,
    9,
    124,
    34,
    10,
    32,
    21,
    133,
    66,
    40,
    137,
    34,
    21,
    124,
    34,
    18,
    32,
    5,
    133,
    66,
    48,
    137,
    34,
    5,
    32,
    10,
    124,
    34,
    10,
    133,
    55,
    3,
    0,
    32,
    0,
    32,
    32,
    32,
    27,
    32,
    26,
    133,
    66,
    48,
    137,
    34,
    3,
    32,
    7,
    124,
    34,
    7,
    133,
    32,
    18,
    133,
    55,
    3,
    16,
    32,
    0,
    32,
    3,
    32,
    23,
    133,
    32,
    10,
    32,
    21,
    133,
    66,
    1,
    137,
    133,
    55,
    3,
    56,
    32,
    0,
    32,
    11,
    32,
    7,
    32,
    8,
    133,
    66,
    1,
    137,
    133,
    32,
    5,
    133,
    55,
    3,
    40,
    32,
    0,
    32,
    24,
    32,
    15,
    32,
    25,
    32,
    9,
    32,
    30,
    133,
    66,
    1,
    137,
    34,
    5,
    124,
    32,
    20,
    124,
    34,
    25,
    124,
    32,
    25,
    32,
    16,
    133,
    66,
    32,
    137,
    34,
    15,
    32,
    19,
    124,
    34,
    16,
    32,
    5,
    133,
    66,
    40,
    137,
    34,
    5,
    124,
    34,
    25,
    133,
    32,
    13,
    32,
    29,
    32,
    4,
    124,
    32,
    22,
    32,
    14,
    133,
    66,
    1,
    137,
    34,
    4,
    124,
    34,
    14,
    124,
    32,
    14,
    32,
    17,
    133,
    66,
    32,
    137,
    34,
    13,
    32,
    6,
    124,
    34,
    6,
    32,
    4,
    133,
    66,
    40,
    137,
    34,
    4,
    124,
    34,
    14,
    32,
    13,
    133,
    66,
    48,
    137,
    34,
    13,
    32,
    6,
    124,
    34,
    6,
    133,
    55,
    3,
    24,
    32,
    0,
    32,
    31,
    32,
    25,
    32,
    15,
    133,
    66,
    48,
    137,
    34,
    15,
    133,
    32,
    6,
    32,
    4,
    133,
    66,
    1,
    137,
    133,
    55,
    3,
    48,
    32,
    0,
    32,
    12,
    32,
    15,
    32,
    16,
    124,
    34,
    4,
    133,
    32,
    14,
    133,
    55,
    3,
    8,
    32,
    0,
    32,
    2,
    32,
    4,
    32,
    5,
    133,
    66,
    1,
    137,
    133,
    32,
    13,
    133,
    55,
    3,
    32,
    11,
    188,
    2,
    3,
    3,
    127,
    2,
    126,
    1,
    127,
    2,
    64,
    32,
    0,
    40,
    2,
    208,
    1,
    34,
    2,
    65,
    255,
    0,
    75,
    13,
    0,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    3,
    32,
    2,
    33,
    4,
    3,
    64,
    2,
    64,
    32,
    4,
    13,
    0,
    32,
    3,
    65,
    0,
    65,
    128,
    1,
    252,
    11,
    0,
    11,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    128,
    1,
    71,
    13,
    0,
    11,
    11,
    32,
    0,
    32,
    0,
    41,
    3,
    64,
    34,
    5,
    32,
    2,
    173,
    124,
    34,
    6,
    55,
    3,
    64,
    2,
    64,
    32,
    6,
    32,
    5,
    90,
    13,
    0,
    32,
    0,
    65,
    200,
    0,
    106,
    34,
    4,
    32,
    4,
    41,
    3,
    0,
    66,
    1,
    124,
    55,
    3,
    0,
    11,
    32,
    0,
    65,
    1,
    16,
    152,
    128,
    128,
    128,
    0,
    32,
    0,
    40,
    2,
    212,
    1,
    34,
    7,
    33,
    3,
    2,
    64,
    32,
    7,
    65,
    8,
    73,
    13,
    0,
    32,
    7,
    65,
    3,
    118,
    33,
    2,
    32,
    1,
    33,
    4,
    32,
    0,
    33,
    3,
    3,
    64,
    32,
    4,
    32,
    3,
    41,
    3,
    0,
    16,
    154,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    8,
    106,
    33,
    4,
    32,
    3,
    65,
    8,
    106,
    33,
    3,
    32,
    2,
    65,
    127,
    106,
    34,
    2,
    13,
    0,
    11,
    32,
    0,
    40,
    2,
    212,
    1,
    33,
    3,
    11,
    2,
    64,
    32,
    7,
    65,
    120,
    113,
    34,
    4,
    32,
    3,
    79,
    13,
    0,
    32,
    7,
    65,
    3,
    116,
    65,
    64,
    113,
    33,
    3,
    3,
    64,
    32,
    1,
    32,
    4,
    106,
    32,
    0,
    32,
    4,
    65,
    120,
    113,
    106,
    41,
    3,
    0,
    32,
    3,
    65,
    56,
    113,
    173,
    136,
    60,
    0,
    0,
    32,
    3,
    65,
    8,
    106,
    33,
    3,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    32,
    0,
    40,
    2,
    212,
    1,
    73,
    13,
    0,
    11,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    0,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    216,
    1,
    71,
    13,
    0,
    11,
    11,
    9,
    0,
    32,
    0,
    32,
    1,
    55,
    0,
    0,
    11,
    79,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    1,
    107,
    34,
    6,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    8,
    106,
    32,
    1,
    32,
    2,
    32,
    3,
    16,
    148,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    8,
    106,
    32,
    4,
    32,
    5,
    16,
    149,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    8,
    106,
    32,
    0,
    16,
    153,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    224,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    21,
    0,
    32,
    0,
    65,
    192,
    0,
    65,
    0,
    65,
    0,
    32,
    1,
    32,
    2,
    16,
    155,
    128,
    128,
    128,
    0,
    11,
    70,
    0,
    32,
    0,
    65,
    136,
    1,
    106,
    65,
    128,
    137,
    128,
    128,
    0,
    65,
    192,
    0,
    252,
    10,
    0,
    0,
    32,
    0,
    66,
    0,
    55,
    3,
    200,
    1,
    32,
    0,
    66,
    200,
    146,
    247,
    149,
    255,
    204,
    249,
    132,
    234,
    0,
    55,
    3,
    136,
    1,
    32,
    0,
    65,
    208,
    1,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    0,
    66,
    128,
    128,
    128,
    128,
    128,
    8,
    55,
    3,
    216,
    2,
    11,
    18,
    0,
    32,
    0,
    65,
    136,
    1,
    106,
    32,
    1,
    32,
    2,
    16,
    149,
    128,
    128,
    128,
    0,
    11,
    16,
    0,
    32,
    0,
    65,
    136,
    1,
    106,
    32,
    1,
    16,
    153,
    128,
    128,
    128,
    0,
    11,
    164,
    12,
    3,
    11,
    127,
    2,
    126,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    240,
    24,
    107,
    34,
    13,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    13,
    65,
    128,
    137,
    128,
    128,
    0,
    65,
    192,
    0,
    252,
    10,
    0,
    0,
    32,
    13,
    65,
    200,
    0,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    13,
    66,
    0,
    55,
    3,
    64,
    32,
    13,
    66,
    200,
    146,
    247,
    149,
    255,
    204,
    249,
    132,
    234,
    0,
    55,
    3,
    0,
    32,
    13,
    66,
    128,
    128,
    128,
    128,
    128,
    8,
    55,
    3,
    208,
    1,
    32,
    13,
    65,
    1,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    1,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    3,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    4,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    65,
    19,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    65,
    1,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    6,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    5,
    32,
    6,
    16,
    149,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    8,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    7,
    32,
    8,
    16,
    149,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    10,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    9,
    32,
    10,
    16,
    149,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    12,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    11,
    32,
    12,
    16,
    149,
    128,
    128,
    128,
    0,
    32,
    13,
    32,
    13,
    65,
    160,
    24,
    106,
    16,
    153,
    128,
    128,
    128,
    0,
    32,
    13,
    66,
    0,
    55,
    3,
    224,
    24,
    32,
    13,
    65,
    160,
    16,
    106,
    65,
    128,
    8,
    32,
    13,
    65,
    160,
    24,
    106,
    65,
    200,
    0,
    16,
    162,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    136,
    8,
    106,
    32,
    12,
    106,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    16,
    130,
    128,
    128,
    128,
    0,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    2,
    32,
    13,
    65,
    136,
    8,
    106,
    65,
    128,
    8,
    252,
    10,
    0,
    0,
    32,
    13,
    65,
    1,
    54,
    2,
    224,
    24,
    32,
    13,
    65,
    160,
    16,
    106,
    65,
    128,
    8,
    32,
    13,
    65,
    160,
    24,
    106,
    65,
    200,
    0,
    16,
    162,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    136,
    8,
    106,
    32,
    12,
    106,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    16,
    130,
    128,
    128,
    128,
    0,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    128,
    8,
    106,
    32,
    13,
    65,
    136,
    8,
    106,
    65,
    128,
    8,
    252,
    10,
    0,
    0,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    160,
    24,
    106,
    32,
    12,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    12,
    65,
    1,
    106,
    34,
    12,
    65,
    200,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    12,
    65,
    1,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    136,
    8,
    106,
    32,
    12,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    124,
    113,
    33,
    14,
    2,
    64,
    32,
    4,
    69,
    13,
    0,
    32,
    2,
    65,
    128,
    112,
    106,
    33,
    15,
    32,
    3,
    65,
    2,
    118,
    34,
    16,
    65,
    10,
    116,
    33,
    17,
    32,
    2,
    65,
    128,
    120,
    106,
    33,
    18,
    65,
    0,
    33,
    19,
    3,
    64,
    32,
    2,
    33,
    20,
    65,
    0,
    33,
    21,
    3,
    64,
    32,
    13,
    65,
    0,
    54,
    2,
    152,
    16,
    32,
    13,
    32,
    4,
    54,
    2,
    148,
    16,
    32,
    13,
    32,
    14,
    54,
    2,
    144,
    16,
    32,
    13,
    32,
    19,
    54,
    2,
    136,
    16,
    32,
    13,
    32,
    21,
    54,
    2,
    140,
    16,
    2,
    64,
    2,
    64,
    32,
    21,
    32,
    19,
    114,
    34,
    12,
    69,
    13,
    0,
    32,
    13,
    65,
    0,
    54,
    2,
    156,
    16,
    12,
    1,
    11,
    32,
    13,
    66,
    129,
    128,
    128,
    128,
    32,
    55,
    3,
    152,
    16,
    32,
    13,
    65,
    136,
    8,
    106,
    16,
    163,
    128,
    128,
    128,
    0,
    11,
    2,
    64,
    32,
    12,
    69,
    65,
    1,
    116,
    34,
    12,
    32,
    21,
    32,
    16,
    108,
    106,
    34,
    22,
    32,
    21,
    65,
    1,
    106,
    34,
    21,
    32,
    16,
    108,
    79,
    13,
    0,
    32,
    16,
    32,
    12,
    107,
    33,
    23,
    32,
    20,
    32,
    12,
    65,
    10,
    116,
    106,
    33,
    10,
    65,
    0,
    33,
    7,
    32,
    22,
    33,
    11,
    3,
    64,
    2,
    64,
    32,
    13,
    40,
    2,
    156,
    16,
    34,
    12,
    65,
    255,
    0,
    113,
    34,
    8,
    13,
    0,
    32,
    13,
    32,
    13,
    40,
    2,
    152,
    16,
    65,
    1,
    106,
    54,
    2,
    152,
    16,
    32,
    13,
    65,
    136,
    8,
    106,
    16,
    163,
    128,
    128,
    128,
    0,
    32,
    13,
    40,
    2,
    156,
    16,
    34,
    12,
    65,
    255,
    0,
    113,
    33,
    8,
    11,
    32,
    13,
    32,
    12,
    65,
    1,
    106,
    54,
    2,
    156,
    16,
    32,
    13,
    65,
    136,
    8,
    106,
    32,
    8,
    65,
    3,
    116,
    106,
    53,
    2,
    0,
    33,
    24,
    32,
    13,
    40,
    2,
    144,
    16,
    33,
    8,
    32,
    13,
    40,
    2,
    136,
    16,
    33,
    6,
    32,
    13,
    40,
    2,
    140,
    16,
    33,
    9,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    18,
    32,
    11,
    32,
    14,
    32,
    11,
    27,
    65,
    10,
    116,
    106,
    65,
    128,
    8,
    252,
    10,
    0,
    0,
    66,
    0,
    32,
    8,
    173,
    34,
    25,
    65,
    3,
    32,
    9,
    32,
    6,
    27,
    32,
    8,
    65,
    2,
    118,
    34,
    8,
    108,
    34,
    26,
    32,
    12,
    106,
    34,
    5,
    65,
    126,
    106,
    173,
    32,
    24,
    32,
    24,
    126,
    66,
    32,
    136,
    32,
    5,
    65,
    127,
    106,
    173,
    126,
    66,
    32,
    136,
    34,
    24,
    125,
    32,
    9,
    65,
    1,
    106,
    65,
    3,
    113,
    32,
    8,
    108,
    65,
    0,
    32,
    6,
    27,
    34,
    8,
    173,
    124,
    32,
    25,
    84,
    27,
    33,
    25,
    2,
    64,
    2,
    64,
    32,
    19,
    69,
    13,
    0,
    32,
    15,
    32,
    8,
    32,
    12,
    106,
    32,
    26,
    106,
    65,
    10,
    116,
    32,
    25,
    167,
    32,
    24,
    167,
    106,
    65,
    10,
    116,
    107,
    106,
    33,
    6,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    34,
    8,
    32,
    8,
    41,
    3,
    0,
    32,
    6,
    32,
    12,
    106,
    41,
    3,
    0,
    133,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    10,
    32,
    12,
    106,
    34,
    8,
    32,
    8,
    41,
    3,
    0,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    41,
    3,
    0,
    133,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    13,
    65,
    160,
    16,
    106,
    16,
    164,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    10,
    32,
    12,
    106,
    34,
    8,
    32,
    8,
    41,
    3,
    0,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    41,
    3,
    0,
    133,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    12,
    2,
    11,
    11,
    32,
    2,
    32,
    22,
    32,
    7,
    106,
    65,
    10,
    116,
    106,
    33,
    9,
    32,
    15,
    32,
    8,
    32,
    12,
    106,
    32,
    26,
    106,
    65,
    10,
    116,
    32,
    25,
    167,
    32,
    24,
    167,
    106,
    65,
    10,
    116,
    107,
    106,
    33,
    6,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    34,
    8,
    32,
    8,
    41,
    3,
    0,
    32,
    6,
    32,
    12,
    106,
    41,
    3,
    0,
    133,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    9,
    32,
    13,
    65,
    160,
    16,
    106,
    65,
    128,
    8,
    252,
    10,
    0,
    0,
    32,
    13,
    65,
    160,
    16,
    106,
    16,
    164,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    10,
    32,
    12,
    106,
    34,
    8,
    32,
    8,
    41,
    3,
    0,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    41,
    3,
    0,
    133,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    11,
    32,
    10,
    65,
    128,
    8,
    106,
    33,
    10,
    32,
    11,
    65,
    1,
    106,
    33,
    11,
    32,
    7,
    65,
    1,
    106,
    34,
    7,
    32,
    23,
    71,
    13,
    0,
    11,
    11,
    32,
    20,
    32,
    17,
    106,
    33,
    20,
    32,
    21,
    65,
    4,
    71,
    13,
    0,
    11,
    32,
    19,
    65,
    1,
    106,
    34,
    19,
    32,
    4,
    71,
    13,
    0,
    11,
    11,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    65,
    160,
    16,
    106,
    32,
    12,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    10,
    116,
    65,
    128,
    96,
    113,
    32,
    2,
    106,
    65,
    128,
    120,
    106,
    33,
    10,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    32,
    12,
    106,
    32,
    10,
    32,
    12,
    106,
    41,
    3,
    0,
    16,
    154,
    128,
    128,
    128,
    0,
    32,
    12,
    65,
    8,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    2,
    64,
    32,
    14,
    65,
    7,
    116,
    34,
    12,
    69,
    13,
    0,
    3,
    64,
    32,
    2,
    66,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    8,
    106,
    33,
    2,
    32,
    12,
    65,
    127,
    106,
    34,
    12,
    13,
    0,
    11,
    11,
    32,
    0,
    32,
    1,
    32,
    13,
    65,
    128,
    8,
    16,
    162,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    12,
    3,
    64,
    32,
    13,
    32,
    12,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    12,
    65,
    1,
    106,
    34,
    12,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    13,
    65,
    240,
    24,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    86,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    16,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    1,
    54,
    0,
    12,
    32,
    0,
    32,
    2,
    65,
    12,
    106,
    65,
    4,
    16,
    149,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    12,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    4,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    16,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    171,
    2,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    1,
    107,
    34,
    4,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    8,
    106,
    65,
    128,
    137,
    128,
    128,
    0,
    65,
    192,
    0,
    252,
    10,
    0,
    0,
    32,
    4,
    65,
    208,
    0,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    4,
    66,
    0,
    55,
    3,
    72,
    65,
    0,
    33,
    5,
    32,
    4,
    65,
    0,
    54,
    2,
    216,
    1,
    32,
    4,
    32,
    1,
    65,
    192,
    0,
    32,
    1,
    65,
    192,
    0,
    73,
    27,
    34,
    6,
    54,
    2,
    220,
    1,
    32,
    4,
    32,
    6,
    173,
    66,
    136,
    146,
    247,
    149,
    255,
    204,
    249,
    132,
    234,
    0,
    133,
    55,
    3,
    8,
    32,
    4,
    65,
    8,
    106,
    32,
    1,
    16,
    161,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    8,
    106,
    32,
    2,
    32,
    3,
    16,
    149,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    8,
    106,
    32,
    0,
    16,
    153,
    128,
    128,
    128,
    0,
    2,
    64,
    32,
    1,
    65,
    193,
    0,
    73,
    13,
    0,
    65,
    32,
    33,
    2,
    2,
    64,
    32,
    1,
    173,
    66,
    31,
    124,
    66,
    5,
    136,
    167,
    34,
    3,
    65,
    126,
    106,
    34,
    6,
    65,
    2,
    73,
    13,
    0,
    32,
    3,
    65,
    125,
    106,
    33,
    2,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    0,
    32,
    5,
    106,
    34,
    3,
    65,
    32,
    106,
    65,
    192,
    0,
    65,
    0,
    65,
    0,
    32,
    3,
    65,
    192,
    0,
    16,
    155,
    128,
    128,
    128,
    0,
    32,
    5,
    65,
    32,
    106,
    33,
    5,
    32,
    2,
    65,
    127,
    106,
    34,
    2,
    13,
    0,
    11,
    32,
    5,
    65,
    32,
    106,
    33,
    2,
    11,
    32,
    0,
    32,
    2,
    106,
    32,
    1,
    32,
    6,
    65,
    5,
    116,
    107,
    65,
    0,
    65,
    0,
    32,
    0,
    32,
    5,
    106,
    65,
    192,
    0,
    16,
    155,
    128,
    128,
    128,
    0,
    11,
    32,
    4,
    65,
    224,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    166,
    1,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    128,
    8,
    107,
    34,
    1,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    0,
    66,
    0,
    55,
    3,
    8,
    32,
    0,
    66,
    1,
    55,
    3,
    40,
    32,
    0,
    32,
    0,
    53,
    2,
    128,
    8,
    55,
    3,
    0,
    32,
    0,
    32,
    0,
    53,
    2,
    132,
    8,
    55,
    3,
    16,
    32,
    0,
    32,
    0,
    53,
    2,
    136,
    8,
    55,
    3,
    24,
    32,
    0,
    32,
    0,
    53,
    2,
    140,
    8,
    55,
    3,
    32,
    32,
    0,
    32,
    0,
    53,
    2,
    144,
    8,
    55,
    3,
    48,
    65,
    0,
    33,
    2,
    32,
    0,
    65,
    56,
    106,
    65,
    0,
    65,
    200,
    7,
    252,
    11,
    0,
    32,
    0,
    32,
    1,
    16,
    217,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    1,
    16,
    217,
    128,
    128,
    128,
    0,
    3,
    64,
    32,
    1,
    32,
    2,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    8,
    106,
    34,
    2,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    128,
    8,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    140,
    23,
    30,
    3,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    2,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    3,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    2,
    126,
    65,
    112,
    33,
    1,
    32,
    0,
    33,
    2,
    3,
    64,
    32,
    2,
    32,
    2,
    65,
    24,
    106,
    34,
    3,
    41,
    3,
    0,
    34,
    4,
    32,
    2,
    65,
    56,
    106,
    34,
    5,
    41,
    3,
    0,
    34,
    6,
    124,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    4,
    32,
    2,
    65,
    248,
    0,
    106,
    34,
    7,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    8,
    32,
    2,
    65,
    216,
    0,
    106,
    34,
    9,
    41,
    3,
    0,
    34,
    10,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    10,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    10,
    32,
    6,
    133,
    66,
    40,
    137,
    34,
    6,
    32,
    4,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    4,
    32,
    8,
    133,
    66,
    48,
    137,
    34,
    8,
    32,
    2,
    65,
    8,
    106,
    34,
    11,
    41,
    3,
    0,
    34,
    12,
    32,
    2,
    65,
    40,
    106,
    34,
    13,
    41,
    3,
    0,
    34,
    14,
    124,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    12,
    32,
    2,
    65,
    232,
    0,
    106,
    34,
    15,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    16,
    32,
    2,
    65,
    200,
    0,
    106,
    34,
    17,
    41,
    3,
    0,
    34,
    18,
    124,
    32,
    16,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    18,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    18,
    32,
    14,
    133,
    66,
    40,
    137,
    34,
    14,
    32,
    12,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    12,
    32,
    16,
    133,
    66,
    48,
    137,
    34,
    16,
    32,
    18,
    124,
    32,
    16,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    18,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    18,
    32,
    14,
    133,
    66,
    1,
    137,
    34,
    14,
    32,
    2,
    41,
    3,
    0,
    34,
    19,
    32,
    2,
    65,
    32,
    106,
    34,
    20,
    41,
    3,
    0,
    34,
    21,
    124,
    32,
    19,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    21,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    19,
    32,
    2,
    65,
    224,
    0,
    106,
    34,
    22,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    23,
    32,
    2,
    65,
    192,
    0,
    106,
    34,
    24,
    41,
    3,
    0,
    34,
    25,
    124,
    32,
    23,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    25,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    25,
    32,
    21,
    133,
    66,
    40,
    137,
    34,
    21,
    32,
    19,
    124,
    32,
    21,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    19,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    19,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    19,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    2,
    65,
    16,
    106,
    34,
    28,
    41,
    3,
    0,
    34,
    29,
    32,
    2,
    65,
    48,
    106,
    34,
    30,
    41,
    3,
    0,
    34,
    31,
    124,
    32,
    29,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    31,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    29,
    32,
    2,
    65,
    240,
    0,
    106,
    34,
    32,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    33,
    32,
    2,
    65,
    208,
    0,
    106,
    34,
    34,
    41,
    3,
    0,
    34,
    35,
    124,
    32,
    33,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    35,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    35,
    32,
    31,
    133,
    66,
    40,
    137,
    34,
    31,
    32,
    29,
    124,
    32,
    31,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    29,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    29,
    32,
    33,
    133,
    66,
    48,
    137,
    34,
    33,
    32,
    35,
    124,
    32,
    33,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    35,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    35,
    124,
    32,
    27,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    35,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    36,
    32,
    14,
    133,
    66,
    40,
    137,
    34,
    14,
    32,
    26,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    26,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    55,
    3,
    0,
    32,
    7,
    32,
    26,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    26,
    55,
    3,
    0,
    32,
    34,
    32,
    26,
    32,
    36,
    124,
    32,
    26,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    36,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    55,
    3,
    0,
    32,
    13,
    32,
    26,
    32,
    14,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    22,
    32,
    8,
    32,
    10,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    10,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    8,
    32,
    35,
    32,
    31,
    133,
    66,
    1,
    137,
    34,
    10,
    32,
    12,
    124,
    32,
    10,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    32,
    19,
    32,
    23,
    133,
    66,
    48,
    137,
    34,
    12,
    133,
    66,
    32,
    137,
    34,
    19,
    124,
    32,
    8,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    19,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    23,
    32,
    10,
    133,
    66,
    40,
    137,
    34,
    10,
    32,
    14,
    124,
    32,
    10,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    14,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    14,
    55,
    3,
    0,
    32,
    11,
    32,
    26,
    55,
    3,
    0,
    32,
    9,
    32,
    14,
    32,
    23,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    23,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    55,
    3,
    0,
    32,
    30,
    32,
    14,
    32,
    10,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    15,
    32,
    8,
    32,
    6,
    133,
    66,
    1,
    137,
    34,
    6,
    32,
    29,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    29,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    8,
    32,
    16,
    133,
    66,
    32,
    137,
    34,
    10,
    32,
    12,
    32,
    25,
    124,
    32,
    12,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    25,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    124,
    32,
    10,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    14,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    12,
    32,
    6,
    133,
    66,
    40,
    137,
    34,
    6,
    32,
    8,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    8,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    16,
    32,
    10,
    133,
    66,
    48,
    137,
    34,
    8,
    55,
    3,
    0,
    32,
    28,
    32,
    16,
    55,
    3,
    0,
    32,
    24,
    32,
    8,
    32,
    12,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    8,
    55,
    3,
    0,
    32,
    5,
    32,
    8,
    32,
    6,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    32,
    32,
    4,
    32,
    14,
    32,
    21,
    133,
    66,
    1,
    137,
    34,
    6,
    124,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    4,
    32,
    33,
    133,
    66,
    32,
    137,
    34,
    8,
    32,
    18,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    18,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    10,
    32,
    6,
    133,
    66,
    40,
    137,
    34,
    6,
    32,
    4,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    32,
    8,
    133,
    66,
    48,
    137,
    34,
    4,
    55,
    3,
    0,
    32,
    3,
    32,
    14,
    55,
    3,
    0,
    32,
    17,
    32,
    4,
    32,
    10,
    124,
    32,
    4,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    10,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    4,
    55,
    3,
    0,
    32,
    20,
    32,
    4,
    32,
    6,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    2,
    65,
    128,
    1,
    106,
    33,
    2,
    32,
    1,
    65,
    16,
    106,
    34,
    1,
    65,
    240,
    0,
    73,
    13,
    0,
    11,
    32,
    0,
    65,
    136,
    7,
    106,
    33,
    2,
    65,
    126,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    248,
    120,
    106,
    34,
    3,
    32,
    2,
    65,
    128,
    122,
    106,
    34,
    5,
    41,
    3,
    0,
    34,
    4,
    32,
    2,
    65,
    128,
    124,
    106,
    34,
    7,
    41,
    3,
    0,
    34,
    6,
    124,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    4,
    32,
    2,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    8,
    32,
    2,
    65,
    128,
    126,
    106,
    34,
    9,
    41,
    3,
    0,
    34,
    10,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    10,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    10,
    32,
    6,
    133,
    66,
    40,
    137,
    34,
    6,
    32,
    4,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    4,
    32,
    8,
    133,
    66,
    48,
    137,
    34,
    8,
    32,
    2,
    65,
    128,
    121,
    106,
    34,
    11,
    41,
    3,
    0,
    34,
    12,
    32,
    2,
    65,
    128,
    123,
    106,
    34,
    13,
    41,
    3,
    0,
    34,
    14,
    124,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    12,
    32,
    2,
    65,
    128,
    127,
    106,
    34,
    15,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    16,
    32,
    2,
    65,
    128,
    125,
    106,
    34,
    17,
    41,
    3,
    0,
    34,
    18,
    124,
    32,
    16,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    18,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    18,
    32,
    14,
    133,
    66,
    40,
    137,
    34,
    14,
    32,
    12,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    12,
    32,
    16,
    133,
    66,
    48,
    137,
    34,
    16,
    32,
    18,
    124,
    32,
    16,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    18,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    18,
    32,
    14,
    133,
    66,
    1,
    137,
    34,
    14,
    32,
    3,
    41,
    3,
    0,
    34,
    19,
    32,
    2,
    65,
    248,
    122,
    106,
    34,
    3,
    41,
    3,
    0,
    34,
    21,
    124,
    32,
    19,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    21,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    19,
    32,
    2,
    65,
    248,
    126,
    106,
    34,
    20,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    23,
    32,
    2,
    65,
    248,
    124,
    106,
    34,
    22,
    41,
    3,
    0,
    34,
    25,
    124,
    32,
    23,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    25,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    25,
    32,
    21,
    133,
    66,
    40,
    137,
    34,
    21,
    32,
    19,
    124,
    32,
    21,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    19,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    19,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    19,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    133,
    66,
    32,
    137,
    34,
    27,
    32,
    2,
    65,
    248,
    121,
    106,
    34,
    24,
    41,
    3,
    0,
    34,
    29,
    32,
    2,
    65,
    248,
    123,
    106,
    34,
    28,
    41,
    3,
    0,
    34,
    31,
    124,
    32,
    29,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    31,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    29,
    32,
    2,
    65,
    120,
    106,
    34,
    30,
    41,
    3,
    0,
    133,
    66,
    32,
    137,
    34,
    33,
    32,
    2,
    65,
    248,
    125,
    106,
    34,
    32,
    41,
    3,
    0,
    34,
    35,
    124,
    32,
    33,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    35,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    35,
    32,
    31,
    133,
    66,
    40,
    137,
    34,
    31,
    32,
    29,
    124,
    32,
    31,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    29,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    29,
    32,
    33,
    133,
    66,
    48,
    137,
    34,
    33,
    32,
    35,
    124,
    32,
    33,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    35,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    35,
    124,
    32,
    27,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    35,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    36,
    32,
    14,
    133,
    66,
    40,
    137,
    34,
    14,
    32,
    26,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    26,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    55,
    3,
    0,
    32,
    2,
    32,
    26,
    32,
    27,
    133,
    66,
    48,
    137,
    34,
    26,
    55,
    3,
    0,
    32,
    32,
    32,
    26,
    32,
    36,
    124,
    32,
    26,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    36,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    55,
    3,
    0,
    32,
    13,
    32,
    26,
    32,
    14,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    20,
    32,
    8,
    32,
    10,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    10,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    8,
    32,
    35,
    32,
    31,
    133,
    66,
    1,
    137,
    34,
    10,
    32,
    12,
    124,
    32,
    10,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    32,
    19,
    32,
    23,
    133,
    66,
    48,
    137,
    34,
    12,
    133,
    66,
    32,
    137,
    34,
    19,
    124,
    32,
    8,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    19,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    23,
    32,
    10,
    133,
    66,
    40,
    137,
    34,
    10,
    32,
    14,
    124,
    32,
    10,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    14,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    26,
    32,
    19,
    133,
    66,
    48,
    137,
    34,
    14,
    55,
    3,
    0,
    32,
    11,
    32,
    26,
    55,
    3,
    0,
    32,
    9,
    32,
    14,
    32,
    23,
    124,
    32,
    14,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    23,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    55,
    3,
    0,
    32,
    28,
    32,
    14,
    32,
    10,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    15,
    32,
    8,
    32,
    6,
    133,
    66,
    1,
    137,
    34,
    6,
    32,
    29,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    29,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    8,
    32,
    16,
    133,
    66,
    32,
    137,
    34,
    10,
    32,
    12,
    32,
    25,
    124,
    32,
    12,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    25,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    124,
    32,
    10,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    14,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    12,
    32,
    6,
    133,
    66,
    40,
    137,
    34,
    6,
    32,
    8,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    8,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    16,
    32,
    10,
    133,
    66,
    48,
    137,
    34,
    8,
    55,
    3,
    0,
    32,
    24,
    32,
    16,
    55,
    3,
    0,
    32,
    22,
    32,
    8,
    32,
    12,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    12,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    8,
    55,
    3,
    0,
    32,
    7,
    32,
    8,
    32,
    6,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    30,
    32,
    4,
    32,
    14,
    32,
    21,
    133,
    66,
    1,
    137,
    34,
    6,
    124,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    126,
    124,
    34,
    4,
    32,
    33,
    133,
    66,
    32,
    137,
    34,
    8,
    32,
    18,
    124,
    32,
    8,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    18,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    10,
    32,
    6,
    133,
    66,
    40,
    137,
    34,
    6,
    32,
    4,
    124,
    32,
    6,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    4,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    14,
    32,
    8,
    133,
    66,
    48,
    137,
    34,
    4,
    55,
    3,
    0,
    32,
    5,
    32,
    14,
    55,
    3,
    0,
    32,
    17,
    32,
    4,
    32,
    10,
    124,
    32,
    4,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    32,
    10,
    66,
    1,
    134,
    66,
    254,
    255,
    255,
    255,
    31,
    131,
    126,
    124,
    34,
    4,
    55,
    3,
    0,
    32,
    3,
    32,
    4,
    32,
    6,
    133,
    66,
    1,
    137,
    55,
    3,
    0,
    32,
    2,
    65,
    16,
    106,
    33,
    2,
    32,
    1,
    65,
    2,
    106,
    34,
    1,
    65,
    14,
    73,
    13,
    0,
    11,
    11,
    34,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    32,
    4,
    32,
    5,
    32,
    6,
    32,
    7,
    32,
    8,
    65,
    0,
    65,
    0,
    65,
    0,
    65,
    0,
    16,
    160,
    128,
    128,
    128,
    0,
    11,
    164,
    1,
    2,
    1,
    127,
    1,
    126,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    32,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    24,
    106,
    32,
    1,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    32,
    1,
    41,
    0,
    0,
    34,
    4,
    55,
    3,
    0,
    32,
    3,
    32,
    1,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    3,
    8,
    32,
    3,
    32,
    4,
    167,
    65,
    248,
    1,
    113,
    58,
    0,
    0,
    32,
    3,
    32,
    3,
    45,
    0,
    31,
    65,
    63,
    113,
    65,
    192,
    0,
    114,
    58,
    0,
    31,
    32,
    0,
    32,
    3,
    32,
    2,
    65,
    255,
    1,
    16,
    167,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    32,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    241,
    10,
    1,
    9,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    208,
    2,
    107,
    34,
    4,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    160,
    2,
    106,
    32,
    2,
    16,
    168,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    1,
    54,
    2,
    240,
    1,
    65,
    0,
    33,
    5,
    32,
    4,
    65,
    240,
    1,
    106,
    65,
    4,
    114,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    4,
    65,
    192,
    1,
    106,
    65,
    0,
    65,
    40,
    252,
    11,
    0,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    4,
    65,
    160,
    2,
    106,
    65,
    40,
    252,
    10,
    0,
    0,
    32,
    4,
    65,
    1,
    54,
    2,
    96,
    32,
    4,
    65,
    224,
    0,
    106,
    65,
    4,
    114,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    65,
    0,
    33,
    6,
    2,
    64,
    32,
    3,
    65,
    1,
    72,
    13,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    65,
    0,
    32,
    1,
    32,
    3,
    65,
    127,
    106,
    34,
    7,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    7,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    34,
    6,
    32,
    2,
    115,
    107,
    33,
    8,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    2,
    106,
    34,
    9,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    2,
    106,
    34,
    10,
    40,
    2,
    0,
    34,
    11,
    32,
    9,
    40,
    2,
    0,
    34,
    9,
    115,
    32,
    8,
    113,
    34,
    12,
    32,
    9,
    115,
    54,
    2,
    0,
    32,
    10,
    32,
    12,
    32,
    11,
    115,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    34,
    9,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    34,
    10,
    40,
    2,
    0,
    34,
    11,
    32,
    9,
    40,
    2,
    0,
    34,
    9,
    115,
    32,
    8,
    113,
    34,
    12,
    32,
    9,
    115,
    54,
    2,
    0,
    32,
    10,
    32,
    12,
    32,
    11,
    115,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    48,
    106,
    32,
    2,
    106,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    2,
    106,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    2,
    106,
    34,
    8,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    8,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    4,
    65,
    48,
    106,
    32,
    4,
    65,
    240,
    1,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    48,
    106,
    32,
    4,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    4,
    65,
    240,
    1,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    2,
    106,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    34,
    8,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    8,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    4,
    32,
    4,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    2,
    106,
    34,
    8,
    32,
    8,
    40,
    2,
    0,
    32,
    4,
    65,
    48,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    4,
    65,
    192,
    1,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    4,
    65,
    194,
    182,
    7,
    16,
    171,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    4,
    65,
    144,
    1,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    48,
    106,
    32,
    2,
    106,
    34,
    8,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    40,
    2,
    0,
    32,
    8,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    1,
    74,
    33,
    8,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    4,
    65,
    160,
    2,
    106,
    32,
    4,
    65,
    192,
    1,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    4,
    32,
    4,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    7,
    33,
    3,
    32,
    6,
    33,
    2,
    32,
    8,
    13,
    0,
    11,
    11,
    65,
    0,
    32,
    6,
    107,
    33,
    8,
    3,
    64,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    5,
    106,
    34,
    2,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    5,
    106,
    34,
    9,
    40,
    2,
    0,
    34,
    10,
    32,
    2,
    40,
    2,
    0,
    34,
    2,
    115,
    32,
    8,
    113,
    34,
    11,
    32,
    2,
    115,
    54,
    2,
    0,
    32,
    9,
    32,
    11,
    32,
    10,
    115,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    34,
    9,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    34,
    10,
    40,
    2,
    0,
    34,
    11,
    32,
    9,
    40,
    2,
    0,
    34,
    9,
    115,
    32,
    8,
    113,
    34,
    12,
    32,
    9,
    115,
    54,
    2,
    0,
    32,
    10,
    32,
    12,
    32,
    11,
    115,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    4,
    65,
    192,
    1,
    106,
    16,
    172,
    128,
    128,
    128,
    0,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    4,
    65,
    192,
    1,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    4,
    65,
    240,
    1,
    106,
    16,
    173,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    160,
    2,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    240,
    1,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    192,
    1,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    48,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    144,
    1,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    208,
    2,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    156,
    5,
    1,
    24,
    126,
    32,
    1,
    49,
    0,
    31,
    33,
    2,
    32,
    1,
    49,
    0,
    30,
    33,
    3,
    32,
    1,
    49,
    0,
    29,
    33,
    4,
    32,
    1,
    49,
    0,
    28,
    33,
    5,
    32,
    1,
    49,
    0,
    27,
    33,
    6,
    32,
    1,
    49,
    0,
    26,
    33,
    7,
    32,
    1,
    49,
    0,
    25,
    33,
    8,
    32,
    1,
    49,
    0,
    24,
    33,
    9,
    32,
    1,
    49,
    0,
    23,
    33,
    10,
    32,
    1,
    49,
    0,
    12,
    33,
    11,
    32,
    1,
    49,
    0,
    11,
    33,
    12,
    32,
    1,
    49,
    0,
    10,
    33,
    13,
    32,
    1,
    53,
    0,
    16,
    33,
    14,
    32,
    1,
    49,
    0,
    15,
    33,
    15,
    32,
    1,
    49,
    0,
    14,
    33,
    16,
    32,
    1,
    49,
    0,
    13,
    33,
    17,
    32,
    1,
    49,
    0,
    22,
    33,
    18,
    32,
    1,
    49,
    0,
    21,
    33,
    19,
    32,
    1,
    49,
    0,
    20,
    33,
    20,
    32,
    0,
    32,
    1,
    49,
    0,
    5,
    66,
    14,
    134,
    32,
    1,
    49,
    0,
    4,
    66,
    6,
    134,
    132,
    32,
    1,
    49,
    0,
    6,
    66,
    22,
    134,
    132,
    32,
    1,
    53,
    0,
    0,
    34,
    21,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    22,
    66,
    26,
    136,
    124,
    34,
    23,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    24,
    66,
    25,
    136,
    32,
    1,
    49,
    0,
    8,
    66,
    13,
    134,
    32,
    1,
    49,
    0,
    7,
    66,
    5,
    134,
    132,
    32,
    1,
    49,
    0,
    9,
    66,
    21,
    134,
    132,
    124,
    34,
    25,
    32,
    25,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    25,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    8,
    32,
    0,
    32,
    14,
    32,
    16,
    66,
    10,
    134,
    32,
    17,
    66,
    2,
    134,
    132,
    32,
    15,
    66,
    18,
    134,
    132,
    34,
    15,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    16,
    66,
    26,
    136,
    124,
    34,
    14,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    17,
    66,
    25,
    136,
    32,
    19,
    66,
    15,
    134,
    32,
    20,
    66,
    7,
    134,
    132,
    32,
    18,
    66,
    23,
    134,
    132,
    124,
    34,
    18,
    32,
    18,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    18,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    24,
    32,
    0,
    32,
    25,
    66,
    26,
    136,
    32,
    12,
    66,
    11,
    134,
    32,
    13,
    66,
    3,
    134,
    132,
    32,
    11,
    66,
    19,
    134,
    132,
    124,
    34,
    11,
    32,
    11,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    11,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    12,
    32,
    0,
    32,
    18,
    66,
    26,
    136,
    32,
    9,
    66,
    13,
    134,
    32,
    10,
    66,
    5,
    134,
    132,
    32,
    8,
    66,
    21,
    134,
    132,
    124,
    34,
    8,
    32,
    8,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    8,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    28,
    32,
    0,
    32,
    15,
    32,
    16,
    66,
    128,
    128,
    128,
    32,
    131,
    125,
    32,
    11,
    66,
    25,
    136,
    124,
    34,
    9,
    32,
    9,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    9,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    16,
    32,
    0,
    32,
    9,
    66,
    26,
    136,
    32,
    14,
    124,
    32,
    17,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    20,
    32,
    0,
    32,
    8,
    66,
    25,
    136,
    32,
    6,
    66,
    12,
    134,
    32,
    7,
    66,
    4,
    134,
    132,
    32,
    5,
    66,
    20,
    134,
    132,
    124,
    34,
    5,
    32,
    5,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    5,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    32,
    32,
    0,
    32,
    3,
    66,
    10,
    134,
    32,
    4,
    66,
    2,
    134,
    132,
    32,
    2,
    66,
    18,
    134,
    66,
    128,
    128,
    240,
    15,
    131,
    132,
    32,
    5,
    66,
    26,
    136,
    124,
    34,
    2,
    32,
    2,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    2,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    36,
    32,
    0,
    32,
    23,
    32,
    24,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    2,
    66,
    25,
    136,
    66,
    19,
    126,
    32,
    21,
    32,
    22,
    66,
    128,
    128,
    128,
    224,
    31,
    131,
    125,
    124,
    34,
    2,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    3,
    66,
    26,
    136,
    124,
    62,
    2,
    4,
    32,
    0,
    32,
    2,
    32,
    3,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    0,
    11,
    201,
    9,
    24,
    1,
    127,
    1,
    126,
    1,
    127,
    3,
    126,
    1,
    127,
    2,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    2,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    2,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    23,
    126,
    32,
    0,
    32,
    2,
    40,
    2,
    4,
    34,
    3,
    172,
    34,
    4,
    32,
    1,
    40,
    2,
    20,
    34,
    5,
    65,
    1,
    116,
    172,
    34,
    6,
    126,
    32,
    2,
    52,
    2,
    0,
    34,
    7,
    32,
    1,
    52,
    2,
    24,
    34,
    8,
    126,
    124,
    32,
    2,
    40,
    2,
    8,
    34,
    9,
    172,
    34,
    10,
    32,
    1,
    52,
    2,
    16,
    34,
    11,
    126,
    124,
    32,
    2,
    40,
    2,
    12,
    34,
    12,
    172,
    34,
    13,
    32,
    1,
    40,
    2,
    12,
    34,
    14,
    65,
    1,
    116,
    172,
    34,
    15,
    126,
    124,
    32,
    2,
    40,
    2,
    16,
    34,
    16,
    172,
    34,
    17,
    32,
    1,
    52,
    2,
    8,
    34,
    18,
    126,
    124,
    32,
    2,
    40,
    2,
    20,
    34,
    19,
    172,
    34,
    20,
    32,
    1,
    40,
    2,
    4,
    34,
    21,
    65,
    1,
    116,
    172,
    34,
    22,
    126,
    124,
    32,
    2,
    40,
    2,
    24,
    34,
    23,
    172,
    34,
    24,
    32,
    1,
    52,
    2,
    0,
    34,
    25,
    126,
    124,
    32,
    2,
    40,
    2,
    28,
    34,
    26,
    65,
    19,
    108,
    172,
    34,
    27,
    32,
    1,
    40,
    2,
    36,
    34,
    28,
    65,
    1,
    116,
    172,
    34,
    29,
    126,
    124,
    32,
    2,
    40,
    2,
    32,
    34,
    30,
    65,
    19,
    108,
    172,
    34,
    31,
    32,
    1,
    52,
    2,
    32,
    34,
    32,
    126,
    124,
    32,
    2,
    40,
    2,
    36,
    34,
    2,
    65,
    19,
    108,
    172,
    34,
    33,
    32,
    1,
    40,
    2,
    28,
    34,
    1,
    65,
    1,
    116,
    172,
    34,
    34,
    126,
    124,
    32,
    4,
    32,
    11,
    126,
    32,
    7,
    32,
    5,
    172,
    34,
    35,
    126,
    124,
    32,
    10,
    32,
    14,
    172,
    34,
    36,
    126,
    124,
    32,
    13,
    32,
    18,
    126,
    124,
    32,
    17,
    32,
    21,
    172,
    34,
    37,
    126,
    124,
    32,
    20,
    32,
    25,
    126,
    124,
    32,
    23,
    65,
    19,
    108,
    172,
    34,
    38,
    32,
    28,
    172,
    34,
    39,
    126,
    124,
    32,
    27,
    32,
    32,
    126,
    124,
    32,
    31,
    32,
    1,
    172,
    34,
    40,
    126,
    124,
    32,
    33,
    32,
    8,
    126,
    124,
    32,
    4,
    32,
    15,
    126,
    32,
    7,
    32,
    11,
    126,
    124,
    32,
    10,
    32,
    18,
    126,
    124,
    32,
    13,
    32,
    22,
    126,
    124,
    32,
    17,
    32,
    25,
    126,
    124,
    32,
    19,
    65,
    19,
    108,
    172,
    34,
    41,
    32,
    29,
    126,
    124,
    32,
    38,
    32,
    32,
    126,
    124,
    32,
    27,
    32,
    34,
    126,
    124,
    32,
    31,
    32,
    8,
    126,
    124,
    32,
    33,
    32,
    6,
    126,
    124,
    34,
    42,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    43,
    66,
    26,
    135,
    124,
    34,
    44,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    45,
    66,
    25,
    135,
    124,
    34,
    46,
    32,
    46,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    47,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    24,
    32,
    0,
    32,
    4,
    32,
    22,
    126,
    32,
    7,
    32,
    18,
    126,
    124,
    32,
    10,
    32,
    25,
    126,
    124,
    32,
    12,
    65,
    19,
    108,
    172,
    34,
    48,
    32,
    29,
    126,
    124,
    32,
    32,
    32,
    16,
    65,
    19,
    108,
    172,
    34,
    46,
    126,
    124,
    32,
    41,
    32,
    34,
    126,
    124,
    32,
    38,
    32,
    8,
    126,
    124,
    32,
    27,
    32,
    6,
    126,
    124,
    32,
    31,
    32,
    11,
    126,
    124,
    32,
    33,
    32,
    15,
    126,
    124,
    32,
    4,
    32,
    25,
    126,
    32,
    7,
    32,
    37,
    126,
    124,
    32,
    9,
    65,
    19,
    108,
    172,
    34,
    49,
    32,
    39,
    126,
    124,
    32,
    48,
    32,
    32,
    126,
    124,
    32,
    46,
    32,
    40,
    126,
    124,
    32,
    41,
    32,
    8,
    126,
    124,
    32,
    38,
    32,
    35,
    126,
    124,
    32,
    27,
    32,
    11,
    126,
    124,
    32,
    31,
    32,
    36,
    126,
    124,
    32,
    33,
    32,
    18,
    126,
    124,
    32,
    3,
    65,
    19,
    108,
    172,
    32,
    29,
    126,
    32,
    7,
    32,
    25,
    126,
    124,
    32,
    49,
    32,
    32,
    126,
    124,
    32,
    48,
    32,
    34,
    126,
    124,
    32,
    46,
    32,
    8,
    126,
    124,
    32,
    41,
    32,
    6,
    126,
    124,
    32,
    38,
    32,
    11,
    126,
    124,
    32,
    27,
    32,
    15,
    126,
    124,
    32,
    31,
    32,
    18,
    126,
    124,
    32,
    33,
    32,
    22,
    126,
    124,
    34,
    49,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    50,
    66,
    26,
    135,
    124,
    34,
    51,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    52,
    66,
    25,
    135,
    124,
    34,
    48,
    32,
    48,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    53,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    8,
    32,
    0,
    32,
    4,
    32,
    8,
    126,
    32,
    7,
    32,
    40,
    126,
    124,
    32,
    10,
    32,
    35,
    126,
    124,
    32,
    13,
    32,
    11,
    126,
    124,
    32,
    17,
    32,
    36,
    126,
    124,
    32,
    20,
    32,
    18,
    126,
    124,
    32,
    24,
    32,
    37,
    126,
    124,
    32,
    25,
    32,
    26,
    172,
    34,
    48,
    126,
    124,
    32,
    31,
    32,
    39,
    126,
    124,
    32,
    33,
    32,
    32,
    126,
    124,
    32,
    47,
    66,
    26,
    135,
    124,
    34,
    47,
    32,
    47,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    47,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    28,
    32,
    0,
    32,
    4,
    32,
    18,
    126,
    32,
    7,
    32,
    36,
    126,
    124,
    32,
    10,
    32,
    37,
    126,
    124,
    32,
    13,
    32,
    25,
    126,
    124,
    32,
    46,
    32,
    39,
    126,
    124,
    32,
    41,
    32,
    32,
    126,
    124,
    32,
    38,
    32,
    40,
    126,
    124,
    32,
    27,
    32,
    8,
    126,
    124,
    32,
    31,
    32,
    35,
    126,
    124,
    32,
    33,
    32,
    11,
    126,
    124,
    32,
    53,
    66,
    26,
    135,
    124,
    34,
    31,
    32,
    31,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    31,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    12,
    32,
    0,
    32,
    4,
    32,
    34,
    126,
    32,
    7,
    32,
    32,
    126,
    124,
    32,
    10,
    32,
    8,
    126,
    124,
    32,
    13,
    32,
    6,
    126,
    124,
    32,
    17,
    32,
    11,
    126,
    124,
    32,
    20,
    32,
    15,
    126,
    124,
    32,
    24,
    32,
    18,
    126,
    124,
    32,
    48,
    32,
    22,
    126,
    124,
    32,
    25,
    32,
    30,
    172,
    34,
    27,
    126,
    124,
    32,
    33,
    32,
    29,
    126,
    124,
    32,
    47,
    66,
    25,
    135,
    124,
    34,
    33,
    32,
    33,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    33,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    32,
    32,
    0,
    32,
    44,
    32,
    45,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    31,
    66,
    25,
    135,
    32,
    42,
    32,
    43,
    66,
    128,
    128,
    128,
    96,
    131,
    125,
    124,
    34,
    31,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    38,
    66,
    26,
    136,
    124,
    62,
    2,
    20,
    32,
    0,
    32,
    31,
    32,
    38,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    16,
    32,
    0,
    32,
    4,
    32,
    32,
    126,
    32,
    7,
    32,
    39,
    126,
    124,
    32,
    10,
    32,
    40,
    126,
    124,
    32,
    13,
    32,
    8,
    126,
    124,
    32,
    17,
    32,
    35,
    126,
    124,
    32,
    20,
    32,
    11,
    126,
    124,
    32,
    24,
    32,
    36,
    126,
    124,
    32,
    48,
    32,
    18,
    126,
    124,
    32,
    27,
    32,
    37,
    126,
    124,
    32,
    25,
    32,
    2,
    172,
    126,
    124,
    32,
    33,
    66,
    26,
    135,
    124,
    34,
    7,
    32,
    7,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    7,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    36,
    32,
    0,
    32,
    51,
    32,
    52,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    7,
    66,
    25,
    135,
    66,
    19,
    126,
    32,
    49,
    32,
    50,
    66,
    128,
    128,
    128,
    96,
    131,
    125,
    124,
    34,
    7,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    8,
    66,
    26,
    136,
    124,
    62,
    2,
    4,
    32,
    0,
    32,
    7,
    32,
    8,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    0,
    11,
    227,
    6,
    14,
    1,
    127,
    2,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    2,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    18,
    126,
    32,
    0,
    32,
    1,
    40,
    2,
    12,
    34,
    2,
    65,
    1,
    116,
    172,
    34,
    3,
    32,
    2,
    172,
    34,
    4,
    126,
    32,
    1,
    40,
    2,
    16,
    34,
    5,
    172,
    34,
    6,
    32,
    1,
    40,
    2,
    8,
    34,
    7,
    65,
    1,
    116,
    172,
    34,
    8,
    126,
    124,
    32,
    1,
    40,
    2,
    20,
    34,
    2,
    65,
    1,
    116,
    172,
    34,
    9,
    32,
    1,
    40,
    2,
    4,
    34,
    10,
    65,
    1,
    116,
    172,
    34,
    11,
    126,
    124,
    32,
    1,
    40,
    2,
    24,
    34,
    12,
    172,
    34,
    13,
    32,
    1,
    40,
    2,
    0,
    34,
    14,
    65,
    1,
    116,
    172,
    34,
    15,
    126,
    124,
    32,
    1,
    40,
    2,
    32,
    34,
    16,
    65,
    19,
    108,
    172,
    34,
    17,
    32,
    16,
    172,
    34,
    18,
    126,
    124,
    32,
    1,
    40,
    2,
    36,
    34,
    16,
    65,
    38,
    108,
    172,
    34,
    19,
    32,
    1,
    40,
    2,
    28,
    34,
    1,
    65,
    1,
    116,
    172,
    34,
    20,
    126,
    124,
    32,
    6,
    32,
    11,
    126,
    32,
    8,
    32,
    4,
    126,
    124,
    32,
    2,
    172,
    34,
    21,
    32,
    15,
    126,
    124,
    32,
    17,
    32,
    20,
    126,
    124,
    32,
    19,
    32,
    13,
    126,
    124,
    32,
    3,
    32,
    11,
    126,
    32,
    7,
    172,
    34,
    22,
    32,
    22,
    126,
    124,
    32,
    6,
    32,
    15,
    126,
    124,
    32,
    1,
    65,
    38,
    108,
    172,
    34,
    23,
    32,
    1,
    172,
    34,
    24,
    126,
    124,
    32,
    17,
    32,
    12,
    65,
    1,
    116,
    172,
    126,
    124,
    32,
    19,
    32,
    9,
    126,
    124,
    34,
    25,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    26,
    66,
    26,
    135,
    124,
    34,
    27,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    28,
    66,
    25,
    135,
    124,
    34,
    29,
    32,
    29,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    30,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    24,
    32,
    0,
    32,
    22,
    32,
    15,
    126,
    32,
    11,
    32,
    10,
    172,
    34,
    31,
    126,
    124,
    32,
    12,
    65,
    19,
    108,
    172,
    34,
    29,
    32,
    13,
    126,
    124,
    32,
    23,
    32,
    9,
    126,
    124,
    32,
    17,
    32,
    5,
    65,
    1,
    116,
    172,
    34,
    32,
    126,
    124,
    32,
    19,
    32,
    3,
    126,
    124,
    32,
    29,
    32,
    9,
    126,
    32,
    15,
    32,
    31,
    126,
    124,
    32,
    23,
    32,
    6,
    126,
    124,
    32,
    17,
    32,
    3,
    126,
    124,
    32,
    19,
    32,
    22,
    126,
    124,
    32,
    2,
    65,
    38,
    108,
    172,
    32,
    21,
    126,
    32,
    14,
    172,
    34,
    31,
    32,
    31,
    126,
    124,
    32,
    29,
    32,
    32,
    126,
    124,
    32,
    23,
    32,
    3,
    126,
    124,
    32,
    17,
    32,
    8,
    126,
    124,
    32,
    19,
    32,
    11,
    126,
    124,
    34,
    29,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    31,
    66,
    26,
    135,
    124,
    34,
    32,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    33,
    66,
    25,
    135,
    124,
    34,
    34,
    32,
    34,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    34,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    8,
    32,
    0,
    32,
    21,
    32,
    8,
    126,
    32,
    3,
    32,
    6,
    126,
    124,
    32,
    13,
    32,
    11,
    126,
    124,
    32,
    24,
    32,
    15,
    126,
    124,
    32,
    19,
    32,
    18,
    126,
    124,
    32,
    30,
    66,
    26,
    135,
    124,
    34,
    21,
    32,
    21,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    21,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    28,
    32,
    0,
    32,
    4,
    32,
    15,
    126,
    32,
    11,
    32,
    22,
    126,
    124,
    32,
    23,
    32,
    13,
    126,
    124,
    32,
    17,
    32,
    9,
    126,
    124,
    32,
    19,
    32,
    6,
    126,
    124,
    32,
    34,
    66,
    26,
    135,
    124,
    34,
    17,
    32,
    17,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    17,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    12,
    32,
    0,
    32,
    13,
    32,
    8,
    126,
    32,
    6,
    32,
    6,
    126,
    124,
    32,
    9,
    32,
    3,
    126,
    124,
    32,
    20,
    32,
    11,
    126,
    124,
    32,
    18,
    32,
    15,
    126,
    124,
    32,
    19,
    32,
    16,
    172,
    34,
    22,
    126,
    124,
    32,
    21,
    66,
    25,
    135,
    124,
    34,
    19,
    32,
    19,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    19,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    32,
    32,
    0,
    32,
    27,
    32,
    28,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    17,
    66,
    25,
    135,
    32,
    25,
    32,
    26,
    66,
    128,
    128,
    128,
    96,
    131,
    125,
    124,
    34,
    17,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    23,
    66,
    26,
    136,
    124,
    62,
    2,
    20,
    32,
    0,
    32,
    17,
    32,
    23,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    16,
    32,
    0,
    32,
    9,
    32,
    6,
    126,
    32,
    13,
    32,
    3,
    126,
    124,
    32,
    24,
    32,
    8,
    126,
    124,
    32,
    18,
    32,
    11,
    126,
    124,
    32,
    22,
    32,
    15,
    126,
    124,
    32,
    19,
    66,
    26,
    135,
    124,
    34,
    6,
    32,
    6,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    6,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    36,
    32,
    0,
    32,
    32,
    32,
    33,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    6,
    66,
    25,
    135,
    66,
    19,
    126,
    32,
    29,
    32,
    31,
    66,
    128,
    128,
    128,
    96,
    131,
    125,
    124,
    34,
    6,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    11,
    66,
    26,
    136,
    124,
    62,
    2,
    4,
    32,
    0,
    32,
    6,
    32,
    11,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    0,
    11,
    222,
    3,
    1,
    15,
    126,
    32,
    1,
    52,
    2,
    36,
    33,
    3,
    32,
    1,
    52,
    2,
    32,
    33,
    4,
    32,
    1,
    52,
    2,
    12,
    33,
    5,
    32,
    1,
    52,
    2,
    28,
    33,
    6,
    32,
    1,
    52,
    2,
    8,
    33,
    7,
    32,
    1,
    52,
    2,
    0,
    33,
    8,
    32,
    1,
    52,
    2,
    4,
    33,
    9,
    32,
    0,
    32,
    1,
    52,
    2,
    16,
    32,
    2,
    172,
    34,
    10,
    126,
    34,
    11,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    12,
    66,
    26,
    135,
    32,
    1,
    52,
    2,
    20,
    32,
    10,
    126,
    124,
    34,
    13,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    14,
    66,
    25,
    135,
    32,
    1,
    52,
    2,
    24,
    32,
    10,
    126,
    124,
    34,
    15,
    32,
    15,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    15,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    24,
    32,
    0,
    32,
    8,
    32,
    10,
    126,
    34,
    8,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    16,
    66,
    26,
    135,
    32,
    9,
    32,
    10,
    126,
    124,
    34,
    9,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    17,
    66,
    25,
    135,
    32,
    7,
    32,
    10,
    126,
    124,
    34,
    7,
    32,
    7,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    7,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    8,
    32,
    0,
    32,
    15,
    66,
    26,
    135,
    32,
    6,
    32,
    10,
    126,
    124,
    34,
    6,
    32,
    6,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    6,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    28,
    32,
    0,
    32,
    7,
    66,
    26,
    135,
    32,
    5,
    32,
    10,
    126,
    124,
    34,
    5,
    32,
    5,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    5,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    12,
    32,
    0,
    32,
    6,
    66,
    25,
    135,
    32,
    4,
    32,
    10,
    126,
    124,
    34,
    4,
    32,
    4,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    4,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    32,
    32,
    0,
    32,
    13,
    32,
    14,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    5,
    66,
    25,
    135,
    32,
    11,
    32,
    12,
    66,
    128,
    128,
    128,
    96,
    131,
    125,
    124,
    34,
    5,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    6,
    66,
    26,
    136,
    124,
    62,
    2,
    20,
    32,
    0,
    32,
    5,
    32,
    6,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    16,
    32,
    0,
    32,
    4,
    66,
    26,
    135,
    32,
    3,
    32,
    10,
    126,
    124,
    34,
    10,
    32,
    10,
    66,
    128,
    128,
    128,
    8,
    124,
    34,
    10,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    62,
    2,
    36,
    32,
    0,
    32,
    9,
    32,
    17,
    66,
    128,
    128,
    128,
    240,
    15,
    131,
    125,
    32,
    10,
    66,
    25,
    135,
    66,
    19,
    126,
    32,
    8,
    32,
    16,
    66,
    128,
    128,
    128,
    96,
    131,
    125,
    124,
    34,
    10,
    66,
    128,
    128,
    128,
    16,
    124,
    34,
    3,
    66,
    26,
    136,
    124,
    62,
    2,
    4,
    32,
    0,
    32,
    10,
    32,
    3,
    66,
    128,
    128,
    128,
    224,
    15,
    131,
    125,
    62,
    2,
    0,
    11,
    125,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    48,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    1,
    16,
    200,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    32,
    1,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    32,
    1,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    48,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    128,
    5,
    1,
    7,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    48,
    107,
    34,
    2,
    32,
    1,
    65,
    40,
    252,
    10,
    0,
    0,
    32,
    2,
    40,
    2,
    36,
    65,
    19,
    108,
    65,
    128,
    128,
    128,
    8,
    106,
    65,
    25,
    117,
    33,
    3,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    34,
    4,
    40,
    2,
    0,
    32,
    3,
    106,
    65,
    26,
    117,
    32,
    4,
    65,
    4,
    106,
    40,
    2,
    0,
    106,
    65,
    25,
    117,
    33,
    3,
    32,
    1,
    65,
    8,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    19,
    108,
    33,
    4,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    34,
    3,
    32,
    3,
    40,
    2,
    0,
    32,
    4,
    106,
    34,
    4,
    65,
    255,
    255,
    255,
    31,
    113,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    32,
    3,
    40,
    2,
    0,
    32,
    4,
    65,
    26,
    117,
    106,
    34,
    3,
    65,
    255,
    255,
    255,
    15,
    113,
    54,
    2,
    0,
    32,
    3,
    65,
    25,
    117,
    33,
    4,
    32,
    1,
    65,
    8,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    2,
    40,
    2,
    0,
    34,
    1,
    58,
    0,
    0,
    32,
    0,
    32,
    1,
    65,
    16,
    118,
    58,
    0,
    2,
    32,
    0,
    32,
    1,
    65,
    8,
    118,
    58,
    0,
    1,
    32,
    0,
    32,
    2,
    40,
    2,
    4,
    34,
    3,
    65,
    14,
    118,
    58,
    0,
    5,
    32,
    0,
    32,
    3,
    65,
    6,
    118,
    34,
    5,
    58,
    0,
    4,
    32,
    0,
    32,
    2,
    40,
    2,
    12,
    34,
    4,
    65,
    11,
    118,
    58,
    0,
    11,
    32,
    0,
    32,
    2,
    40,
    2,
    8,
    34,
    6,
    65,
    13,
    118,
    34,
    7,
    58,
    0,
    8,
    32,
    0,
    32,
    2,
    40,
    2,
    16,
    34,
    8,
    65,
    18,
    118,
    58,
    0,
    15,
    32,
    0,
    32,
    8,
    65,
    10,
    118,
    58,
    0,
    14,
    32,
    0,
    32,
    8,
    65,
    6,
    116,
    32,
    4,
    65,
    19,
    118,
    114,
    34,
    8,
    58,
    0,
    12,
    32,
    0,
    32,
    1,
    32,
    3,
    65,
    26,
    116,
    114,
    65,
    24,
    118,
    58,
    0,
    3,
    32,
    0,
    32,
    6,
    65,
    19,
    116,
    32,
    5,
    114,
    34,
    1,
    65,
    24,
    118,
    58,
    0,
    7,
    32,
    0,
    32,
    1,
    65,
    16,
    118,
    58,
    0,
    6,
    32,
    0,
    32,
    4,
    65,
    13,
    116,
    32,
    7,
    114,
    34,
    1,
    65,
    16,
    118,
    58,
    0,
    10,
    32,
    0,
    32,
    1,
    65,
    8,
    118,
    58,
    0,
    9,
    32,
    0,
    32,
    8,
    65,
    8,
    118,
    58,
    0,
    13,
    32,
    0,
    32,
    2,
    40,
    2,
    20,
    34,
    1,
    58,
    0,
    16,
    32,
    0,
    32,
    1,
    65,
    8,
    118,
    58,
    0,
    17,
    32,
    0,
    32,
    1,
    65,
    16,
    118,
    58,
    0,
    18,
    32,
    0,
    32,
    2,
    40,
    2,
    24,
    34,
    3,
    65,
    7,
    118,
    34,
    5,
    58,
    0,
    20,
    32,
    0,
    32,
    3,
    65,
    15,
    118,
    58,
    0,
    21,
    32,
    0,
    32,
    2,
    40,
    2,
    28,
    34,
    6,
    65,
    13,
    118,
    34,
    7,
    58,
    0,
    24,
    32,
    0,
    32,
    2,
    40,
    2,
    32,
    34,
    4,
    65,
    12,
    118,
    58,
    0,
    27,
    32,
    0,
    32,
    2,
    40,
    2,
    36,
    34,
    8,
    65,
    18,
    118,
    58,
    0,
    31,
    32,
    0,
    32,
    8,
    65,
    10,
    118,
    58,
    0,
    30,
    32,
    0,
    32,
    8,
    65,
    6,
    116,
    32,
    4,
    65,
    20,
    118,
    114,
    34,
    8,
    58,
    0,
    28,
    32,
    0,
    32,
    1,
    32,
    3,
    65,
    25,
    116,
    114,
    65,
    24,
    118,
    58,
    0,
    19,
    32,
    0,
    32,
    6,
    65,
    19,
    116,
    32,
    5,
    114,
    34,
    1,
    65,
    24,
    118,
    58,
    0,
    23,
    32,
    0,
    32,
    1,
    65,
    16,
    118,
    58,
    0,
    22,
    32,
    0,
    32,
    4,
    65,
    12,
    116,
    32,
    7,
    114,
    34,
    1,
    65,
    16,
    118,
    58,
    0,
    26,
    32,
    0,
    32,
    1,
    65,
    8,
    118,
    58,
    0,
    25,
    32,
    0,
    32,
    8,
    65,
    8,
    118,
    58,
    0,
    29,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    11,
    18,
    0,
    32,
    0,
    32,
    1,
    65,
    224,
    137,
    128,
    128,
    0,
    16,
    166,
    128,
    128,
    128,
    0,
    11,
    179,
    1,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    1,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    160,
    1,
    106,
    32,
    1,
    65,
    32,
    32,
    2,
    40,
    2,
    0,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    3,
    32,
    3,
    45,
    0,
    160,
    1,
    65,
    248,
    1,
    113,
    58,
    0,
    160,
    1,
    32,
    3,
    32,
    3,
    45,
    0,
    191,
    1,
    65,
    63,
    113,
    65,
    192,
    0,
    114,
    58,
    0,
    191,
    1,
    32,
    3,
    32,
    3,
    65,
    160,
    1,
    106,
    16,
    176,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    3,
    16,
    177,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    3,
    65,
    160,
    1,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    3,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    160,
    1,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    224,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    140,
    4,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    160,
    3,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    128,
    3,
    106,
    32,
    1,
    65,
    208,
    140,
    128,
    128,
    0,
    65,
    240,
    140,
    128,
    128,
    0,
    16,
    178,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    1,
    54,
    2,
    168,
    1,
    32,
    2,
    65,
    168,
    1,
    106,
    65,
    4,
    114,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    2,
    65,
    1,
    54,
    2,
    208,
    1,
    32,
    2,
    65,
    168,
    1,
    106,
    65,
    44,
    106,
    65,
    0,
    65,
    204,
    0,
    252,
    11,
    0,
    32,
    0,
    65,
    0,
    65,
    40,
    252,
    11,
    0,
    32,
    0,
    65,
    1,
    54,
    2,
    40,
    32,
    0,
    65,
    44,
    106,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    0,
    65,
    1,
    54,
    2,
    80,
    32,
    0,
    65,
    212,
    0,
    106,
    65,
    0,
    65,
    204,
    0,
    252,
    11,
    0,
    32,
    0,
    32,
    2,
    65,
    168,
    1,
    106,
    32,
    2,
    65,
    208,
    2,
    106,
    32,
    2,
    65,
    160,
    2,
    106,
    65,
    144,
    141,
    128,
    128,
    0,
    32,
    2,
    65,
    128,
    3,
    106,
    65,
    31,
    16,
    179,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    168,
    1,
    106,
    32,
    2,
    65,
    208,
    2,
    106,
    32,
    2,
    65,
    160,
    2,
    106,
    65,
    208,
    148,
    128,
    128,
    0,
    32,
    2,
    65,
    128,
    3,
    106,
    65,
    159,
    1,
    16,
    179,
    128,
    128,
    128,
    0,
    65,
    30,
    33,
    3,
    3,
    64,
    32,
    0,
    32,
    0,
    32,
    2,
    65,
    8,
    106,
    16,
    180,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    168,
    1,
    106,
    32,
    2,
    65,
    208,
    2,
    106,
    32,
    2,
    65,
    160,
    2,
    106,
    65,
    144,
    141,
    128,
    128,
    0,
    32,
    2,
    65,
    128,
    3,
    106,
    32,
    3,
    34,
    1,
    16,
    179,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    168,
    1,
    106,
    32,
    2,
    65,
    208,
    2,
    106,
    32,
    2,
    65,
    160,
    2,
    106,
    65,
    208,
    148,
    128,
    128,
    0,
    32,
    2,
    65,
    128,
    3,
    106,
    32,
    1,
    65,
    128,
    1,
    106,
    16,
    179,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    127,
    106,
    33,
    3,
    32,
    1,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    208,
    2,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    8,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    160,
    1,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    160,
    2,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    168,
    1,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    248,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    128,
    3,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    160,
    3,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    219,
    1,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    144,
    1,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    208,
    0,
    106,
    16,
    172,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    1,
    65,
    40,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    16,
    173,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    48,
    106,
    16,
    181,
    128,
    128,
    128,
    0,
    65,
    7,
    116,
    32,
    0,
    45,
    0,
    31,
    115,
    58,
    0,
    31,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    144,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    182,
    2,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    128,
    1,
    107,
    34,
    4,
    36,
    128,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    5,
    106,
    32,
    1,
    32,
    5,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    65,
    192,
    0,
    106,
    32,
    5,
    106,
    32,
    2,
    32,
    5,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    32,
    5,
    106,
    32,
    3,
    32,
    5,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    56,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    4,
    65,
    48,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    4,
    65,
    40,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    4,
    66,
    0,
    55,
    3,
    32,
    32,
    4,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    4,
    65,
    192,
    0,
    106,
    16,
    188,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    4,
    16,
    186,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    32,
    5,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    65,
    224,
    0,
    106,
    32,
    5,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    65,
    192,
    0,
    106,
    32,
    5,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    128,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    222,
    4,
    1,
    4,
    127,
    65,
    0,
    33,
    7,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    32,
    6,
    65,
    0,
    72,
    13,
    0,
    32,
    5,
    32,
    6,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    6,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    33,
    7,
    12,
    1,
    11,
    32,
    6,
    65,
    96,
    73,
    13,
    1,
    11,
    32,
    5,
    32,
    6,
    65,
    32,
    106,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    6,
    65,
    7,
    113,
    118,
    65,
    1,
    116,
    65,
    2,
    113,
    32,
    7,
    114,
    33,
    7,
    12,
    1,
    11,
    65,
    0,
    33,
    7,
    32,
    6,
    65,
    64,
    73,
    13,
    1,
    11,
    32,
    7,
    32,
    5,
    32,
    6,
    65,
    192,
    0,
    106,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    6,
    65,
    7,
    113,
    118,
    65,
    2,
    116,
    65,
    4,
    113,
    114,
    33,
    7,
    12,
    1,
    11,
    65,
    0,
    33,
    7,
    65,
    0,
    33,
    8,
    32,
    6,
    65,
    160,
    127,
    73,
    13,
    1,
    11,
    32,
    5,
    32,
    6,
    65,
    224,
    0,
    106,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    6,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    33,
    8,
    11,
    32,
    8,
    65,
    127,
    106,
    65,
    7,
    113,
    32,
    7,
    115,
    33,
    9,
    65,
    0,
    33,
    10,
    3,
    64,
    65,
    0,
    32,
    9,
    32,
    10,
    115,
    65,
    127,
    106,
    65,
    8,
    118,
    65,
    1,
    113,
    107,
    33,
    5,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    1,
    32,
    6,
    106,
    34,
    7,
    32,
    4,
    32,
    6,
    106,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    34,
    7,
    115,
    32,
    5,
    113,
    32,
    7,
    115,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    40,
    33,
    6,
    3,
    64,
    32,
    1,
    32,
    6,
    106,
    34,
    7,
    32,
    4,
    32,
    6,
    106,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    34,
    7,
    115,
    32,
    5,
    113,
    32,
    7,
    115,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    208,
    0,
    71,
    13,
    0,
    11,
    65,
    208,
    0,
    33,
    6,
    3,
    64,
    32,
    1,
    32,
    6,
    106,
    34,
    7,
    32,
    4,
    32,
    6,
    106,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    34,
    7,
    115,
    32,
    5,
    113,
    32,
    7,
    115,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    248,
    0,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    248,
    0,
    106,
    33,
    4,
    32,
    10,
    65,
    1,
    106,
    34,
    10,
    65,
    8,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    2,
    32,
    6,
    106,
    65,
    0,
    32,
    1,
    32,
    6,
    106,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    8,
    65,
    127,
    106,
    33,
    5,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    1,
    32,
    6,
    106,
    65,
    208,
    0,
    106,
    34,
    7,
    32,
    2,
    32,
    6,
    106,
    34,
    4,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    34,
    7,
    115,
    32,
    5,
    113,
    34,
    10,
    32,
    7,
    115,
    54,
    2,
    0,
    32,
    4,
    32,
    4,
    40,
    2,
    0,
    32,
    10,
    115,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    1,
    32,
    6,
    106,
    34,
    4,
    65,
    40,
    106,
    34,
    7,
    32,
    7,
    40,
    2,
    0,
    34,
    7,
    32,
    4,
    40,
    2,
    0,
    34,
    10,
    115,
    32,
    5,
    113,
    34,
    9,
    32,
    7,
    115,
    54,
    2,
    0,
    32,
    4,
    32,
    9,
    32,
    10,
    115,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    16,
    196,
    128,
    128,
    128,
    0,
    11,
    135,
    3,
    1,
    6,
    127,
    32,
    2,
    32,
    1,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    40,
    106,
    34,
    3,
    32,
    1,
    65,
    40,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    208,
    0,
    106,
    34,
    4,
    32,
    1,
    65,
    208,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    4,
    65,
    2,
    16,
    171,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    248,
    0,
    106,
    33,
    5,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    5,
    32,
    6,
    106,
    32,
    1,
    32,
    6,
    106,
    34,
    7,
    65,
    40,
    106,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    248,
    0,
    106,
    34,
    8,
    32,
    2,
    65,
    248,
    0,
    106,
    34,
    5,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    2,
    32,
    6,
    106,
    34,
    7,
    65,
    248,
    0,
    106,
    32,
    7,
    40,
    2,
    0,
    32,
    7,
    65,
    40,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    2,
    32,
    6,
    106,
    34,
    7,
    65,
    40,
    106,
    34,
    1,
    32,
    1,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    248,
    0,
    106,
    33,
    1,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    2,
    32,
    6,
    106,
    34,
    7,
    32,
    1,
    32,
    6,
    106,
    40,
    2,
    0,
    32,
    7,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    6,
    3,
    64,
    32,
    2,
    32,
    6,
    106,
    34,
    7,
    65,
    208,
    0,
    106,
    34,
    1,
    32,
    1,
    40,
    2,
    0,
    32,
    7,
    65,
    40,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    6,
    65,
    4,
    106,
    34,
    6,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    2,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    40,
    106,
    32,
    5,
    32,
    3,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    208,
    0,
    106,
    32,
    3,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    8,
    32,
    2,
    32,
    5,
    16,
    169,
    128,
    128,
    128,
    0,
    11,
    83,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    32,
    107,
    34,
    1,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    1,
    32,
    0,
    16,
    173,
    128,
    128,
    128,
    0,
    32,
    1,
    45,
    0,
    0,
    33,
    2,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    1,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    32,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    1,
    113,
    11,
    18,
    0,
    32,
    0,
    32,
    1,
    65,
    192,
    137,
    128,
    128,
    0,
    16,
    175,
    128,
    128,
    128,
    0,
    11,
    182,
    1,
    0,
    32,
    0,
    32,
    3,
    54,
    2,
    0,
    32,
    0,
    65,
    4,
    106,
    32,
    1,
    65,
    32,
    32,
    3,
    40,
    2,
    0,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    32,
    0,
    45,
    0,
    4,
    65,
    248,
    1,
    113,
    58,
    0,
    4,
    32,
    0,
    65,
    35,
    106,
    34,
    3,
    32,
    3,
    45,
    0,
    0,
    65,
    63,
    113,
    65,
    192,
    0,
    114,
    58,
    0,
    0,
    2,
    64,
    2,
    64,
    32,
    2,
    69,
    13,
    0,
    32,
    0,
    65,
    228,
    0,
    106,
    33,
    1,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    32,
    3,
    106,
    32,
    2,
    32,
    3,
    106,
    45,
    0,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    32,
    71,
    13,
    0,
    12,
    2,
    11,
    11,
    32,
    0,
    65,
    228,
    0,
    106,
    32,
    1,
    32,
    0,
    40,
    2,
    0,
    16,
    175,
    128,
    128,
    128,
    0,
    11,
    32,
    0,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    4,
    17,
    129,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    32,
    0,
    65,
    36,
    106,
    65,
    32,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    11,
    185,
    1,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    160,
    1,
    107,
    34,
    1,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    0,
    65,
    36,
    106,
    34,
    2,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    12,
    17,
    130,
    128,
    128,
    128,
    0,
    0,
    32,
    2,
    16,
    185,
    128,
    128,
    128,
    0,
    32,
    1,
    32,
    2,
    16,
    176,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    196,
    0,
    106,
    34,
    3,
    32,
    1,
    16,
    177,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    1,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    160,
    1,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    4,
    17,
    129,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    32,
    3,
    65,
    32,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    32,
    0,
    65,
    228,
    0,
    106,
    65,
    32,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    1,
    65,
    160,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    110,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    0,
    107,
    34,
    1,
    36,
    128,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    1,
    32,
    2,
    106,
    32,
    0,
    32,
    2,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    1,
    16,
    186,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    1,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    192,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    217,
    3,
    3,
    4,
    127,
    2,
    126,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    240,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    3,
    32,
    2,
    65,
    0,
    65,
    228,
    0,
    252,
    11,
    0,
    32,
    2,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    2,
    116,
    34,
    5,
    65,
    176,
    165,
    128,
    128,
    0,
    106,
    53,
    2,
    0,
    33,
    6,
    66,
    0,
    33,
    7,
    65,
    0,
    33,
    8,
    3,
    64,
    32,
    4,
    32,
    8,
    106,
    34,
    9,
    32,
    7,
    32,
    9,
    53,
    2,
    0,
    124,
    32,
    1,
    32,
    8,
    106,
    53,
    2,
    0,
    32,
    6,
    126,
    124,
    34,
    7,
    62,
    2,
    0,
    32,
    7,
    66,
    32,
    136,
    33,
    7,
    32,
    8,
    65,
    4,
    106,
    34,
    8,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    5,
    32,
    2,
    106,
    65,
    192,
    0,
    106,
    32,
    7,
    62,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    33,
    4,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    9,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    24,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    16,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    2,
    66,
    0,
    55,
    3,
    8,
    32,
    2,
    66,
    0,
    55,
    3,
    0,
    65,
    0,
    33,
    10,
    65,
    32,
    33,
    4,
    32,
    2,
    33,
    3,
    3,
    64,
    32,
    10,
    65,
    2,
    116,
    32,
    2,
    106,
    65,
    192,
    0,
    106,
    33,
    5,
    65,
    0,
    33,
    8,
    66,
    0,
    33,
    7,
    3,
    64,
    32,
    3,
    32,
    8,
    106,
    34,
    9,
    32,
    7,
    32,
    9,
    53,
    2,
    0,
    124,
    32,
    8,
    65,
    192,
    156,
    128,
    128,
    0,
    106,
    53,
    2,
    0,
    32,
    5,
    53,
    2,
    0,
    126,
    124,
    34,
    7,
    62,
    2,
    0,
    32,
    7,
    66,
    32,
    136,
    33,
    7,
    32,
    4,
    32,
    8,
    65,
    4,
    106,
    34,
    8,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    4,
    106,
    33,
    3,
    32,
    4,
    65,
    124,
    106,
    33,
    4,
    32,
    10,
    65,
    1,
    106,
    34,
    10,
    65,
    8,
    71,
    13,
    0,
    11,
    66,
    1,
    33,
    7,
    65,
    0,
    33,
    8,
    3,
    64,
    32,
    2,
    32,
    8,
    106,
    34,
    9,
    32,
    7,
    32,
    1,
    32,
    8,
    106,
    53,
    2,
    0,
    124,
    32,
    9,
    53,
    2,
    0,
    66,
    255,
    255,
    255,
    255,
    15,
    133,
    124,
    34,
    7,
    62,
    2,
    0,
    32,
    7,
    66,
    32,
    136,
    33,
    7,
    32,
    8,
    65,
    4,
    106,
    34,
    8,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    2,
    32,
    2,
    16,
    211,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    8,
    3,
    64,
    32,
    0,
    32,
    8,
    106,
    32,
    2,
    32,
    8,
    106,
    40,
    2,
    0,
    54,
    0,
    0,
    32,
    8,
    65,
    4,
    106,
    34,
    8,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    8,
    3,
    64,
    32,
    2,
    32,
    8,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    8,
    65,
    1,
    106,
    34,
    8,
    65,
    228,
    0,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    240,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    199,
    1,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    12,
    17,
    130,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    65,
    196,
    0,
    106,
    33,
    3,
    32,
    2,
    16,
    185,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    1,
    32,
    4,
    106,
    32,
    3,
    32,
    4,
    106,
    45,
    0,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    32,
    106,
    32,
    2,
    32,
    0,
    65,
    4,
    106,
    32,
    0,
    65,
    36,
    106,
    16,
    178,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    2,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    2,
    64,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    16,
    34,
    4,
    69,
    13,
    0,
    3,
    64,
    32,
    0,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    33,
    0,
    32,
    4,
    65,
    127,
    106,
    34,
    4,
    13,
    0,
    11,
    11,
    32,
    2,
    65,
    192,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    128,
    1,
    3,
    4,
    127,
    1,
    126,
    2,
    127,
    65,
    0,
    33,
    3,
    32,
    0,
    33,
    4,
    3,
    64,
    32,
    1,
    32,
    3,
    65,
    2,
    116,
    34,
    5,
    106,
    33,
    6,
    66,
    0,
    33,
    7,
    65,
    0,
    33,
    8,
    3,
    64,
    32,
    4,
    32,
    8,
    106,
    34,
    9,
    32,
    7,
    32,
    9,
    53,
    2,
    0,
    124,
    32,
    2,
    32,
    8,
    106,
    53,
    2,
    0,
    32,
    6,
    53,
    2,
    0,
    126,
    124,
    34,
    7,
    62,
    2,
    0,
    32,
    7,
    66,
    32,
    136,
    33,
    7,
    32,
    8,
    65,
    4,
    106,
    34,
    8,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    5,
    32,
    0,
    106,
    65,
    32,
    106,
    32,
    7,
    62,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    33,
    4,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    8,
    71,
    13,
    0,
    11,
    11,
    112,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    2,
    107,
    34,
    5,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    5,
    32,
    1,
    32,
    2,
    65,
    192,
    137,
    128,
    128,
    0,
    16,
    183,
    128,
    128,
    128,
    0,
    32,
    5,
    32,
    3,
    32,
    4,
    32,
    5,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    5,
    16,
    184,
    128,
    128,
    128,
    0,
    32,
    5,
    32,
    3,
    32,
    4,
    32,
    5,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    5,
    32,
    0,
    16,
    187,
    128,
    128,
    128,
    0,
    32,
    5,
    65,
    224,
    2,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    153,
    1,
    1,
    2,
    127,
    32,
    0,
    32,
    3,
    54,
    2,
    0,
    32,
    0,
    65,
    4,
    106,
    33,
    4,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    32,
    5,
    106,
    32,
    1,
    32,
    5,
    106,
    45,
    0,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    228,
    0,
    106,
    33,
    4,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    32,
    5,
    106,
    32,
    2,
    32,
    5,
    106,
    45,
    0,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    3,
    40,
    2,
    4,
    17,
    129,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    32,
    1,
    65,
    32,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    32,
    2,
    65,
    32,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    11,
    244,
    14,
    3,
    10,
    127,
    2,
    126,
    4,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    7,
    107,
    34,
    1,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    1,
    32,
    0,
    40,
    2,
    0,
    40,
    2,
    12,
    17,
    130,
    128,
    128,
    128,
    0,
    0,
    32,
    0,
    65,
    36,
    106,
    33,
    2,
    32,
    1,
    16,
    185,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    192,
    0,
    106,
    32,
    3,
    106,
    32,
    0,
    32,
    3,
    106,
    65,
    36,
    106,
    40,
    0,
    0,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    224,
    0,
    106,
    65,
    40,
    106,
    34,
    4,
    32,
    0,
    65,
    228,
    0,
    106,
    34,
    5,
    16,
    168,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    1,
    54,
    2,
    176,
    1,
    65,
    0,
    33,
    3,
    32,
    1,
    65,
    180,
    1,
    106,
    34,
    6,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    65,
    248,
    0,
    106,
    34,
    7,
    32,
    4,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    7,
    65,
    144,
    156,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    65,
    208,
    0,
    106,
    33,
    8,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    248,
    0,
    106,
    34,
    10,
    32,
    10,
    40,
    2,
    0,
    32,
    9,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    32,
    9,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    32,
    9,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    7,
    32,
    1,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    2,
    64,
    2,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    16,
    192,
    128,
    128,
    128,
    0,
    69,
    13,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    7,
    32,
    1,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    2,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    16,
    181,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    131,
    1,
    106,
    45,
    0,
    0,
    65,
    7,
    118,
    70,
    13,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    0,
    32,
    9,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    11,
    32,
    7,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    66,
    1,
    33,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    11,
    32,
    1,
    65,
    192,
    0,
    106,
    32,
    3,
    106,
    53,
    2,
    0,
    124,
    32,
    3,
    65,
    192,
    156,
    128,
    128,
    0,
    106,
    53,
    2,
    0,
    66,
    255,
    255,
    255,
    255,
    15,
    133,
    124,
    34,
    12,
    66,
    32,
    136,
    33,
    11,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    12,
    66,
    255,
    255,
    255,
    255,
    15,
    86,
    13,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    0,
    32,
    9,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    248,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    0,
    32,
    9,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    160,
    1,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    192,
    2,
    106,
    16,
    180,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    224,
    3,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    16,
    193,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    192,
    2,
    106,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    1,
    65,
    224,
    3,
    106,
    16,
    194,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    128,
    5,
    106,
    32,
    1,
    65,
    192,
    2,
    106,
    16,
    193,
    128,
    128,
    128,
    0,
    65,
    252,
    1,
    33,
    3,
    2,
    64,
    3,
    64,
    32,
    1,
    32,
    3,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    3,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    13,
    1,
    32,
    3,
    65,
    1,
    75,
    33,
    9,
    32,
    3,
    65,
    127,
    106,
    33,
    3,
    32,
    9,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    11,
    32,
    1,
    65,
    255,
    1,
    58,
    0,
    186,
    2,
    32,
    1,
    65,
    255,
    255,
    3,
    59,
    1,
    184,
    2,
    32,
    1,
    32,
    3,
    65,
    1,
    106,
    34,
    13,
    58,
    0,
    187,
    2,
    65,
    252,
    1,
    33,
    3,
    2,
    64,
    3,
    64,
    32,
    2,
    32,
    3,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    3,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    13,
    1,
    32,
    3,
    65,
    1,
    75,
    33,
    9,
    32,
    3,
    65,
    127,
    106,
    33,
    3,
    32,
    9,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    11,
    32,
    1,
    65,
    255,
    255,
    3,
    59,
    1,
    176,
    2,
    32,
    1,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    58,
    0,
    179,
    2,
    32,
    1,
    65,
    255,
    1,
    58,
    0,
    178,
    2,
    32,
    1,
    65,
    224,
    0,
    106,
    65,
    0,
    65,
    40,
    252,
    11,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    65,
    40,
    106,
    34,
    10,
    65,
    1,
    54,
    2,
    0,
    32,
    1,
    65,
    140,
    1,
    106,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    65,
    208,
    0,
    106,
    34,
    14,
    65,
    1,
    54,
    2,
    0,
    32,
    6,
    65,
    0,
    65,
    204,
    0,
    252,
    11,
    0,
    32,
    3,
    65,
    255,
    1,
    113,
    34,
    3,
    32,
    13,
    65,
    255,
    1,
    113,
    34,
    9,
    32,
    9,
    32,
    3,
    73,
    27,
    33,
    3,
    32,
    1,
    65,
    160,
    6,
    106,
    65,
    208,
    0,
    106,
    33,
    15,
    32,
    1,
    65,
    160,
    6,
    106,
    65,
    40,
    106,
    33,
    16,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    192,
    2,
    106,
    16,
    180,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    184,
    2,
    106,
    65,
    3,
    32,
    3,
    34,
    6,
    32,
    1,
    16,
    195,
    128,
    128,
    128,
    0,
    33,
    3,
    32,
    1,
    65,
    176,
    2,
    106,
    65,
    5,
    32,
    6,
    32,
    2,
    16,
    195,
    128,
    128,
    128,
    0,
    33,
    13,
    2,
    64,
    2,
    64,
    32,
    3,
    65,
    1,
    72,
    13,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    3,
    106,
    32,
    3,
    65,
    1,
    118,
    65,
    160,
    1,
    108,
    106,
    16,
    194,
    128,
    128,
    128,
    0,
    12,
    1,
    11,
    32,
    3,
    65,
    127,
    74,
    13,
    0,
    32,
    16,
    32,
    1,
    65,
    224,
    3,
    106,
    65,
    0,
    32,
    3,
    107,
    65,
    1,
    118,
    65,
    160,
    1,
    108,
    106,
    34,
    9,
    65,
    40,
    252,
    10,
    0,
    0,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    9,
    65,
    40,
    106,
    65,
    40,
    252,
    10,
    0,
    0,
    32,
    15,
    32,
    9,
    65,
    208,
    0,
    106,
    65,
    40,
    252,
    10,
    0,
    0,
    65,
    248,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    3,
    106,
    65,
    0,
    32,
    9,
    32,
    3,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    160,
    1,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    160,
    6,
    106,
    16,
    194,
    128,
    128,
    128,
    0,
    11,
    2,
    64,
    2,
    64,
    32,
    13,
    65,
    1,
    72,
    13,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    13,
    65,
    1,
    118,
    65,
    248,
    0,
    108,
    65,
    224,
    156,
    128,
    128,
    0,
    106,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    1,
    65,
    128,
    2,
    106,
    16,
    196,
    128,
    128,
    128,
    0,
    12,
    1,
    11,
    32,
    13,
    65,
    127,
    74,
    13,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    3,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    40,
    2,
    0,
    32,
    9,
    65,
    40,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    128,
    2,
    106,
    32,
    3,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    40,
    106,
    40,
    2,
    0,
    32,
    9,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    1,
    65,
    160,
    6,
    106,
    65,
    0,
    32,
    13,
    107,
    65,
    1,
    118,
    65,
    248,
    0,
    108,
    34,
    13,
    65,
    136,
    157,
    128,
    128,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    128,
    2,
    106,
    32,
    1,
    65,
    128,
    2,
    106,
    32,
    13,
    65,
    224,
    156,
    128,
    128,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    3,
    64,
    32,
    10,
    32,
    3,
    106,
    32,
    1,
    65,
    128,
    2,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    128,
    2,
    106,
    32,
    3,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    14,
    32,
    3,
    106,
    34,
    9,
    32,
    9,
    40,
    2,
    0,
    65,
    1,
    116,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    7,
    32,
    7,
    32,
    13,
    65,
    176,
    157,
    128,
    128,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    3,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    32,
    9,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    1,
    65,
    128,
    2,
    106,
    32,
    3,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    34,
    9,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    32,
    9,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    7,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    224,
    0,
    106,
    32,
    1,
    65,
    128,
    2,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    4,
    32,
    1,
    65,
    160,
    6,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    8,
    32,
    1,
    65,
    160,
    6,
    106,
    32,
    1,
    65,
    128,
    2,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    11,
    32,
    6,
    65,
    127,
    106,
    33,
    3,
    32,
    6,
    65,
    0,
    74,
    13,
    0,
    11,
    32,
    5,
    32,
    1,
    65,
    224,
    0,
    106,
    16,
    177,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    4,
    106,
    32,
    5,
    16,
    131,
    128,
    128,
    128,
    0,
    33,
    3,
    12,
    1,
    11,
    65,
    127,
    33,
    3,
    11,
    32,
    1,
    65,
    192,
    7,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    3,
    11,
    137,
    3,
    1,
    5,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    65,
    40,
    252,
    10,
    0,
    0,
    32,
    0,
    32,
    2,
    65,
    48,
    106,
    16,
    200,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    0,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    1,
    54,
    2,
    48,
    32,
    2,
    65,
    48,
    106,
    65,
    4,
    114,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    205,
    128,
    128,
    128,
    0,
    33,
    3,
    32,
    2,
    65,
    127,
    54,
    2,
    48,
    65,
    4,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    34,
    4,
    65,
    0,
    32,
    4,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    205,
    128,
    128,
    128,
    0,
    33,
    5,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    32,
    1,
    65,
    160,
    138,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    205,
    128,
    128,
    128,
    0,
    33,
    4,
    32,
    2,
    65,
    48,
    106,
    32,
    0,
    65,
    160,
    138,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    4,
    32,
    5,
    114,
    107,
    33,
    6,
    3,
    64,
    32,
    0,
    32,
    1,
    106,
    34,
    4,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    4,
    40,
    2,
    0,
    34,
    4,
    115,
    32,
    6,
    113,
    32,
    4,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    5,
    32,
    3,
    114,
    11,
    178,
    1,
    1,
    3,
    127,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    0,
    32,
    2,
    106,
    32,
    1,
    32,
    2,
    106,
    34,
    3,
    40,
    2,
    0,
    32,
    3,
    65,
    40,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    40,
    106,
    33,
    4,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    2,
    106,
    32,
    1,
    32,
    2,
    106,
    34,
    3,
    65,
    40,
    106,
    40,
    2,
    0,
    32,
    3,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    208,
    0,
    106,
    33,
    3,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    4,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    4,
    32,
    2,
    106,
    32,
    3,
    32,
    2,
    106,
    40,
    2,
    0,
    54,
    2,
    0,
    32,
    2,
    65,
    4,
    106,
    34,
    2,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    248,
    0,
    106,
    32,
    1,
    65,
    248,
    0,
    106,
    65,
    176,
    139,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    11,
    147,
    4,
    1,
    5,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    48,
    106,
    32,
    4,
    106,
    32,
    1,
    32,
    4,
    106,
    34,
    5,
    40,
    2,
    0,
    32,
    5,
    65,
    40,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    32,
    4,
    106,
    32,
    1,
    32,
    4,
    106,
    34,
    5,
    65,
    40,
    106,
    40,
    2,
    0,
    32,
    5,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    48,
    106,
    32,
    3,
    65,
    48,
    106,
    32,
    2,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    3,
    32,
    3,
    32,
    2,
    65,
    40,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    40,
    106,
    33,
    5,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    5,
    32,
    4,
    106,
    32,
    3,
    32,
    4,
    106,
    40,
    2,
    0,
    32,
    3,
    65,
    48,
    106,
    32,
    4,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    40,
    106,
    33,
    6,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    0,
    32,
    4,
    106,
    32,
    3,
    65,
    48,
    106,
    32,
    4,
    106,
    40,
    2,
    0,
    32,
    3,
    32,
    4,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    208,
    0,
    106,
    33,
    5,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    7,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    7,
    32,
    4,
    106,
    32,
    5,
    32,
    4,
    106,
    40,
    2,
    0,
    65,
    1,
    116,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    208,
    0,
    106,
    34,
    5,
    32,
    5,
    32,
    2,
    65,
    208,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    248,
    0,
    106,
    34,
    7,
    32,
    1,
    65,
    248,
    0,
    106,
    32,
    2,
    65,
    248,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    48,
    106,
    32,
    4,
    106,
    32,
    0,
    32,
    4,
    106,
    34,
    1,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    32,
    4,
    106,
    32,
    0,
    32,
    4,
    106,
    34,
    1,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    7,
    32,
    0,
    32,
    6,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    0,
    32,
    3,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    6,
    32,
    6,
    32,
    3,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    5,
    32,
    3,
    65,
    48,
    106,
    32,
    3,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    143,
    3,
    1,
    8,
    127,
    2,
    64,
    32,
    0,
    45,
    0,
    3,
    34,
    4,
    32,
    2,
    71,
    13,
    0,
    65,
    0,
    33,
    5,
    2,
    64,
    2,
    64,
    2,
    64,
    32,
    2,
    65,
    0,
    72,
    13,
    0,
    32,
    3,
    32,
    2,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    2,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    33,
    6,
    2,
    64,
    32,
    2,
    69,
    13,
    0,
    32,
    3,
    32,
    2,
    65,
    127,
    106,
    34,
    5,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    5,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    33,
    5,
    11,
    32,
    6,
    32,
    5,
    71,
    13,
    1,
    11,
    32,
    4,
    65,
    127,
    106,
    33,
    1,
    12,
    1,
    11,
    65,
    0,
    33,
    7,
    65,
    0,
    32,
    3,
    32,
    2,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    2,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    32,
    2,
    65,
    1,
    106,
    34,
    5,
    32,
    1,
    32,
    5,
    32,
    1,
    72,
    27,
    34,
    8,
    65,
    127,
    106,
    34,
    9,
    116,
    107,
    33,
    10,
    2,
    64,
    32,
    8,
    65,
    2,
    72,
    13,
    0,
    32,
    2,
    32,
    9,
    107,
    33,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    65,
    0,
    33,
    5,
    2,
    64,
    32,
    11,
    32,
    1,
    106,
    34,
    6,
    65,
    0,
    72,
    13,
    0,
    32,
    3,
    32,
    6,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    6,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    33,
    5,
    11,
    32,
    5,
    32,
    1,
    116,
    32,
    10,
    106,
    33,
    10,
    32,
    9,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    71,
    13,
    0,
    11,
    11,
    2,
    64,
    32,
    2,
    32,
    8,
    107,
    34,
    1,
    65,
    0,
    72,
    13,
    0,
    32,
    3,
    32,
    1,
    65,
    3,
    118,
    106,
    45,
    0,
    0,
    32,
    1,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    33,
    7,
    11,
    32,
    0,
    32,
    7,
    32,
    10,
    106,
    34,
    5,
    32,
    5,
    65,
    0,
    32,
    5,
    107,
    113,
    34,
    5,
    65,
    204,
    1,
    113,
    65,
    0,
    71,
    65,
    1,
    116,
    32,
    5,
    65,
    170,
    1,
    113,
    65,
    0,
    71,
    114,
    32,
    5,
    65,
    240,
    1,
    113,
    65,
    0,
    71,
    65,
    2,
    116,
    114,
    34,
    5,
    117,
    58,
    0,
    2,
    32,
    0,
    32,
    1,
    32,
    5,
    106,
    65,
    1,
    106,
    59,
    1,
    0,
    32,
    4,
    32,
    8,
    107,
    33,
    1,
    11,
    32,
    0,
    32,
    1,
    58,
    0,
    3,
    11,
    65,
    0,
    33,
    1,
    2,
    64,
    32,
    0,
    46,
    1,
    0,
    32,
    2,
    71,
    13,
    0,
    32,
    0,
    44,
    0,
    2,
    33,
    1,
    11,
    32,
    1,
    11,
    203,
    3,
    1,
    4,
    127,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    3,
    32,
    5,
    106,
    32,
    1,
    32,
    5,
    106,
    34,
    6,
    40,
    2,
    0,
    32,
    6,
    65,
    40,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    32,
    5,
    106,
    32,
    1,
    32,
    5,
    106,
    34,
    6,
    65,
    40,
    106,
    40,
    2,
    0,
    32,
    6,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    3,
    32,
    3,
    32,
    2,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    4,
    32,
    2,
    65,
    40,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    40,
    106,
    33,
    6,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    6,
    32,
    5,
    106,
    32,
    4,
    32,
    5,
    106,
    40,
    2,
    0,
    32,
    3,
    32,
    5,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    40,
    106,
    33,
    7,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    0,
    32,
    5,
    106,
    32,
    3,
    32,
    5,
    106,
    40,
    2,
    0,
    32,
    4,
    32,
    5,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    1,
    65,
    208,
    0,
    106,
    33,
    6,
    32,
    0,
    65,
    208,
    0,
    106,
    33,
    8,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    8,
    32,
    5,
    106,
    32,
    6,
    32,
    5,
    106,
    40,
    2,
    0,
    65,
    1,
    116,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    65,
    248,
    0,
    106,
    34,
    6,
    32,
    1,
    65,
    248,
    0,
    106,
    32,
    2,
    65,
    208,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    3,
    32,
    5,
    106,
    32,
    0,
    32,
    5,
    106,
    34,
    1,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    4,
    32,
    5,
    106,
    32,
    0,
    32,
    5,
    106,
    34,
    1,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    248,
    0,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    5,
    65,
    4,
    106,
    34,
    5,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    6,
    32,
    0,
    32,
    7,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    0,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    7,
    32,
    7,
    32,
    3,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    208,
    0,
    106,
    32,
    3,
    32,
    4,
    16,
    169,
    128,
    128,
    128,
    0,
    11,
    85,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    2,
    107,
    34,
    4,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    0,
    32,
    1,
    65,
    192,
    137,
    128,
    128,
    0,
    16,
    190,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    2,
    32,
    3,
    32,
    4,
    40,
    2,
    0,
    40,
    2,
    8,
    17,
    128,
    128,
    128,
    128,
    0,
    0,
    32,
    4,
    16,
    191,
    128,
    128,
    128,
    0,
    33,
    2,
    32,
    4,
    65,
    224,
    2,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    11,
    138,
    1,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    192,
    0,
    65,
    0,
    65,
    0,
    32,
    1,
    65,
    32,
    16,
    155,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    24,
    106,
    32,
    2,
    65,
    24,
    106,
    41,
    3,
    0,
    55,
    0,
    0,
    32,
    0,
    65,
    16,
    106,
    32,
    2,
    65,
    16,
    106,
    41,
    3,
    0,
    55,
    0,
    0,
    32,
    0,
    65,
    8,
    106,
    32,
    2,
    41,
    3,
    8,
    55,
    0,
    0,
    32,
    0,
    32,
    2,
    41,
    3,
    0,
    55,
    0,
    0,
    65,
    0,
    33,
    0,
    3,
    64,
    32,
    2,
    32,
    0,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    0,
    65,
    1,
    106,
    34,
    0,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    192,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    244,
    1,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    1,
    16,
    168,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    32,
    2,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    1,
    65,
    160,
    164,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    34,
    3,
    32,
    1,
    65,
    160,
    164,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    3,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    32,
    2,
    16,
    172,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    48,
    106,
    16,
    173,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    140,
    6,
    1,
    2,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    144,
    1,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    1,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    32,
    2,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    4,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    9,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    19,
    33,
    3,
    3,
    64,
    32,
    2,
    32,
    2,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    9,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    49,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    227,
    0,
    33,
    3,
    3,
    64,
    32,
    2,
    32,
    2,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    32,
    2,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    65,
    49,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    127,
    106,
    34,
    3,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    1,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    3,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    3,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    2,
    32,
    3,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    144,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    188,
    1,
    2,
    1,
    127,
    1,
    126,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    32,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    24,
    106,
    32,
    1,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    2,
    32,
    1,
    41,
    0,
    0,
    34,
    3,
    55,
    3,
    0,
    32,
    2,
    32,
    1,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    3,
    8,
    32,
    2,
    32,
    3,
    167,
    65,
    248,
    1,
    113,
    58,
    0,
    0,
    32,
    2,
    32,
    2,
    45,
    0,
    31,
    65,
    63,
    113,
    65,
    192,
    0,
    114,
    58,
    0,
    31,
    32,
    2,
    32,
    1,
    45,
    0,
    0,
    65,
    5,
    108,
    65,
    255,
    1,
    113,
    16,
    202,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    128,
    138,
    128,
    128,
    0,
    65,
    128,
    2,
    16,
    167,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    32,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    80,
    2,
    2,
    126,
    1,
    127,
    32,
    1,
    173,
    66,
    7,
    131,
    33,
    2,
    66,
    0,
    33,
    3,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    0,
    32,
    1,
    106,
    34,
    4,
    32,
    4,
    53,
    0,
    0,
    32,
    3,
    124,
    32,
    1,
    65,
    192,
    156,
    128,
    128,
    0,
    106,
    53,
    2,
    0,
    32,
    2,
    126,
    124,
    34,
    3,
    62,
    0,
    0,
    32,
    3,
    66,
    32,
    136,
    33,
    3,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    11,
    157,
    10,
    3,
    1,
    127,
    1,
    126,
    6,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    208,
    3,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    176,
    3,
    106,
    65,
    24,
    106,
    32,
    1,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    176,
    3,
    106,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    2,
    32,
    1,
    41,
    0,
    0,
    34,
    3,
    55,
    3,
    176,
    3,
    32,
    2,
    32,
    1,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    3,
    184,
    3,
    32,
    2,
    32,
    3,
    167,
    65,
    248,
    1,
    113,
    58,
    0,
    176,
    3,
    32,
    2,
    32,
    2,
    45,
    0,
    207,
    3,
    65,
    63,
    113,
    65,
    192,
    0,
    114,
    58,
    0,
    207,
    3,
    32,
    2,
    65,
    144,
    2,
    106,
    32,
    2,
    65,
    176,
    3,
    106,
    16,
    176,
    128,
    128,
    128,
    0,
    32,
    1,
    45,
    0,
    0,
    33,
    1,
    32,
    2,
    65,
    224,
    1,
    106,
    65,
    0,
    65,
    40,
    252,
    11,
    0,
    32,
    2,
    65,
    0,
    32,
    1,
    65,
    7,
    113,
    34,
    4,
    65,
    1,
    118,
    65,
    1,
    113,
    34,
    5,
    107,
    34,
    6,
    65,
    176,
    193,
    186,
    112,
    113,
    54,
    2,
    224,
    1,
    65,
    4,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    34,
    7,
    32,
    1,
    65,
    160,
    138,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    7,
    40,
    2,
    0,
    34,
    7,
    115,
    32,
    6,
    113,
    32,
    7,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    4,
    65,
    1,
    113,
    107,
    33,
    7,
    3,
    64,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    34,
    8,
    32,
    1,
    65,
    208,
    138,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    8,
    40,
    2,
    0,
    34,
    8,
    115,
    32,
    7,
    113,
    32,
    8,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    4,
    65,
    2,
    118,
    33,
    9,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    128,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    9,
    107,
    33,
    4,
    3,
    64,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    34,
    8,
    32,
    2,
    65,
    128,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    8,
    40,
    2,
    0,
    34,
    8,
    115,
    32,
    4,
    113,
    32,
    8,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    1,
    54,
    2,
    176,
    1,
    32,
    2,
    65,
    176,
    1,
    106,
    65,
    4,
    114,
    65,
    0,
    65,
    36,
    252,
    11,
    0,
    32,
    2,
    65,
    128,
    1,
    106,
    65,
    0,
    65,
    40,
    252,
    11,
    0,
    32,
    2,
    32,
    2,
    40,
    2,
    128,
    1,
    65,
    1,
    115,
    32,
    6,
    113,
    65,
    1,
    115,
    54,
    2,
    176,
    1,
    65,
    4,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    34,
    8,
    32,
    2,
    65,
    128,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    8,
    40,
    2,
    0,
    34,
    8,
    115,
    32,
    6,
    113,
    32,
    8,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    34,
    6,
    32,
    1,
    65,
    128,
    139,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    6,
    40,
    2,
    0,
    34,
    6,
    115,
    32,
    7,
    113,
    32,
    6,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    128,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    5,
    32,
    9,
    115,
    107,
    33,
    7,
    3,
    64,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    34,
    6,
    32,
    2,
    65,
    128,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    6,
    40,
    2,
    0,
    34,
    6,
    115,
    32,
    7,
    113,
    32,
    6,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    8,
    106,
    32,
    1,
    106,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    8,
    106,
    32,
    1,
    106,
    65,
    40,
    106,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    8,
    106,
    65,
    208,
    0,
    106,
    34,
    1,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    2,
    65,
    224,
    1,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    1,
    32,
    1,
    65,
    176,
    139,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    144,
    2,
    106,
    32,
    2,
    65,
    144,
    2,
    106,
    32,
    2,
    65,
    8,
    106,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    2,
    65,
    176,
    1,
    106,
    16,
    196,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    32,
    2,
    65,
    144,
    2,
    106,
    32,
    1,
    106,
    34,
    6,
    65,
    40,
    106,
    40,
    2,
    0,
    32,
    6,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    32,
    2,
    65,
    144,
    2,
    106,
    32,
    1,
    106,
    34,
    6,
    65,
    208,
    0,
    106,
    40,
    2,
    0,
    32,
    6,
    65,
    40,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    2,
    65,
    176,
    1,
    106,
    16,
    172,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    2,
    65,
    176,
    1,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    2,
    65,
    224,
    1,
    106,
    16,
    173,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    224,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    176,
    3,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    176,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    144,
    2,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    160,
    1,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    128,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    8,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    248,
    0,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    208,
    3,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    213,
    6,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    144,
    2,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    240,
    1,
    106,
    65,
    24,
    106,
    32,
    1,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    240,
    1,
    106,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    2,
    32,
    1,
    41,
    0,
    0,
    55,
    3,
    240,
    1,
    32,
    2,
    32,
    1,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    3,
    248,
    1,
    32,
    2,
    32,
    2,
    45,
    0,
    143,
    2,
    65,
    63,
    113,
    58,
    0,
    143,
    2,
    32,
    2,
    65,
    192,
    1,
    106,
    32,
    2,
    65,
    240,
    1,
    106,
    16,
    168,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    192,
    1,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    65,
    2,
    16,
    171,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    1,
    106,
    32,
    1,
    65,
    160,
    164,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    208,
    164,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    34,
    3,
    32,
    3,
    40,
    2,
    0,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    32,
    2,
    65,
    128,
    165,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    48,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    192,
    128,
    128,
    128,
    0,
    33,
    3,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    192,
    1,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    65,
    224,
    139,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    3,
    107,
    33,
    4,
    3,
    64,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    1,
    106,
    34,
    3,
    32,
    1,
    65,
    160,
    164,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    3,
    40,
    2,
    0,
    34,
    3,
    115,
    32,
    4,
    113,
    32,
    3,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    170,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    65,
    128,
    165,
    128,
    128,
    0,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    2,
    65,
    224,
    0,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    1,
    106,
    34,
    3,
    65,
    0,
    32,
    3,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    2,
    65,
    144,
    1,
    106,
    16,
    173,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    224,
    0,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    192,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    144,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    240,
    1,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    144,
    2,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    138,
    1,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    192,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    32,
    106,
    32,
    0,
    16,
    173,
    128,
    128,
    128,
    0,
    32,
    2,
    32,
    1,
    16,
    173,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    32,
    106,
    32,
    2,
    16,
    131,
    128,
    128,
    128,
    0,
    33,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    65,
    32,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    2,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    192,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    0,
    65,
    1,
    106,
    11,
    207,
    4,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    144,
    1,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    1,
    16,
    168,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    65,
    48,
    106,
    32,
    1,
    106,
    32,
    1,
    65,
    128,
    165,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    106,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    3,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    3,
    65,
    48,
    106,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    3,
    32,
    3,
    65,
    126,
    16,
    171,
    128,
    128,
    128,
    0,
    2,
    64,
    2,
    64,
    32,
    3,
    32,
    3,
    16,
    192,
    128,
    128,
    128,
    0,
    13,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    127,
    33,
    4,
    12,
    1,
    11,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    2,
    65,
    1,
    113,
    107,
    33,
    5,
    3,
    64,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    1,
    106,
    34,
    4,
    32,
    3,
    65,
    48,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    4,
    40,
    2,
    0,
    34,
    4,
    115,
    32,
    5,
    113,
    32,
    4,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    3,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    3,
    16,
    169,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    3,
    65,
    2,
    16,
    171,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    32,
    3,
    32,
    1,
    106,
    40,
    2,
    0,
    107,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    65,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    16,
    181,
    128,
    128,
    128,
    0,
    107,
    33,
    5,
    3,
    64,
    32,
    3,
    32,
    1,
    106,
    34,
    4,
    32,
    3,
    65,
    48,
    106,
    32,
    1,
    106,
    40,
    2,
    0,
    32,
    4,
    40,
    2,
    0,
    34,
    4,
    115,
    32,
    5,
    113,
    32,
    4,
    115,
    54,
    2,
    0,
    32,
    1,
    65,
    4,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    3,
    16,
    173,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    0,
    45,
    0,
    31,
    32,
    2,
    65,
    192,
    1,
    113,
    114,
    58,
    0,
    31,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    65,
    48,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    3,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    40,
    71,
    13,
    0,
    11,
    11,
    32,
    3,
    65,
    144,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    4,
    11,
    238,
    2,
    1,
    3,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    56,
    106,
    32,
    2,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    48,
    106,
    32,
    2,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    40,
    106,
    32,
    2,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    32,
    2,
    41,
    0,
    0,
    55,
    3,
    32,
    32,
    3,
    65,
    32,
    106,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    0,
    65,
    192,
    0,
    32,
    4,
    65,
    128,
    136,
    128,
    128,
    0,
    66,
    0,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    32,
    3,
    65,
    192,
    0,
    106,
    32,
    3,
    16,
    203,
    128,
    128,
    128,
    0,
    32,
    4,
    32,
    3,
    65,
    192,
    0,
    106,
    32,
    3,
    45,
    0,
    32,
    16,
    206,
    128,
    128,
    128,
    0,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    2,
    32,
    5,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    4,
    41,
    0,
    0,
    55,
    0,
    0,
    32,
    0,
    65,
    24,
    106,
    32,
    4,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    0,
    0,
    32,
    0,
    65,
    16,
    106,
    32,
    4,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    0,
    0,
    32,
    0,
    65,
    8,
    106,
    32,
    4,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    0,
    0,
    32,
    1,
    32,
    3,
    41,
    3,
    0,
    55,
    0,
    0,
    32,
    1,
    65,
    8,
    106,
    32,
    3,
    41,
    3,
    8,
    55,
    0,
    0,
    32,
    1,
    65,
    16,
    106,
    32,
    3,
    65,
    16,
    106,
    41,
    3,
    0,
    55,
    0,
    0,
    32,
    1,
    65,
    24,
    106,
    32,
    3,
    65,
    24,
    106,
    41,
    3,
    0,
    55,
    0,
    0,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    3,
    32,
    5,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    5,
    3,
    64,
    32,
    3,
    65,
    192,
    0,
    106,
    32,
    5,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    5,
    65,
    1,
    106,
    34,
    5,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    30,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    16,
    166,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    0,
    65,
    128,
    136,
    128,
    128,
    0,
    16,
    134,
    128,
    128,
    128,
    0,
    11,
    195,
    6,
    2,
    2,
    127,
    1,
    126,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    160,
    1,
    107,
    34,
    3,
    36,
    128,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    32,
    3,
    65,
    128,
    1,
    106,
    65,
    24,
    106,
    65,
    0,
    41,
    3,
    200,
    140,
    128,
    128,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    128,
    1,
    106,
    65,
    16,
    106,
    65,
    0,
    41,
    3,
    192,
    140,
    128,
    128,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    0,
    41,
    3,
    184,
    140,
    128,
    128,
    0,
    55,
    3,
    136,
    1,
    32,
    3,
    65,
    0,
    41,
    3,
    176,
    140,
    128,
    128,
    0,
    55,
    3,
    128,
    1,
    32,
    3,
    65,
    224,
    0,
    106,
    65,
    24,
    106,
    32,
    1,
    65,
    24,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    65,
    16,
    106,
    32,
    1,
    65,
    16,
    106,
    41,
    0,
    0,
    55,
    3,
    0,
    32,
    3,
    32,
    1,
    41,
    0,
    0,
    34,
    5,
    55,
    3,
    96,
    32,
    3,
    32,
    1,
    65,
    8,
    106,
    41,
    0,
    0,
    55,
    3,
    104,
    32,
    3,
    32,
    5,
    167,
    65,
    248,
    1,
    113,
    58,
    0,
    96,
    32,
    3,
    32,
    3,
    45,
    0,
    127,
    65,
    63,
    113,
    65,
    192,
    0,
    114,
    58,
    0,
    127,
    32,
    3,
    65,
    24,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    16,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    3,
    66,
    0,
    55,
    3,
    8,
    32,
    3,
    66,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    32,
    106,
    33,
    1,
    3,
    64,
    32,
    1,
    32,
    4,
    106,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    4,
    106,
    40,
    2,
    0,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    3,
    16,
    186,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    192,
    0,
    106,
    32,
    4,
    106,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    4,
    106,
    40,
    2,
    0,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    65,
    252,
    1,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    0,
    65,
    192,
    0,
    252,
    11,
    0,
    32,
    3,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    3,
    65,
    128,
    1,
    106,
    16,
    188,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    3,
    16,
    210,
    128,
    128,
    128,
    0,
    2,
    64,
    32,
    4,
    65,
    3,
    118,
    65,
    144,
    140,
    128,
    128,
    0,
    106,
    45,
    0,
    0,
    32,
    4,
    65,
    7,
    113,
    118,
    65,
    1,
    113,
    69,
    13,
    0,
    32,
    3,
    65,
    0,
    65,
    192,
    0,
    252,
    11,
    0,
    32,
    3,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    3,
    65,
    192,
    0,
    106,
    16,
    188,
    128,
    128,
    128,
    0,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    3,
    16,
    210,
    128,
    128,
    128,
    0,
    11,
    32,
    4,
    65,
    127,
    106,
    34,
    4,
    65,
    127,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    40,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    48,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    56,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    24,
    106,
    32,
    3,
    65,
    128,
    1,
    106,
    65,
    24,
    106,
    41,
    3,
    0,
    55,
    3,
    0,
    32,
    3,
    65,
    16,
    106,
    32,
    3,
    65,
    128,
    1,
    106,
    65,
    16,
    106,
    41,
    3,
    0,
    55,
    3,
    0,
    32,
    3,
    32,
    3,
    41,
    3,
    136,
    1,
    55,
    3,
    8,
    32,
    3,
    32,
    3,
    41,
    3,
    128,
    1,
    55,
    3,
    0,
    32,
    3,
    66,
    0,
    55,
    3,
    32,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    3,
    16,
    210,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    4,
    106,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    4,
    106,
    40,
    2,
    0,
    54,
    2,
    0,
    32,
    4,
    65,
    4,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    3,
    45,
    0,
    96,
    65,
    3,
    108,
    65,
    255,
    1,
    113,
    16,
    202,
    128,
    128,
    128,
    0,
    32,
    0,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    2,
    65,
    128,
    2,
    16,
    167,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    224,
    0,
    106,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    192,
    0,
    106,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    4,
    3,
    64,
    32,
    3,
    65,
    128,
    1,
    106,
    32,
    4,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    4,
    65,
    1,
    106,
    34,
    4,
    65,
    32,
    71,
    13,
    0,
    11,
    32,
    3,
    65,
    160,
    1,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    240,
    2,
    5,
    4,
    127,
    1,
    126,
    1,
    127,
    1,
    126,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    2,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    2,
    65,
    216,
    0,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    208,
    0,
    106,
    66,
    0,
    55,
    3,
    0,
    32,
    2,
    66,
    0,
    55,
    3,
    72,
    32,
    2,
    66,
    0,
    55,
    3,
    64,
    65,
    0,
    33,
    3,
    65,
    32,
    33,
    4,
    32,
    2,
    65,
    192,
    0,
    106,
    33,
    5,
    3,
    64,
    32,
    1,
    32,
    3,
    65,
    2,
    116,
    106,
    53,
    2,
    0,
    33,
    6,
    65,
    0,
    33,
    7,
    66,
    0,
    33,
    8,
    3,
    64,
    32,
    5,
    32,
    7,
    106,
    34,
    9,
    32,
    8,
    32,
    9,
    53,
    2,
    0,
    124,
    32,
    7,
    65,
    224,
    165,
    128,
    128,
    0,
    106,
    53,
    2,
    0,
    32,
    6,
    126,
    124,
    34,
    8,
    62,
    2,
    0,
    32,
    8,
    66,
    32,
    136,
    33,
    8,
    32,
    4,
    32,
    7,
    65,
    4,
    106,
    34,
    7,
    71,
    13,
    0,
    11,
    32,
    5,
    65,
    4,
    106,
    33,
    5,
    32,
    4,
    65,
    124,
    106,
    33,
    4,
    32,
    3,
    65,
    1,
    106,
    34,
    3,
    65,
    8,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    7,
    32,
    2,
    65,
    0,
    65,
    192,
    0,
    252,
    11,
    0,
    32,
    2,
    32,
    2,
    65,
    192,
    0,
    106,
    65,
    192,
    156,
    128,
    128,
    0,
    16,
    188,
    128,
    128,
    128,
    0,
    66,
    0,
    33,
    8,
    3,
    64,
    32,
    2,
    32,
    7,
    106,
    34,
    9,
    32,
    8,
    32,
    9,
    53,
    2,
    0,
    124,
    32,
    1,
    32,
    7,
    106,
    53,
    2,
    0,
    124,
    34,
    8,
    62,
    2,
    0,
    32,
    8,
    66,
    32,
    136,
    33,
    8,
    32,
    7,
    65,
    4,
    106,
    34,
    7,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    0,
    32,
    2,
    65,
    32,
    106,
    16,
    211,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    7,
    3,
    64,
    32,
    2,
    65,
    192,
    0,
    106,
    32,
    7,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    7,
    65,
    1,
    106,
    34,
    7,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    7,
    3,
    64,
    32,
    2,
    32,
    7,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    7,
    65,
    1,
    106,
    34,
    7,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    2,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    140,
    1,
    2,
    1,
    126,
    2,
    127,
    66,
    1,
    33,
    2,
    65,
    0,
    33,
    3,
    3,
    64,
    32,
    2,
    32,
    1,
    32,
    3,
    106,
    53,
    2,
    0,
    124,
    32,
    3,
    65,
    192,
    156,
    128,
    128,
    0,
    106,
    53,
    2,
    0,
    66,
    255,
    255,
    255,
    255,
    15,
    133,
    124,
    66,
    32,
    136,
    33,
    2,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    3,
    65,
    0,
    32,
    2,
    167,
    107,
    33,
    4,
    3,
    64,
    32,
    0,
    32,
    3,
    106,
    32,
    2,
    32,
    1,
    32,
    3,
    106,
    53,
    2,
    0,
    124,
    32,
    3,
    65,
    192,
    156,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    65,
    127,
    115,
    32,
    4,
    113,
    173,
    124,
    34,
    2,
    62,
    2,
    0,
    32,
    2,
    66,
    32,
    136,
    33,
    2,
    32,
    3,
    65,
    4,
    106,
    34,
    3,
    65,
    32,
    71,
    13,
    0,
    11,
    11,
    183,
    1,
    1,
    1,
    127,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    8,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    8,
    65,
    192,
    0,
    106,
    32,
    2,
    32,
    3,
    16,
    134,
    128,
    128,
    128,
    0,
    32,
    8,
    65,
    0,
    65,
    192,
    0,
    32,
    8,
    65,
    192,
    0,
    106,
    32,
    3,
    65,
    16,
    106,
    34,
    3,
    66,
    0,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    32,
    1,
    32,
    6,
    32,
    7,
    32,
    8,
    65,
    192,
    0,
    106,
    32,
    3,
    66,
    1,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    32,
    0,
    32,
    8,
    32,
    4,
    32,
    5,
    32,
    1,
    32,
    7,
    16,
    213,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    8,
    65,
    192,
    0,
    106,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    1,
    3,
    64,
    32,
    8,
    32,
    1,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    1,
    65,
    1,
    106,
    34,
    1,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    32,
    8,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    234,
    1,
    2,
    1,
    127,
    1,
    126,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    224,
    0,
    107,
    34,
    6,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    0,
    54,
    2,
    92,
    32,
    6,
    32,
    5,
    58,
    0,
    88,
    32,
    6,
    65,
    0,
    54,
    2,
    84,
    32,
    6,
    32,
    3,
    58,
    0,
    80,
    32,
    6,
    32,
    5,
    173,
    34,
    7,
    66,
    24,
    136,
    60,
    0,
    91,
    32,
    6,
    32,
    7,
    66,
    16,
    136,
    60,
    0,
    90,
    32,
    6,
    32,
    7,
    66,
    8,
    136,
    60,
    0,
    89,
    32,
    6,
    32,
    3,
    173,
    34,
    7,
    66,
    24,
    136,
    60,
    0,
    83,
    32,
    6,
    32,
    7,
    66,
    16,
    136,
    60,
    0,
    82,
    32,
    6,
    32,
    7,
    66,
    8,
    136,
    60,
    0,
    81,
    32,
    6,
    32,
    1,
    16,
    142,
    128,
    128,
    128,
    0,
    32,
    6,
    32,
    2,
    32,
    3,
    16,
    143,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    128,
    136,
    128,
    128,
    0,
    65,
    0,
    32,
    3,
    107,
    65,
    15,
    113,
    16,
    143,
    128,
    128,
    128,
    0,
    32,
    6,
    32,
    4,
    32,
    5,
    16,
    143,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    128,
    136,
    128,
    128,
    0,
    65,
    0,
    32,
    5,
    107,
    65,
    15,
    113,
    16,
    143,
    128,
    128,
    128,
    0,
    32,
    6,
    32,
    6,
    65,
    208,
    0,
    106,
    65,
    16,
    16,
    143,
    128,
    128,
    128,
    0,
    32,
    6,
    32,
    0,
    16,
    146,
    128,
    128,
    128,
    0,
    32,
    6,
    65,
    224,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    11,
    215,
    2,
    2,
    1,
    127,
    1,
    126,
    35,
    128,
    128,
    128,
    128,
    0,
    65,
    240,
    0,
    107,
    34,
    8,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    8,
    65,
    208,
    0,
    106,
    32,
    1,
    32,
    2,
    16,
    134,
    128,
    128,
    128,
    0,
    32,
    8,
    65,
    16,
    106,
    65,
    0,
    65,
    192,
    0,
    32,
    8,
    65,
    208,
    0,
    106,
    32,
    2,
    65,
    16,
    106,
    34,
    1,
    66,
    0,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    32,
    8,
    32,
    8,
    65,
    16,
    106,
    32,
    4,
    32,
    5,
    32,
    6,
    32,
    7,
    16,
    213,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    8,
    65,
    16,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    192,
    0,
    71,
    13,
    0,
    11,
    2,
    64,
    2,
    64,
    32,
    3,
    32,
    8,
    16,
    129,
    128,
    128,
    128,
    0,
    34,
    9,
    66,
    32,
    136,
    32,
    9,
    66,
    255,
    255,
    255,
    255,
    15,
    131,
    132,
    66,
    127,
    124,
    66,
    128,
    128,
    128,
    128,
    16,
    131,
    66,
    0,
    82,
    13,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    8,
    65,
    208,
    0,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    8,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    65,
    127,
    33,
    6,
    12,
    1,
    11,
    32,
    0,
    32,
    6,
    32,
    7,
    32,
    8,
    65,
    208,
    0,
    106,
    32,
    1,
    66,
    1,
    16,
    137,
    128,
    128,
    128,
    0,
    26,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    8,
    65,
    208,
    0,
    106,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    32,
    71,
    13,
    0,
    11,
    65,
    0,
    33,
    6,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    8,
    32,
    2,
    106,
    65,
    0,
    58,
    0,
    0,
    32,
    2,
    65,
    1,
    106,
    34,
    2,
    65,
    16,
    71,
    13,
    0,
    11,
    11,
    32,
    8,
    65,
    240,
    0,
    106,
    36,
    128,
    128,
    128,
    128,
    0,
    32,
    6,
    11,
    24,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    65,
    0,
    65,
    0,
    32,
    4,
    32,
    5,
    16,
    212,
    128,
    128,
    128,
    0,
    11,
    24,
    0,
    32,
    0,
    32,
    1,
    32,
    2,
    32,
    3,
    65,
    0,
    65,
    0,
    32,
    4,
    32,
    5,
    16,
    214,
    128,
    128,
    128,
    0,
    11,
    92,
    1,
    2,
    127,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    1,
    32,
    2,
    106,
    32,
    0,
    32,
    2,
    106,
    41,
    3,
    0,
    55,
    3,
    0,
    32,
    2,
    65,
    8,
    106,
    34,
    2,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    32,
    0,
    16,
    164,
    128,
    128,
    128,
    0,
    65,
    0,
    33,
    2,
    3,
    64,
    32,
    0,
    32,
    2,
    106,
    34,
    3,
    32,
    3,
    41,
    3,
    0,
    32,
    1,
    32,
    2,
    106,
    41,
    3,
    0,
    133,
    55,
    3,
    0,
    32,
    2,
    65,
    8,
    106,
    34,
    2,
    65,
    128,
    8,
    71,
    13,
    0,
    11,
    11,
    223,
    2,
    1,
    5,
    127,
    65,
    0,
    33,
    1,
    2,
    64,
    32,
    0,
    65,
    7,
    106,
    34,
    2,
    65,
    16,
    73,
    13,
    0,
    65,
    1,
    33,
    1,
    32,
    2,
    65,
    3,
    118,
    34,
    3,
    65,
    2,
    70,
    13,
    0,
    65,
    2,
    33,
    1,
    32,
    2,
    65,
    32,
    73,
    13,
    0,
    65,
    3,
    33,
    1,
    32,
    3,
    65,
    4,
    70,
    13,
    0,
    65,
    4,
    33,
    1,
    32,
    2,
    65,
    48,
    73,
    13,
    0,
    65,
    5,
    33,
    1,
    32,
    3,
    65,
    6,
    70,
    13,
    0,
    65,
    6,
    33,
    1,
    32,
    2,
    65,
    200,
    0,
    73,
    13,
    0,
    65,
    7,
    33,
    1,
    32,
    2,
    65,
    216,
    0,
    73,
    13,
    0,
    65,
    8,
    33,
    1,
    32,
    2,
    65,
    136,
    1,
    73,
    13,
    0,
    65,
    9,
    33,
    1,
    32,
    2,
    65,
    136,
    2,
    73,
    13,
    0,
    32,
    0,
    16,
    219,
    128,
    128,
    128,
    0,
    34,
    0,
    65,
    8,
    106,
    65,
    0,
    32,
    0,
    27,
    15,
    11,
    2,
    64,
    2,
    64,
    32,
    1,
    65,
    2,
    116,
    65,
    192,
    166,
    128,
    128,
    0,
    106,
    34,
    4,
    40,
    2,
    0,
    34,
    0,
    13,
    0,
    65,
    0,
    33,
    0,
    2,
    64,
    2,
    64,
    65,
    0,
    40,
    2,
    228,
    166,
    128,
    128,
    0,
    34,
    2,
    69,
    13,
    0,
    65,
    0,
    32,
    2,
    40,
    2,
    0,
    54,
    2,
    228,
    166,
    128,
    128,
    0,
    12,
    1,
    11,
    65,
    0,
    16,
    219,
    128,
    128,
    128,
    0,
    34,
    2,
    69,
    13,
    2,
    11,
    32,
    2,
    65,
    128,
    128,
    124,
    113,
    34,
    0,
    32,
    2,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    34,
    2,
    114,
    32,
    1,
    58,
    0,
    0,
    32,
    2,
    65,
    8,
    116,
    32,
    0,
    114,
    65,
    128,
    2,
    106,
    33,
    0,
    65,
    0,
    33,
    2,
    65,
    0,
    32,
    1,
    65,
    2,
    116,
    65,
    128,
    166,
    128,
    128,
    0,
    106,
    40,
    2,
    0,
    34,
    3,
    107,
    33,
    5,
    32,
    3,
    33,
    1,
    3,
    64,
    32,
    0,
    32,
    5,
    106,
    34,
    0,
    32,
    2,
    54,
    2,
    0,
    32,
    0,
    33,
    2,
    32,
    1,
    32,
    3,
    106,
    34,
    1,
    65,
    129,
    2,
    73,
    13,
    0,
    11,
    32,
    4,
    32,
    0,
    54,
    2,
    0,
    11,
    32,
    4,
    32,
    0,
    40,
    2,
    0,
    54,
    2,
    0,
    11,
    32,
    0,
    11,
    190,
    9,
    1,
    7,
    127,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    2,
    64,
    65,
    0,
    45,
    0,
    180,
    166,
    128,
    128,
    0,
    69,
    13,
    0,
    65,
    0,
    65,
    0,
    58,
    0,
    180,
    166,
    128,
    128,
    0,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    34,
    1,
    69,
    13,
    1,
    65,
    176,
    166,
    128,
    128,
    0,
    33,
    2,
    3,
    64,
    32,
    1,
    65,
    8,
    106,
    34,
    3,
    32,
    1,
    40,
    2,
    4,
    34,
    4,
    106,
    34,
    5,
    65,
    255,
    1,
    106,
    65,
    128,
    126,
    113,
    32,
    5,
    71,
    13,
    6,
    32,
    5,
    33,
    6,
    3,
    64,
    2,
    64,
    2,
    64,
    32,
    5,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    34,
    7,
    69,
    13,
    0,
    32,
    5,
    65,
    128,
    128,
    124,
    113,
    32,
    7,
    114,
    45,
    0,
    0,
    65,
    254,
    1,
    71,
    13,
    0,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    34,
    5,
    69,
    13,
    9,
    2,
    64,
    32,
    5,
    32,
    6,
    71,
    13,
    0,
    65,
    176,
    166,
    128,
    128,
    0,
    33,
    7,
    12,
    2,
    11,
    3,
    64,
    32,
    5,
    34,
    7,
    40,
    2,
    0,
    34,
    5,
    69,
    13,
    10,
    32,
    5,
    32,
    6,
    70,
    13,
    2,
    12,
    0,
    11,
    11,
    32,
    2,
    40,
    2,
    0,
    34,
    2,
    40,
    2,
    0,
    34,
    1,
    13,
    2,
    12,
    3,
    11,
    32,
    7,
    32,
    6,
    40,
    2,
    0,
    54,
    2,
    0,
    32,
    1,
    32,
    4,
    32,
    6,
    40,
    2,
    4,
    106,
    65,
    8,
    106,
    34,
    4,
    54,
    2,
    4,
    32,
    7,
    32,
    2,
    32,
    2,
    32,
    6,
    70,
    27,
    33,
    2,
    32,
    3,
    32,
    4,
    106,
    34,
    5,
    33,
    6,
    32,
    5,
    65,
    255,
    1,
    106,
    65,
    128,
    126,
    113,
    32,
    5,
    70,
    13,
    0,
    12,
    7,
    11,
    11,
    11,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    34,
    6,
    69,
    13,
    0,
    32,
    0,
    65,
    135,
    2,
    106,
    65,
    128,
    126,
    113,
    33,
    3,
    65,
    127,
    33,
    2,
    65,
    176,
    166,
    128,
    128,
    0,
    33,
    4,
    65,
    0,
    33,
    1,
    65,
    176,
    166,
    128,
    128,
    0,
    33,
    5,
    3,
    64,
    32,
    5,
    33,
    7,
    2,
    64,
    32,
    6,
    34,
    5,
    40,
    2,
    4,
    34,
    6,
    32,
    0,
    73,
    13,
    0,
    32,
    6,
    32,
    2,
    79,
    13,
    0,
    32,
    6,
    33,
    2,
    32,
    7,
    33,
    4,
    32,
    5,
    33,
    1,
    32,
    6,
    65,
    8,
    106,
    32,
    3,
    71,
    13,
    0,
    32,
    7,
    33,
    4,
    32,
    6,
    33,
    2,
    32,
    5,
    33,
    1,
    12,
    4,
    11,
    32,
    5,
    40,
    2,
    0,
    34,
    6,
    13,
    0,
    11,
    32,
    1,
    13,
    2,
    12,
    1,
    11,
    65,
    176,
    166,
    128,
    128,
    0,
    33,
    4,
    11,
    63,
    0,
    65,
    16,
    116,
    33,
    3,
    32,
    0,
    65,
    136,
    2,
    106,
    33,
    2,
    65,
    0,
    33,
    7,
    2,
    64,
    2,
    64,
    65,
    0,
    40,
    2,
    184,
    166,
    128,
    128,
    0,
    34,
    1,
    69,
    13,
    0,
    65,
    0,
    33,
    6,
    32,
    3,
    33,
    5,
    12,
    1,
    11,
    65,
    0,
    32,
    3,
    65,
    240,
    166,
    132,
    128,
    0,
    65,
    255,
    255,
    3,
    106,
    65,
    128,
    128,
    124,
    113,
    34,
    5,
    107,
    34,
    1,
    54,
    2,
    184,
    166,
    128,
    128,
    0,
    32,
    1,
    33,
    6,
    11,
    2,
    64,
    32,
    2,
    32,
    6,
    77,
    13,
    0,
    32,
    2,
    32,
    6,
    107,
    34,
    7,
    32,
    1,
    65,
    1,
    118,
    34,
    2,
    32,
    2,
    32,
    7,
    73,
    27,
    65,
    255,
    255,
    3,
    106,
    34,
    2,
    65,
    128,
    128,
    124,
    113,
    34,
    7,
    69,
    13,
    3,
    32,
    2,
    65,
    16,
    118,
    64,
    0,
    65,
    127,
    70,
    13,
    2,
    65,
    0,
    65,
    0,
    40,
    2,
    184,
    166,
    128,
    128,
    0,
    32,
    7,
    106,
    54,
    2,
    184,
    166,
    128,
    128,
    0,
    11,
    32,
    7,
    32,
    6,
    106,
    34,
    6,
    69,
    13,
    2,
    32,
    6,
    32,
    6,
    65,
    255,
    255,
    3,
    106,
    65,
    128,
    128,
    124,
    113,
    71,
    13,
    2,
    32,
    5,
    69,
    13,
    1,
    32,
    5,
    65,
    255,
    1,
    58,
    0,
    1,
    32,
    5,
    65,
    132,
    2,
    106,
    32,
    6,
    65,
    128,
    128,
    124,
    113,
    65,
    248,
    125,
    106,
    34,
    2,
    54,
    2,
    0,
    32,
    5,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    54,
    2,
    128,
    2,
    32,
    2,
    32,
    0,
    65,
    8,
    106,
    73,
    13,
    2,
    32,
    5,
    65,
    128,
    2,
    106,
    33,
    1,
    11,
    32,
    1,
    65,
    128,
    128,
    124,
    113,
    34,
    5,
    32,
    1,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    114,
    65,
    255,
    1,
    58,
    0,
    0,
    32,
    4,
    32,
    1,
    40,
    2,
    0,
    54,
    2,
    0,
    2,
    64,
    2,
    64,
    32,
    2,
    32,
    0,
    107,
    65,
    128,
    126,
    113,
    34,
    6,
    13,
    0,
    32,
    1,
    33,
    3,
    12,
    1,
    11,
    2,
    64,
    2,
    64,
    32,
    5,
    32,
    6,
    65,
    127,
    115,
    32,
    1,
    65,
    8,
    106,
    34,
    4,
    32,
    2,
    106,
    34,
    7,
    106,
    65,
    128,
    128,
    124,
    113,
    71,
    13,
    0,
    32,
    1,
    33,
    3,
    32,
    7,
    65,
    255,
    1,
    106,
    65,
    128,
    126,
    113,
    32,
    7,
    71,
    13,
    4,
    12,
    1,
    11,
    32,
    7,
    65,
    255,
    255,
    3,
    106,
    65,
    128,
    128,
    124,
    113,
    33,
    6,
    2,
    64,
    32,
    0,
    65,
    247,
    253,
    3,
    75,
    13,
    0,
    32,
    6,
    32,
    7,
    71,
    13,
    4,
    32,
    5,
    32,
    4,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    106,
    65,
    254,
    1,
    58,
    0,
    0,
    32,
    1,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    54,
    2,
    0,
    32,
    1,
    65,
    128,
    128,
    4,
    32,
    4,
    65,
    255,
    255,
    3,
    113,
    107,
    34,
    6,
    54,
    2,
    4,
    65,
    0,
    32,
    1,
    54,
    2,
    176,
    166,
    128,
    128,
    0,
    16,
    221,
    128,
    128,
    128,
    0,
    32,
    5,
    65,
    132,
    130,
    4,
    106,
    32,
    2,
    32,
    6,
    107,
    65,
    248,
    125,
    106,
    34,
    6,
    54,
    2,
    0,
    32,
    5,
    65,
    129,
    128,
    4,
    106,
    65,
    255,
    1,
    58,
    0,
    0,
    32,
    6,
    32,
    0,
    73,
    13,
    4,
    32,
    5,
    65,
    128,
    130,
    4,
    106,
    33,
    3,
    32,
    6,
    32,
    0,
    107,
    65,
    128,
    126,
    113,
    33,
    6,
    12,
    1,
    11,
    32,
    6,
    32,
    7,
    71,
    13,
    3,
    32,
    2,
    32,
    4,
    65,
    255,
    255,
    3,
    113,
    34,
    5,
    106,
    32,
    0,
    32,
    5,
    106,
    65,
    127,
    106,
    65,
    128,
    128,
    124,
    113,
    107,
    65,
    128,
    128,
    124,
    106,
    33,
    6,
    32,
    1,
    33,
    3,
    11,
    32,
    3,
    32,
    3,
    40,
    2,
    4,
    32,
    6,
    107,
    54,
    2,
    4,
    65,
    0,
    32,
    6,
    107,
    33,
    5,
    32,
    7,
    32,
    6,
    107,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    33,
    6,
    2,
    64,
    3,
    64,
    32,
    5,
    34,
    7,
    65,
    128,
    2,
    106,
    33,
    5,
    32,
    6,
    34,
    4,
    13,
    1,
    65,
    1,
    33,
    6,
    32,
    7,
    13,
    0,
    11,
    11,
    32,
    7,
    69,
    13,
    0,
    32,
    2,
    32,
    1,
    106,
    32,
    5,
    106,
    65,
    136,
    126,
    106,
    65,
    128,
    128,
    124,
    113,
    34,
    6,
    32,
    4,
    106,
    65,
    254,
    1,
    58,
    0,
    0,
    32,
    6,
    32,
    4,
    65,
    8,
    116,
    106,
    34,
    6,
    65,
    248,
    1,
    32,
    5,
    107,
    54,
    2,
    4,
    32,
    6,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    54,
    2,
    0,
    32,
    6,
    32,
    5,
    107,
    34,
    5,
    65,
    128,
    2,
    106,
    32,
    5,
    65,
    255,
    3,
    106,
    65,
    128,
    126,
    113,
    71,
    13,
    2,
    65,
    0,
    32,
    6,
    54,
    2,
    176,
    166,
    128,
    128,
    0,
    16,
    221,
    128,
    128,
    128,
    0,
    11,
    32,
    3,
    32,
    3,
    40,
    2,
    4,
    106,
    34,
    5,
    65,
    135,
    2,
    106,
    65,
    128,
    126,
    113,
    32,
    5,
    65,
    8,
    106,
    71,
    13,
    1,
    32,
    3,
    15,
    11,
    65,
    0,
    15,
    11,
    0,
    0,
    11,
    137,
    1,
    1,
    2,
    127,
    2,
    64,
    2,
    64,
    32,
    0,
    69,
    13,
    0,
    2,
    64,
    32,
    0,
    65,
    128,
    128,
    124,
    113,
    32,
    0,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    114,
    34,
    1,
    45,
    0,
    0,
    34,
    2,
    65,
    255,
    1,
    71,
    13,
    0,
    32,
    0,
    65,
    120,
    106,
    34,
    0,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    54,
    2,
    0,
    65,
    0,
    32,
    0,
    54,
    2,
    176,
    166,
    128,
    128,
    0,
    32,
    1,
    65,
    254,
    1,
    58,
    0,
    0,
    65,
    0,
    65,
    1,
    58,
    0,
    180,
    166,
    128,
    128,
    0,
    15,
    11,
    32,
    2,
    65,
    10,
    79,
    13,
    1,
    32,
    0,
    32,
    2,
    65,
    2,
    116,
    65,
    192,
    166,
    128,
    128,
    0,
    106,
    34,
    2,
    40,
    2,
    0,
    54,
    2,
    0,
    32,
    2,
    32,
    0,
    54,
    2,
    0,
    11,
    15,
    11,
    0,
    0,
    11,
    107,
    1,
    2,
    127,
    2,
    64,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    34,
    0,
    40,
    2,
    4,
    65,
    255,
    1,
    75,
    13,
    0,
    32,
    0,
    65,
    128,
    128,
    124,
    113,
    34,
    1,
    32,
    0,
    65,
    8,
    118,
    65,
    255,
    1,
    113,
    34,
    0,
    114,
    65,
    9,
    58,
    0,
    0,
    65,
    0,
    65,
    0,
    40,
    2,
    176,
    166,
    128,
    128,
    0,
    40,
    2,
    0,
    54,
    2,
    176,
    166,
    128,
    128,
    0,
    32,
    1,
    32,
    0,
    65,
    8,
    116,
    114,
    34,
    0,
    65,
    0,
    40,
    2,
    228,
    166,
    128,
    128,
    0,
    54,
    2,
    0,
    65,
    0,
    32,
    0,
    54,
    2,
    228,
    166,
    128,
    128,
    0,
    11,
    11,
    11,
    176,
    30,
    1,
    0,
    65,
    128,
    8,
    11,
    168,
    30,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    8,
    201,
    188,
    243,
    103,
    230,
    9,
    106,
    59,
    167,
    202,
    132,
    133,
    174,
    103,
    187,
    43,
    248,
    148,
    254,
    114,
    243,
    110,
    60,
    241,
    54,
    29,
    95,
    58,
    245,
    79,
    165,
    209,
    130,
    230,
    173,
    127,
    82,
    14,
    81,
    31,
    108,
    62,
    43,
    140,
    104,
    5,
    155,
    107,
    189,
    65,
    251,
    171,
    217,
    131,
    31,
    121,
    33,
    126,
    19,
    25,
    205,
    224,
    91,
    1,
    0,
    0,
    0,
    2,
    0,
    0,
    0,
    3,
    0,
    0,
    0,
    4,
    0,
    0,
    0,
    96,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    9,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    52,
    252,
    108,
    183,
    200,
    222,
    88,
    151,
    119,
    112,
    217,
    82,
    22,
    204,
    220,
    108,
    133,
    144,
    190,
    205,
    145,
    156,
    7,
    89,
    148,
    20,
    86,
    59,
    75,
    164,
    71,
    15,
    176,
    160,
    14,
    254,
    211,
    201,
    134,
    255,
    158,
    24,
    143,
    0,
    127,
    105,
    53,
    0,
    96,
    12,
    189,
    0,
    167,
    215,
    251,
    255,
    159,
    76,
    128,
    254,
    106,
    101,
    225,
    255,
    30,
    252,
    4,
    0,
    146,
    12,
    174,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    74,
    209,
    69,
    1,
    177,
    145,
    81,
    0,
    212,
    27,
    71,
    0,
    47,
    159,
    128,
    255,
    242,
    100,
    112,
    1,
    187,
    74,
    222,
    0,
    28,
    153,
    204,
    1,
    38,
    29,
    69,
    255,
    149,
    99,
    0,
    254,
    231,
    86,
    127,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    38,
    232,
    149,
    255,
    164,
    176,
    236,
    255,
    5,
    182,
    104,
    0,
    166,
    79,
    148,
    255,
    192,
    99,
    194,
    255,
    214,
    223,
    172,
    255,
    131,
    105,
    227,
    1,
    38,
    39,
    22,
    255,
    36,
    128,
    216,
    254,
    78,
    241,
    23,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    89,
    241,
    178,
    254,
    10,
    229,
    166,
    255,
    123,
    221,
    42,
    254,
    30,
    20,
    212,
    0,
    82,
    128,
    3,
    0,
    48,
    209,
    243,
    0,
    119,
    121,
    64,
    255,
    50,
    227,
    156,
    255,
    0,
    110,
    197,
    1,
    103,
    27,
    144,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    141,
    190,
    226,
    255,
    91,
    108,
    242,
    0,
    196,
    206,
    225,
    254,
    2,
    45,
    149,
    255,
    64,
    231,
    133,
    254,
    178,
    80,
    8,
    0,
    194,
    102,
    255,
    254,
    45,
    53,
    61,
    0,
    196,
    7,
    246,
    255,
    220,
    230,
    163,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    235,
    211,
    245,
    92,
    26,
    99,
    18,
    88,
    214,
    156,
    247,
    162,
    222,
    249,
    222,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    16,
    29,
    149,
    152,
    141,
    116,
    49,
    236,
    214,
    112,
    207,
    125,
    115,
    244,
    91,
    239,
    198,
    254,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    15,
    247,
    233,
    122,
    46,
    141,
    49,
    9,
    44,
    107,
    206,
    123,
    81,
    239,
    124,
    111,
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    8,
    142,
    74,
    204,
    70,
    186,
    24,
    118,
    107,
    184,
    231,
    190,
    57,
    250,
    173,
    119,
    99,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    7,
    167,
    252,
    151,
    255,
    65,
    137,
    220,
    255,
    75,
    197,
    167,
    254,
    204,
    229,
    1,
    0,
    2,
    229,
    18,
    1,
    233,
    196,
    127,
    0,
    124,
    20,
    49,
    1,
    224,
    53,
    30,
    0,
    91,
    243,
    228,
    254,
    131,
    160,
    138,
    0,
    17,
    67,
    157,
    0,
    48,
    39,
    6,
    0,
    85,
    112,
    226,
    0,
    170,
    255,
    146,
    0,
    206,
    35,
    129,
    0,
    91,
    131,
    128,
    255,
    119,
    182,
    37,
    255,
    47,
    212,
    223,
    0,
    182,
    83,
    145,
    1,
    0,
    2,
    43,
    0,
    68,
    154,
    165,
    254,
    232,
    3,
    207,
    255,
    132,
    243,
    44,
    255,
    140,
    83,
    211,
    255,
    63,
    225,
    6,
    255,
    152,
    32,
    42,
    255,
    110,
    118,
    197,
    0,
    241,
    182,
    2,
    0,
    139,
    161,
    185,
    0,
    59,
    105,
    219,
    255,
    106,
    150,
    68,
    255,
    14,
    218,
    148,
    255,
    157,
    95,
    151,
    0,
    218,
    61,
    209,
    255,
    245,
    119,
    21,
    254,
    174,
    172,
    44,
    0,
    116,
    174,
    85,
    1,
    121,
    94,
    29,
    255,
    231,
    128,
    41,
    0,
    197,
    70,
    250,
    0,
    159,
    146,
    145,
    255,
    80,
    212,
    183,
    255,
    2,
    252,
    40,
    0,
    129,
    111,
    156,
    255,
    238,
    21,
    142,
    254,
    141,
    197,
    12,
    255,
    199,
    206,
    160,
    255,
    39,
    227,
    214,
    0,
    181,
    80,
    153,
    0,
    93,
    150,
    186,
    0,
    156,
    172,
    46,
    254,
    191,
    65,
    59,
    255,
    83,
    177,
    85,
    255,
    205,
    1,
    54,
    0,
    128,
    124,
    80,
    255,
    60,
    164,
    251,
    0,
    242,
    162,
    95,
    254,
    254,
    166,
    26,
    255,
    89,
    6,
    145,
    255,
    9,
    220,
    12,
    255,
    238,
    84,
    13,
    1,
    153,
    226,
    8,
    0,
    4,
    223,
    242,
    255,
    159,
    34,
    253,
    255,
    60,
    200,
    71,
    255,
    1,
    252,
    92,
    255,
    131,
    114,
    201,
    254,
    208,
    100,
    237,
    0,
    115,
    224,
    37,
    254,
    75,
    106,
    179,
    255,
    144,
    30,
    160,
    255,
    134,
    132,
    221,
    255,
    57,
    173,
    184,
    255,
    63,
    211,
    185,
    255,
    104,
    154,
    193,
    255,
    232,
    192,
    189,
    0,
    33,
    187,
    34,
    254,
    155,
    45,
    16,
    0,
    47,
    118,
    95,
    0,
    86,
    236,
    159,
    0,
    78,
    88,
    44,
    255,
    60,
    235,
    30,
    0,
    20,
    102,
    177,
    254,
    155,
    42,
    214,
    255,
    248,
    70,
    219,
    255,
    84,
    101,
    133,
    255,
    126,
    60,
    112,
    0,
    252,
    18,
    240,
    0,
    106,
    64,
    155,
    254,
    107,
    70,
    114,
    0,
    31,
    8,
    105,
    0,
    100,
    155,
    10,
    0,
    235,
    244,
    97,
    1,
    170,
    40,
    147,
    0,
    170,
    227,
    1,
    254,
    136,
    66,
    173,
    0,
    50,
    197,
    204,
    254,
    89,
    122,
    97,
    0,
    95,
    232,
    129,
    255,
    114,
    108,
    126,
    255,
    178,
    66,
    138,
    255,
    169,
    101,
    48,
    255,
    226,
    198,
    47,
    255,
    38,
    46,
    225,
    0,
    65,
    131,
    215,
    254,
    236,
    157,
    27,
    255,
    236,
    18,
    158,
    0,
    42,
    62,
    87,
    255,
    101,
    75,
    177,
    254,
    171,
    93,
    184,
    0,
    159,
    73,
    84,
    255,
    246,
    182,
    12,
    255,
    64,
    77,
    153,
    0,
    229,
    158,
    82,
    0,
    67,
    10,
    123,
    1,
    167,
    101,
    123,
    0,
    170,
    216,
    153,
    255,
    179,
    149,
    150,
    0,
    132,
    189,
    241,
    0,
    237,
    109,
    8,
    255,
    231,
    21,
    147,
    0,
    139,
    56,
    180,
    0,
    158,
    171,
    145,
    254,
    138,
    201,
    113,
    255,
    233,
    180,
    59,
    0,
    65,
    152,
    105,
    255,
    29,
    51,
    15,
    0,
    157,
    210,
    122,
    255,
    110,
    231,
    119,
    255,
    166,
    228,
    40,
    255,
    227,
    155,
    110,
    0,
    212,
    197,
    220,
    0,
    92,
    245,
    128,
    1,
    101,
    204,
    121,
    255,
    99,
    232,
    218,
    0,
    22,
    128,
    125,
    0,
    203,
    122,
    97,
    0,
    205,
    108,
    146,
    255,
    122,
    178,
    98,
    0,
    113,
    238,
    122,
    255,
    27,
    182,
    236,
    0,
    247,
    148,
    235,
    0,
    242,
    8,
    112,
    0,
    178,
    2,
    101,
    255,
    46,
    189,
    18,
    1,
    79,
    34,
    145,
    255,
    255,
    91,
    33,
    0,
    160,
    136,
    74,
    0,
    71,
    51,
    165,
    0,
    37,
    226,
    108,
    0,
    178,
    66,
    39,
    255,
    128,
    213,
    80,
    0,
    82,
    140,
    166,
    255,
    58,
    95,
    164,
    255,
    91,
    181,
    172,
    1,
    69,
    163,
    64,
    0,
    74,
    70,
    39,
    255,
    236,
    226,
    29,
    0,
    21,
    101,
    255,
    254,
    219,
    140,
    58,
    0,
    2,
    232,
    171,
    255,
    50,
    240,
    54,
    255,
    9,
    133,
    60,
    254,
    9,
    73,
    188,
    0,
    62,
    218,
    233,
    0,
    214,
    175,
    12,
    255,
    127,
    133,
    121,
    255,
    92,
    1,
    169,
    0,
    14,
    206,
    212,
    254,
    229,
    96,
    198,
    255,
    160,
    244,
    178,
    0,
    84,
    136,
    146,
    0,
    131,
    59,
    185,
    255,
    89,
    15,
    175,
    255,
    217,
    142,
    136,
    255,
    84,
    148,
    41,
    0,
    95,
    160,
    220,
    1,
    145,
    66,
    0,
    255,
    248,
    22,
    145,
    255,
    156,
    211,
    225,
    0,
    80,
    229,
    71,
    254,
    188,
    220,
    73,
    0,
    182,
    41,
    72,
    255,
    112,
    31,
    117,
    255,
    168,
    241,
    233,
    255,
    209,
    211,
    5,
    0,
    186,
    83,
    39,
    254,
    131,
    223,
    3,
    255,
    44,
    177,
    19,
    0,
    151,
    74,
    195,
    0,
    99,
    193,
    159,
    1,
    238,
    131,
    98,
    255,
    162,
    181,
    225,
    0,
    96,
    117,
    34,
    255,
    54,
    231,
    80,
    0,
    88,
    139,
    122,
    255,
    58,
    15,
    204,
    255,
    123,
    174,
    192,
    255,
    35,
    20,
    99,
    254,
    145,
    6,
    164,
    0,
    23,
    52,
    134,
    1,
    96,
    82,
    160,
    255,
    51,
    187,
    21,
    255,
    56,
    184,
    244,
    0,
    180,
    125,
    17,
    0,
    198,
    125,
    0,
    0,
    114,
    98,
    102,
    1,
    205,
    67,
    146,
    0,
    75,
    29,
    121,
    1,
    231,
    91,
    234,
    255,
    217,
    206,
    46,
    1,
    12,
    78,
    4,
    0,
    213,
    179,
    243,
    254,
    115,
    232,
    167,
    0,
    83,
    167,
    23,
    254,
    125,
    142,
    214,
    255,
    18,
    40,
    93,
    0,
    97,
    228,
    229,
    255,
    132,
    105,
    191,
    254,
    141,
    201,
    218,
    0,
    113,
    125,
    122,
    0,
    126,
    252,
    124,
    0,
    53,
    163,
    229,
    254,
    135,
    197,
    67,
    255,
    246,
    29,
    128,
    1,
    191,
    155,
    165,
    255,
    129,
    176,
    235,
    0,
    36,
    49,
    114,
    0,
    7,
    132,
    47,
    254,
    20,
    186,
    152,
    0,
    83,
    82,
    40,
    255,
    181,
    77,
    192,
    255,
    185,
    89,
    156,
    0,
    9,
    10,
    32,
    255,
    159,
    252,
    255,
    1,
    249,
    45,
    42,
    255,
    238,
    137,
    100,
    1,
    83,
    28,
    230,
    0,
    56,
    99,
    134,
    255,
    113,
    239,
    116,
    0,
    143,
    100,
    248,
    1,
    99,
    96,
    188,
    255,
    197,
    9,
    248,
    255,
    213,
    136,
    101,
    0,
    115,
    132,
    14,
    0,
    160,
    97,
    160,
    255,
    20,
    75,
    177,
    255,
    157,
    190,
    106,
    0,
    62,
    164,
    173,
    255,
    245,
    105,
    149,
    255,
    238,
    63,
    61,
    0,
    55,
    79,
    106,
    0,
    112,
    59,
    73,
    255,
    194,
    108,
    60,
    0,
    197,
    25,
    122,
    0,
    62,
    72,
    78,
    0,
    196,
    30,
    223,
    255,
    174,
    3,
    227,
    255,
    195,
    105,
    24,
    254,
    104,
    52,
    9,
    255,
    141,
    73,
    248,
    0,
    236,
    107,
    115,
    255,
    154,
    12,
    107,
    1,
    94,
    41,
    11,
    0,
    75,
    50,
    118,
    254,
    228,
    226,
    201,
    255,
    120,
    68,
    106,
    0,
    154,
    64,
    183,
    255,
    81,
    125,
    167,
    0,
    197,
    92,
    153,
    0,
    143,
    166,
    38,
    0,
    73,
    144,
    190,
    255,
    200,
    166,
    138,
    254,
    179,
    251,
    66,
    255,
    189,
    196,
    50,
    255,
    200,
    229,
    221,
    0,
    13,
    122,
    196,
    0,
    159,
    255,
    211,
    0,
    116,
    234,
    229,
    0,
    104,
    37,
    131,
    0,
    29,
    76,
    50,
    1,
    59,
    163,
    78,
    255,
    207,
    76,
    48,
    0,
    134,
    206,
    55,
    255,
    0,
    62,
    201,
    0,
    240,
    231,
    79,
    255,
    51,
    242,
    91,
    255,
    81,
    69,
    50,
    255,
    74,
    125,
    195,
    1,
    47,
    135,
    33,
    0,
    78,
    117,
    239,
    255,
    141,
    137,
    180,
    0,
    181,
    9,
    92,
    0,
    132,
    148,
    214,
    0,
    12,
    11,
    225,
    0,
    38,
    125,
    131,
    255,
    160,
    207,
    195,
    254,
    84,
    45,
    179,
    0,
    2,
    166,
    222,
    1,
    240,
    210,
    200,
    0,
    108,
    73,
    31,
    0,
    11,
    119,
    157,
    255,
    127,
    200,
    233,
    0,
    16,
    119,
    80,
    0,
    148,
    219,
    132,
    1,
    174,
    230,
    1,
    0,
    228,
    122,
    234,
    254,
    89,
    180,
    147,
    255,
    219,
    228,
    153,
    255,
    8,
    38,
    33,
    255,
    20,
    165,
    151,
    0,
    201,
    0,
    33,
    0,
    6,
    9,
    162,
    255,
    112,
    227,
    229,
    255,
    148,
    74,
    65,
    0,
    125,
    89,
    216,
    255,
    128,
    24,
    163,
    254,
    12,
    158,
    146,
    255,
    160,
    219,
    140,
    254,
    5,
    60,
    179,
    0,
    72,
    192,
    165,
    254,
    252,
    72,
    38,
    255,
    173,
    6,
    91,
    0,
    157,
    45,
    143,
    0,
    45,
    242,
    55,
    1,
    240,
    83,
    89,
    0,
    55,
    18,
    175,
    1,
    77,
    234,
    234,
    255,
    114,
    163,
    90,
    255,
    58,
    81,
    209,
    0,
    86,
    94,
    126,
    255,
    42,
    249,
    249,
    0,
    84,
    180,
    145,
    0,
    253,
    35,
    180,
    255,
    221,
    117,
    187,
    255,
    61,
    117,
    196,
    255,
    112,
    85,
    94,
    0,
    33,
    49,
    60,
    255,
    241,
    79,
    150,
    1,
    16,
    159,
    158,
    0,
    24,
    2,
    161,
    1,
    89,
    23,
    14,
    255,
    180,
    187,
    117,
    0,
    134,
    4,
    133,
    0,
    226,
    97,
    115,
    255,
    248,
    181,
    32,
    255,
    234,
    59,
    186,
    1,
    194,
    129,
    169,
    255,
    44,
    130,
    64,
    0,
    228,
    177,
    3,
    0,
    57,
    93,
    53,
    255,
    40,
    33,
    134,
    255,
    144,
    169,
    147,
    255,
    52,
    188,
    133,
    0,
    170,
    202,
    95,
    254,
    143,
    64,
    47,
    0,
    83,
    219,
    196,
    1,
    205,
    131,
    116,
    255,
    149,
    156,
    59,
    0,
    218,
    229,
    171,
    0,
    205,
    219,
    181,
    0,
    184,
    90,
    239,
    0,
    117,
    11,
    241,
    254,
    108,
    214,
    84,
    255,
    217,
    162,
    91,
    254,
    173,
    13,
    74,
    0,
    197,
    111,
    97,
    254,
    63,
    223,
    103,
    0,
    141,
    219,
    104,
    0,
    223,
    149,
    239,
    255,
    142,
    116,
    69,
    254,
    67,
    98,
    213,
    0,
    124,
    78,
    98,
    254,
    158,
    152,
    214,
    255,
    95,
    226,
    172,
    1,
    229,
    146,
    53,
    255,
    118,
    235,
    93,
    0,
    146,
    122,
    230,
    0,
    39,
    255,
    53,
    0,
    68,
    89,
    141,
    255,
    118,
    50,
    215,
    0,
    121,
    106,
    171,
    0,
    43,
    240,
    5,
    254,
    106,
    153,
    141,
    0,
    8,
    61,
    217,
    1,
    242,
    37,
    66,
    0,
    160,
    27,
    228,
    255,
    103,
    13,
    70,
    0,
    137,
    6,
    213,
    0,
    0,
    32,
    195,
    0,
    206,
    106,
    22,
    0,
    39,
    153,
    0,
    255,
    88,
    211,
    253,
    1,
    40,
    192,
    212,
    0,
    142,
    123,
    123,
    0,
    16,
    14,
    122,
    255,
    119,
    162,
    85,
    255,
    146,
    240,
    21,
    0,
    208,
    166,
    87,
    1,
    6,
    98,
    213,
    255,
    129,
    103,
    222,
    1,
    72,
    165,
    182,
    255,
    60,
    137,
    125,
    254,
    79,
    118,
    60,
    0,
    126,
    94,
    191,
    0,
    157,
    146,
    112,
    255,
    99,
    132,
    93,
    254,
    146,
    136,
    121,
    0,
    147,
    98,
    148,
    254,
    167,
    141,
    84,
    0,
    75,
    92,
    119,
    254,
    9,
    64,
    151,
    255,
    24,
    232,
    107,
    1,
    163,
    96,
    46,
    0,
    38,
    108,
    116,
    255,
    160,
    230,
    91,
    0,
    43,
    148,
    93,
    254,
    185,
    151,
    161,
    0,
    219,
    50,
    130,
    1,
    218,
    209,
    231,
    255,
    48,
    202,
    161,
    254,
    116,
    10,
    77,
    0,
    73,
    38,
    219,
    1,
    148,
    24,
    253,
    255,
    81,
    206,
    213,
    254,
    122,
    113,
    246,
    255,
    31,
    46,
    245,
    254,
    75,
    12,
    4,
    255,
    15,
    90,
    224,
    254,
    204,
    220,
    57,
    255,
    102,
    56,
    108,
    255,
    154,
    6,
    224,
    0,
    16,
    52,
    209,
    1,
    139,
    195,
    117,
    0,
    115,
    192,
    90,
    255,
    33,
    243,
    146,
    0,
    117,
    50,
    206,
    1,
    88,
    77,
    95,
    255,
    46,
    210,
    87,
    254,
    167,
    59,
    45,
    255,
    251,
    236,
    88,
    0,
    83,
    159,
    245,
    0,
    177,
    35,
    138,
    254,
    155,
    140,
    184,
    0,
    212,
    32,
    113,
    0,
    47,
    171,
    174,
    0,
    207,
    31,
    172,
    1,
    61,
    160,
    228,
    255,
    235,
    129,
    41,
    255,
    144,
    132,
    66,
    0,
    239,
    168,
    145,
    1,
    188,
    190,
    35,
    0,
    207,
    4,
    178,
    254,
    50,
    57,
    231,
    255,
    52,
    127,
    163,
    255,
    210,
    38,
    32,
    0,
    85,
    177,
    73,
    254,
    176,
    226,
    137,
    0,
    209,
    165,
    212,
    254,
    43,
    203,
    56,
    255,
    80,
    219,
    58,
    254,
    86,
    71,
    226,
    0,
    147,
    221,
    185,
    255,
    57,
    251,
    216,
    0,
    199,
    226,
    53,
    254,
    125,
    25,
    45,
    0,
    148,
    138,
    184,
    0,
    44,
    13,
    47,
    255,
    59,
    87,
    165,
    255,
    145,
    137,
    107,
    0,
    71,
    36,
    207,
    255,
    212,
    237,
    219,
    0,
    44,
    1,
    72,
    255,
    203,
    124,
    5,
    255,
    121,
    32,
    118,
    255,
    184,
    194,
    145,
    255,
    176,
    68,
    141,
    0,
    196,
    89,
    21,
    0,
    144,
    212,
    207,
    1,
    102,
    66,
    169,
    255,
    182,
    120,
    89,
    255,
    133,
    114,
    211,
    0,
    189,
    110,
    21,
    255,
    15,
    10,
    106,
    0,
    41,
    192,
    1,
    0,
    152,
    232,
    121,
    255,
    188,
    60,
    160,
    255,
    153,
    113,
    206,
    255,
    0,
    183,
    226,
    254,
    180,
    13,
    72,
    255,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    237,
    211,
    245,
    92,
    26,
    99,
    18,
    88,
    214,
    156,
    247,
    162,
    222,
    249,
    222,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    16,
    133,
    59,
    140,
    1,
    189,
    241,
    36,
    255,
    248,
    37,
    195,
    1,
    96,
    220,
    55,
    0,
    183,
    76,
    62,
    255,
    195,
    66,
    61,
    0,
    50,
    76,
    164,
    1,
    225,
    164,
    76,
    255,
    76,
    61,
    163,
    255,
    117,
    62,
    31,
    0,
    81,
    145,
    64,
    255,
    118,
    65,
    14,
    0,
    162,
    115,
    214,
    255,
    6,
    138,
    46,
    0,
    124,
    230,
    244,
    255,
    10,
    138,
    143,
    0,
    52,
    26,
    194,
    0,
    184,
    244,
    76,
    0,
    129,
    143,
    41,
    1,
    190,
    244,
    19,
    255,
    123,
    170,
    122,
    255,
    98,
    129,
    68,
    0,
    121,
    213,
    147,
    0,
    86,
    101,
    30,
    255,
    161,
    103,
    155,
    0,
    140,
    89,
    67,
    255,
    239,
    229,
    190,
    1,
    67,
    11,
    181,
    0,
    198,
    240,
    137,
    254,
    238,
    69,
    188,
    255,
    67,
    151,
    238,
    0,
    19,
    42,
    108,
    255,
    229,
    85,
    113,
    1,
    50,
    68,
    135,
    255,
    17,
    106,
    9,
    0,
    50,
    103,
    1,
    255,
    80,
    1,
    168,
    1,
    35,
    152,
    30,
    255,
    16,
    168,
    185,
    1,
    56,
    89,
    232,
    255,
    101,
    210,
    252,
    0,
    41,
    250,
    71,
    0,
    204,
    170,
    79,
    255,
    14,
    46,
    239,
    255,
    80,
    77,
    239,
    0,
    189,
    214,
    75,
    255,
    17,
    141,
    249,
    0,
    38,
    80,
    76,
    255,
    190,
    85,
    117,
    0,
    86,
    228,
    170,
    0,
    156,
    216,
    208,
    1,
    195,
    207,
    164,
    255,
    150,
    66,
    76,
    255,
    175,
    225,
    16,
    255,
    141,
    80,
    98,
    1,
    76,
    219,
    242,
    0,
    198,
    162,
    114,
    0,
    46,
    218,
    152,
    0,
    155,
    43,
    241,
    254,
    155,
    160,
    104,
    255,
    51,
    187,
    165,
    0,
    2,
    17,
    175,
    0,
    66,
    84,
    160,
    1,
    247,
    58,
    30,
    0,
    35,
    65,
    53,
    254,
    69,
    236,
    191,
    0,
    45,
    134,
    245,
    1,
    163,
    123,
    221,
    0,
    32,
    110,
    20,
    255,
    52,
    23,
    165,
    0,
    186,
    214,
    71,
    0,
    233,
    176,
    96,
    0,
    242,
    239,
    54,
    1,
    57,
    89,
    138,
    0,
    83,
    0,
    84,
    255,
    136,
    160,
    100,
    0,
    92,
    142,
    120,
    254,
    104,
    124,
    190,
    0,
    181,
    177,
    62,
    255,
    250,
    41,
    85,
    0,
    152,
    130,
    42,
    1,
    96,
    252,
    246,
    0,
    151,
    151,
    63,
    254,
    239,
    133,
    62,
    0,
    32,
    56,
    156,
    0,
    45,
    167,
    189,
    255,
    142,
    133,
    179,
    1,
    131,
    86,
    211,
    0,
    187,
    179,
    150,
    254,
    250,
    170,
    14,
    255,
    210,
    163,
    78,
    0,
    37,
    52,
    151,
    0,
    99,
    77,
    26,
    0,
    238,
    156,
    213,
    255,
    213,
    192,
    209,
    1,
    73,
    46,
    84,
    0,
    20,
    65,
    41,
    1,
    54,
    206,
    79,
    0,
    201,
    131,
    146,
    254,
    170,
    111,
    24,
    255,
    177,
    33,
    50,
    254,
    171,
    38,
    203,
    255,
    78,
    247,
    116,
    0,
    209,
    221,
    153,
    0,
    133,
    128,
    178,
    1,
    58,
    44,
    25,
    0,
    201,
    39,
    59,
    1,
    189,
    19,
    252,
    0,
    49,
    229,
    210,
    1,
    117,
    187,
    117,
    0,
    181,
    179,
    184,
    1,
    0,
    114,
    219,
    0,
    48,
    94,
    147,
    0,
    245,
    41,
    56,
    0,
    125,
    13,
    204,
    254,
    244,
    173,
    119,
    0,
    44,
    221,
    32,
    254,
    84,
    234,
    20,
    0,
    249,
    160,
    198,
    1,
    236,
    126,
    234,
    255,
    47,
    99,
    168,
    254,
    170,
    226,
    153,
    255,
    102,
    179,
    216,
    0,
    226,
    141,
    122,
    255,
    122,
    66,
    153,
    254,
    182,
    245,
    134,
    0,
    227,
    228,
    25,
    1,
    214,
    57,
    235,
    255,
    216,
    173,
    56,
    255,
    181,
    231,
    210,
    0,
    119,
    128,
    157,
    255,
    129,
    95,
    136,
    255,
    110,
    126,
    51,
    0,
    2,
    169,
    183,
    255,
    7,
    130,
    98,
    254,
    69,
    176,
    94,
    255,
    116,
    4,
    227,
    1,
    217,
    242,
    145,
    255,
    202,
    173,
    31,
    1,
    105,
    1,
    39,
    255,
    46,
    175,
    69,
    0,
    228,
    47,
    58,
    255,
    215,
    224,
    69,
    254,
    207,
    56,
    69,
    255,
    16,
    254,
    139,
    255,
    23,
    207,
    212,
    255,
    202,
    20,
    126,
    255,
    95,
    213,
    96,
    255,
    9,
    176,
    33,
    0,
    200,
    5,
    207,
    255,
    241,
    42,
    128,
    254,
    35,
    33,
    192,
    255,
    248,
    229,
    196,
    1,
    129,
    17,
    120,
    0,
    251,
    103,
    151,
    255,
    7,
    52,
    112,
    255,
    140,
    56,
    66,
    255,
    40,
    226,
    245,
    255,
    217,
    70,
    37,
    254,
    172,
    214,
    9,
    255,
    72,
    67,
    134,
    1,
    146,
    192,
    214,
    255,
    44,
    38,
    112,
    0,
    68,
    184,
    75,
    255,
    206,
    90,
    251,
    0,
    149,
    235,
    141,
    0,
    181,
    170,
    58,
    0,
    116,
    244,
    239,
    0,
    92,
    157,
    2,
    0,
    102,
    173,
    98,
    0,
    233,
    137,
    96,
    1,
    127,
    49,
    203,
    0,
    5,
    155,
    148,
    0,
    23,
    148,
    9,
    255,
    211,
    122,
    12,
    0,
    34,
    134,
    26,
    255,
    219,
    204,
    136,
    0,
    134,
    8,
    41,
    255,
    224,
    83,
    43,
    254,
    85,
    25,
    247,
    0,
    109,
    127,
    0,
    254,
    169,
    136,
    48,
    0,
    238,
    119,
    219,
    255,
    231,
    173,
    213,
    0,
    206,
    18,
    254,
    254,
    8,
    186,
    7,
    255,
    126,
    9,
    7,
    1,
    111,
    42,
    72,
    0,
    111,
    52,
    236,
    254,
    96,
    63,
    141,
    0,
    147,
    191,
    127,
    254,
    205,
    78,
    192,
    255,
    14,
    106,
    237,
    1,
    187,
    219,
    76,
    0,
    175,
    243,
    187,
    254,
    105,
    89,
    173,
    0,
    85,
    25,
    89,
    1,
    162,
    243,
    148,
    0,
    2,
    118,
    209,
    254,
    33,
    158,
    9,
    0,
    139,
    163,
    46,
    255,
    93,
    70,
    40,
    0,
    108,
    42,
    142,
    254,
    111,
    252,
    142,
    255,
    155,
    223,
    144,
    0,
    51,
    229,
    167,
    255,
    73,
    252,
    155,
    255,
    94,
    116,
    12,
    255,
    152,
    160,
    218,
    255,
    156,
    238,
    37,
    255,
    179,
    234,
    207,
    255,
    197,
    0,
    179,
    255,
    154,
    164,
    141,
    0,
    225,
    196,
    104,
    0,
    10,
    35,
    25,
    254,
    209,
    212,
    242,
    255,
    97,
    253,
    222,
    254,
    184,
    101,
    229,
    0,
    222,
    18,
    127,
    1,
    164,
    136,
    135,
    255,
    30,
    207,
    140,
    254,
    146,
    97,
    243,
    0,
    129,
    192,
    26,
    254,
    201,
    84,
    33,
    255,
    111,
    10,
    78,
    255,
    147,
    81,
    178,
    255,
    4,
    4,
    24,
    0,
    161,
    238,
    215,
    255,
    6,
    141,
    33,
    0,
    53,
    215,
    14,
    255,
    41,
    181,
    208,
    255,
    231,
    139,
    157,
    0,
    179,
    203,
    221,
    255,
    255,
    185,
    113,
    0,
    189,
    226,
    172,
    255,
    113,
    66,
    214,
    255,
    202,
    62,
    45,
    255,
    102,
    64,
    8,
    255,
    78,
    174,
    16,
    254,
    133,
    117,
    68,
    255,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    36,
    28,
    194,
    0,
    201,
    13,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    6,
    109,
    7,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    27,
    19,
    44,
    10,
    163,
    229,
    156,
    237,
    167,
    41,
    99,
    8,
    93,
    33,
    6,
    33,
    235,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    27,
    126,
    84,
    18,
    163,
    29,
    181,
    210,
    255,
    132,
    186,
    253,
    242,
    6,
    162,
    177,
    234,
    107,
    163,
    255,
    56,
    84,
    231,
    20,
    54,
    24,
    233,
    111,
    242,
    198,
    182,
    157,
    8,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    32,
    0,
    0,
    0,
    40,
    0,
    0,
    0,
    48,
    0,
    0,
    0,
    64,
    0,
    0,
    0,
    80,
    0,
    0,
    0,
    128,
    0,
    0,
    0,
    0,
    1,
    0,
    0
]);
Promise.resolve();
const instance = new WebAssembly.Instance(new WebAssembly.Module(WASM_BIN), {});
const wasm1 = instance.exports;
let allocPtr = 0, allocSize = 0;
function alloc(size) {
    if (allocSize < size) {
        if (allocPtr) wasm1.free(allocPtr);
        allocPtr = wasm1.malloc(size);
        allocSize = size;
    }
    return allocPtr;
}
function write(value, ptr, size = value.length) {
    const buf = new Uint8Array(wasm1.memory.buffer, ptr, size);
    buf.set(value);
}
function read(ptr, size) {
    return new Uint8Array(wasm1.memory.buffer, ptr, size).slice(0, size);
}
function crypto_key_exchange(your_secret_key, their_public_key) {
    const ptr = alloc(32 * 3);
    if (your_secret_key) write(your_secret_key, ptr + 32);
    if (their_public_key) write(their_public_key, ptr + 32 * 2);
    wasm1.crypto_key_exchange(ptr, your_secret_key ? ptr + 32 : 0, their_public_key ? ptr + 32 * 2 : 0);
    return read(ptr, 32);
}
function crypto_key_exchange_public_key(your_secret_key) {
    return crypto_x25519_public_key(your_secret_key);
}
function crypto_lock(key, nonce, plain_text) {
    const textLength = plain_text ? plain_text.length : 0;
    const ptr = alloc(16 + textLength + 32 + 24);
    if (plain_text) write(plain_text, ptr + 16);
    if (key) write(key, ptr + 16 + textLength);
    if (nonce) write(nonce, ptr + 16 + textLength + 32);
    wasm1.crypto_lock(ptr, ptr + 16, key ? ptr + 16 + textLength : 0, nonce ? ptr + 16 + textLength + 32 : 0, ptr + 16, textLength);
    wasm1.crypto_wipe(ptr + 16 + textLength, 32);
    return read(ptr, 16 + textLength);
}
function crypto_unlock(key, nonce, cipher_text) {
    if (!cipher_text || cipher_text.length < 16) return null;
    const textLength = cipher_text.length - 16;
    const ptr = alloc(16 + textLength + 32 + 24);
    write(cipher_text, ptr);
    if (key) write(key, ptr + 16 + textLength);
    if (nonce) write(nonce, ptr + 16 + textLength + 32);
    const success = wasm1.crypto_unlock(ptr + 16, key ? ptr + 16 + textLength : 0, nonce ? ptr + 16 + textLength + 32 : 0, ptr, ptr + 16, textLength) === 0;
    wasm1.crypto_wipe(ptr + 16 + textLength, 32);
    return success ? read(ptr + 16, textLength) : null;
}
function crypto_x25519_public_key(secret_key) {
    const ptr = alloc(32 * 2);
    if (secret_key) write(secret_key, ptr + 32);
    wasm1.crypto_x25519_public_key(ptr, secret_key ? ptr + 32 : 0);
    wasm1.crypto_wipe(ptr + 32, 32);
    return read(ptr, 32);
}
const importMeta = {
    url: "file:///home/hortinstein/enkodo/typescript/main.ts",
    main: import.meta.main
};
const require = createRequire(importMeta.url);
const serialize = require("./serialize.js");
function splitMAC(encBuffer) {
    return [
        encBuffer.slice(0, MAC_LEN),
        encBuffer.slice(MAC_LEN)
    ];
}
function randomBytes1(n) {
    const buf = new Uint8Array(n);
    return crypto.getRandomValues(buf);
}
const MAC_LEN = 16;
function enc(privateKey, publicKey, data) {
    const sharedKey = crypto_key_exchange(privateKey, publicKey);
    const nonce = randomBytes1(24);
    const maccipher = crypto_lock(sharedKey, nonce, data);
    const [mac, cipher] = splitMAC(maccipher);
    const myPubKey = crypto_key_exchange_public_key(privateKey);
    return serialize.returnEncObj(myPubKey, nonce, mac, cipher.length, cipher);
}
function dec(privateKey, encObj) {
    const sharedKey = crypto_key_exchange(privateKey, encObj.publicKey);
    const mac = new Uint8Array(encObj.mac);
    const cipher = new Uint8Array(encObj.cipherText);
    const maccipher = new Uint8Array([
        ...mac,
        ...cipher
    ]);
    const plain = crypto_unlock(sharedKey, encObj.nonce, maccipher);
    return plain;
}
function generateKeyPair() {
    const privateKey = randomBytes1(32);
    const publicKey = crypto_key_exchange_public_key(privateKey);
    return [
        privateKey,
        publicKey
    ];
}
function wrap(obj) {
    return serialize.wrap(obj);
}
function unwrap(wrappedObj) {
    return serialize.unwrap(wrappedObj);
}
export { enc as enc };
export { dec as dec };
export { generateKeyPair as generateKeyPair };
export { wrap as wrap };
export { unwrap as unwrap };

