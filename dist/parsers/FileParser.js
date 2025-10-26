"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAME_PATTERNS = exports.VERSION_PATTERNS = void 0;
exports.parseJsonFile = parseJsonFile;
exports.parseTomlFile = parseTomlFile;
exports.parseRegexFile = parseRegexFile;
exports.configParser = configParser;
const fs = __importStar(require("node:fs/promises"));
const toml = __importStar(require("@iarna/toml"));
const result_js_1 = require("../types/result.js");
const version_js_1 = require("../types/version.js");
const errors_js_1 = require("../utils/errors.js");
async function parseJsonFile(filePath, versionPath = 'version', namePath = 'name') {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const version = getNestedValue(data, versionPath);
        if (!version || typeof version !== 'string') {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Version field '${versionPath}' not found or not a string`));
        }
        if (!(0, version_js_1.isVersion)(version)) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Invalid version format: ${version}`));
        }
        const name = getNestedValue(data, namePath);
        if (!name || typeof name !== 'string') {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Name field '${namePath}' not found or not a string`));
        }
        return (0, result_js_1.ok)({
            name,
            version: (0, version_js_1.toVersion)(version),
        });
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', 'Invalid JSON syntax', error));
        }
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', error instanceof Error ? error.message : String(error), error));
    }
}
async function parseTomlFile(filePath, versionPath = 'version', namePath = 'name') {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = toml.parse(content);
        const version = getNestedValue(data, versionPath);
        if (!version || typeof version !== 'string') {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Version field '${versionPath}' not found or not a string`));
        }
        if (!(0, version_js_1.isVersion)(version)) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Invalid version format: ${version}`));
        }
        const name = getNestedValue(data, namePath);
        if (!name || typeof name !== 'string') {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Name field '${namePath}' not found or not a string`));
        }
        return (0, result_js_1.ok)({
            name,
            version: (0, version_js_1.toVersion)(version),
        });
    }
    catch (error) {
        if (error instanceof Error && (error.message.includes('row') || error.message.includes('Unexpected character'))) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', 'Invalid TOML syntax', error));
        }
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', error instanceof Error ? error.message : String(error), error));
    }
}
async function parseRegexFile(filePath, versionPattern, namePattern, defaultName) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const versionMatch = content.match(versionPattern);
        if (!versionMatch || !versionMatch[1]) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', 'Version pattern did not match'));
        }
        const version = versionMatch[1];
        if (!(0, version_js_1.isVersion)(version)) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Invalid version format: ${version}`));
        }
        let name = defaultName || '';
        if (namePattern) {
            const nameMatch = content.match(namePattern);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1];
            }
        }
        if (!name) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', 'Name pattern did not match and no default provided'));
        }
        return (0, result_js_1.ok)({
            name,
            version: (0, version_js_1.toVersion)(version),
        });
    }
    catch (error) {
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', error instanceof Error ? error.message : String(error), error));
    }
}
async function configParser(filePath, config) {
    switch (config.format) {
        case 'json':
            return parseJsonFile(filePath, config.versionPath || 'version', config.namePath || 'name');
        case 'toml':
            return parseTomlFile(filePath, config.versionPath || 'version', config.namePath || 'name');
        case 'regex':
            if (!config.versionPattern) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', 'versionPattern is required for regex format'));
            }
            return parseRegexFile(filePath, config.versionPattern, config.namePattern, '');
        default:
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'parse', `Unsupported format: ${config.format}`));
    }
}
function getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== 'object') {
            return undefined;
        }
        current = current[key];
    }
    return current;
}
exports.VERSION_PATTERNS = {
    PYTHON_SETUP: /version\s*=\s*['"]([^'"]+)['"]/,
    PYTHON_INIT: /__version__\s*=\s*['"]([^'"]+)['"]/,
    PYTHON_SETUP_CFG: /^\s*version\s*=\s*(.+)$/m,
    GO_VERSION_COMMENT: /\/\/\s*version:\s*(.+)$/m,
    GENERIC: /^(.+)$/,
};
exports.NAME_PATTERNS = {
    PYTHON_SETUP: /name\s*=\s*['"]([^'"]+)['"]/,
    PYTHON_SETUP_CFG: /^\s*name\s*=\s*(.+)$/m,
};
//# sourceMappingURL=FileParser.js.map