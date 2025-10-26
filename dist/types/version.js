"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVersion = isVersion;
exports.toVersion = toVersion;
function isVersion(value) {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(value);
}
function toVersion(value) {
    if (!isVersion(value)) {
        throw new Error(`Invalid version format: ${value}`);
    }
    return value;
}
//# sourceMappingURL=version.js.map