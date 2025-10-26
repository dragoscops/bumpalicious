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
exports.updateJsonFile = updateJsonFile;
exports.updateTomlFile = updateTomlFile;
exports.updateRegexFile = updateRegexFile;
exports.configUpdater = configUpdater;
const fs = __importStar(require("node:fs/promises"));
const toml = __importStar(require("@iarna/toml"));
const FileParser_js_1 = require("./FileParser.js");
const result_js_1 = require("../types/result.js");
const version_js_1 = require("../types/version.js");
const errors_js_1 = require("../utils/errors.js");
async function updateJsonFile(filePath, newVersion, versionPath = 'version') {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const currentVersion = getNestedValue(data, versionPath);
        if (!currentVersion || typeof currentVersion !== 'string') {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Version field '${versionPath}' not found in file`));
        }
        if (!(0, version_js_1.isVersion)(currentVersion)) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Invalid existing version format: ${currentVersion}`));
        }
        const updated = setNestedValue(data, versionPath, newVersion);
        if (!updated) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Failed to set version at path '${versionPath}'`));
        }
        const newContent = JSON.stringify(data, null, 2) + '\n';
        await fs.writeFile(filePath, newContent, 'utf-8');
        return (0, result_js_1.ok)(undefined);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Invalid JSON syntax', error));
        }
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', error instanceof Error ? error.message : String(error), error));
    }
}
async function updateTomlFile(filePath, newVersion, versionPath = 'version') {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = toml.parse(content);
        const currentVersion = getNestedValue(data, versionPath);
        if (!currentVersion || typeof currentVersion !== 'string') {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Version field '${versionPath}' not found in file`));
        }
        if (!(0, version_js_1.isVersion)(currentVersion)) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Invalid existing version format: ${currentVersion}`));
        }
        const updated = setNestedValue(data, versionPath, newVersion);
        if (!updated) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Failed to set version at path '${versionPath}'`));
        }
        const newContent = toml.stringify(data);
        await fs.writeFile(filePath, newContent, 'utf-8');
        return (0, result_js_1.ok)(undefined);
    }
    catch (error) {
        if (error instanceof Error && (error.message.includes('row') || error.message.includes('Unexpected character'))) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Invalid TOML syntax', error));
        }
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', error instanceof Error ? error.message : String(error), error));
    }
}
async function updateRegexFile(filePath, newVersion, versionPattern, versionReplacement) {
    try {
        const parseResult = await (0, FileParser_js_1.parseRegexFile)(filePath, versionPattern, undefined, 'unknown');
        if (!parseResult.ok) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Cannot update file without valid existing version', parseResult.error));
        }
        const content = await fs.readFile(filePath, 'utf-8');
        if (!versionPattern.test(content)) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Version pattern did not match in file'));
        }
        const replacement = versionReplacement.replace(/\$VERSION/g, newVersion);
        const newContent = content.replace(versionPattern, replacement);
        if (newContent === content) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'File content unchanged after replacement'));
        }
        await fs.writeFile(filePath, newContent, 'utf-8');
        return (0, result_js_1.ok)(undefined);
    }
    catch (error) {
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', error instanceof Error ? error.message : String(error), error));
    }
}
async function configUpdater(filePath, newVersion, config) {
    switch (config.format) {
        case 'json':
            return updateJsonFile(filePath, newVersion, config.versionPath || 'version');
        case 'toml':
            return updateTomlFile(filePath, newVersion, config.versionPath || 'version');
        case 'regex':
            if (!config.versionPattern || !config.versionReplacement) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'versionPattern and versionReplacement are required for regex format'));
            }
            return updateRegexFile(filePath, newVersion, config.versionPattern, config.versionReplacement);
        default:
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Unsupported format: ${config.format}`));
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
function setNestedValue(obj, path, value) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return false;
    }
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) {
        return false;
    }
    let current = obj;
    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return false;
        }
        const currentObj = current;
        if (!currentObj[key]) {
            currentObj[key] = {};
        }
        current = currentObj[key];
    }
    if (current === null || current === undefined || typeof current !== 'object') {
        return false;
    }
    current[lastKey] = value;
    return true;
}
//# sourceMappingURL=FileUpdater.js.map