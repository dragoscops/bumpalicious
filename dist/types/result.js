"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.err = err;
exports.isOk = isOk;
exports.isErr = isErr;
exports.unwrap = unwrap;
exports.unwrapOr = unwrapOr;
function ok(value) {
    return { ok: true, value };
}
function err(error) {
    return { ok: false, error };
}
function isOk(result) {
    return result.ok === true;
}
function isErr(result) {
    return result.ok === false;
}
function unwrap(result) {
    if (isOk(result)) {
        return result.value;
    }
    throw result.error;
}
function unwrapOr(result, defaultValue) {
    if (isOk(result)) {
        return result.value;
    }
    return defaultValue;
}
//# sourceMappingURL=result.js.map