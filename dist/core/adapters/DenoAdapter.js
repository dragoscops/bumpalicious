"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DenoAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const version_js_1 = require("../../types/version.js");
const errors_js_1 = require("../../utils/errors.js");
class DenoAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'deno';
    supportedFiles = ['deno.jsonc', 'deno.json', 'jsr.json'];
    FILE_CONFIGS = [
        { filename: 'deno.jsonc', isJsonc: true },
        { filename: 'deno.json', isJsonc: false },
        { filename: 'jsr.json', isJsonc: false },
    ];
    jsoncParser = null;
    async getJsoncParser() {
        if (!this.jsoncParser) {
            const module = await import('tiny-jsonc');
            this.jsoncParser = module.default;
        }
        return this.jsoncParser;
    }
    async detect(workspacePath) {
        try {
            for (const config of this.FILE_CONFIGS) {
                const filePath = (0, node_path_1.join)(workspacePath, config.filename);
                try {
                    await (0, promises_1.access)(filePath);
                }
                catch {
                    continue;
                }
                const parseResult = await this.parseDenoFile(filePath, config.isJsonc);
                if ((0, result_js_1.isOk)(parseResult)) {
                    return (0, result_js_1.ok)(parseResult.value);
                }
                continue;
            }
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `No Deno configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, 'Failed to detect Deno workspace', error));
        }
    }
    async update(workspacePath, newVersion) {
        try {
            const existingFiles = await this.findAllConfigFiles(workspacePath);
            if (existingFiles.length === 0) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `No Deno configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
            }
            for (const config of existingFiles) {
                const filePath = (0, node_path_1.join)(workspacePath, config.filename);
                const updateResult = await this.updateDenoFile(filePath, newVersion, config.isJsonc);
                if (!(0, result_js_1.isOk)(updateResult)) {
                    return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `Failed to update ${config.filename}`, updateResult.error));
                }
            }
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', 'Failed to update Deno workspace', error));
        }
    }
    async parseDenoFile(filePath, isJsonc) {
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf-8');
            let data;
            try {
                if (isJsonc) {
                    const JSONC = await this.getJsoncParser();
                    data = JSONC.parse(content);
                }
                else {
                    data = JSON.parse(content);
                }
            }
            catch (error) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', `Malformed ${isJsonc ? 'JSONC' : 'JSON'}`, error));
            }
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', 'Config file must be a JSON object'));
            }
            const config = data;
            const name = config['name'];
            const version = config['version'];
            if (typeof name !== 'string' || name.trim() === '') {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', 'Missing or invalid "name" field in config'));
            }
            if (typeof version !== 'string' || version.trim() === '') {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', 'Missing or invalid "version" field in config'));
            }
            if (!(0, version_js_1.isVersion)(version)) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', `Invalid version format: ${version}`));
            }
            return (0, result_js_1.ok)({ name, version: version });
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'read', 'Failed to parse Deno config file', error));
        }
    }
    async updateDenoFile(filePath, newVersion, isJsonc) {
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf-8');
            let data;
            try {
                if (isJsonc) {
                    const JSONC = await this.getJsoncParser();
                    data = JSONC.parse(content);
                }
                else {
                    data = JSON.parse(content);
                }
            }
            catch (error) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', `Malformed ${isJsonc ? 'JSONC' : 'JSON'}`, error));
            }
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Config file must be a JSON object'));
            }
            const config = data;
            const currentVersion = config['version'];
            if (typeof currentVersion !== 'string' || !(0, version_js_1.isVersion)(currentVersion)) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Missing or invalid "version" field in config'));
            }
            config['version'] = newVersion;
            const updatedContent = JSON.stringify(config, null, 2) + '\n';
            await (0, promises_1.writeFile)(filePath, updatedContent, 'utf-8');
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Failed to update Deno config file', error));
        }
    }
    async findAllConfigFiles(workspacePath) {
        const existingFiles = [];
        for (const config of this.FILE_CONFIGS) {
            const filePath = (0, node_path_1.join)(workspacePath, config.filename);
            try {
                await (0, promises_1.access)(filePath);
                existingFiles.push(config);
            }
            catch {
                continue;
            }
        }
        return existingFiles;
    }
}
exports.DenoAdapter = DenoAdapter;
//# sourceMappingURL=DenoAdapter.js.map