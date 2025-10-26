"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWorkspacesInput = parseWorkspacesInput;
const errors_js_1 = require("./errors.js");
const validators_js_1 = require("./validators.js");
function parseWorkspacesInput(input) {
    if (!input || input.trim() === '') {
        throw new errors_js_1.InvalidConfigurationError('workspaces', 'input cannot be empty');
    }
    const segments = input
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    if (segments.length === 0) {
        throw new errors_js_1.InvalidConfigurationError('workspaces', 'no valid workspace definitions found');
    }
    const configs = segments.map((segment, index) => {
        const parts = segment.split(':');
        if (parts.length !== 2) {
            throw new errors_js_1.InvalidConfigurationError(`workspaces[${index}]`, `invalid format "${segment}". Expected format: "path:type"`);
        }
        const [rawPath, type] = parts;
        const path = normalizePath(rawPath.trim());
        const trimmedType = type.trim();
        if (path === '') {
            throw new errors_js_1.InvalidConfigurationError(`workspaces[${index}]`, 'path cannot be empty');
        }
        if (trimmedType === '') {
            throw new errors_js_1.InvalidConfigurationError(`workspaces[${index}]`, 'type cannot be empty');
        }
        return { path, type: trimmedType };
    });
    return (0, validators_js_1.validateWorkspaceConfigs)(configs);
}
function normalizePath(path) {
    let normalized = path.trim();
    if (normalized === './') {
        normalized = '.';
    }
    if (normalized.startsWith('./')) {
        normalized = normalized.slice(2);
    }
    if (normalized !== '.' && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}
//# sourceMappingURL=workspace-parser.js.map