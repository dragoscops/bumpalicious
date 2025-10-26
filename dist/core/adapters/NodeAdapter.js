"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const errors_js_1 = require("../../utils/errors.js");
class NodeAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'node';
    supportedFiles = ['package.json', 'jsr.json'];
    async detect(workspacePath) {
        try {
            const configFile = await this.findConfigFile(workspacePath);
            if (!configFile) {
                return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `No Node.js configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
            }
            const filePath = (0, node_path_1.join)(workspacePath, configFile);
            const parseResult = await this.parseFile(filePath, {
                format: 'json',
                versionPath: 'version',
                namePath: 'name',
            });
            if (!(0, result_js_1.isOk)(parseResult)) {
                return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `Failed to parse ${configFile}`, parseResult.error));
            }
            return (0, result_js_1.ok)(parseResult.value);
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, 'Failed to detect Node.js workspace', error));
        }
    }
    async update(workspacePath, newVersion) {
        try {
            const existingFiles = await this.findAllConfigFiles(workspacePath);
            if (existingFiles.length === 0) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `No Node.js configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
            }
            for (const configFile of existingFiles) {
                const filePath = (0, node_path_1.join)(workspacePath, configFile);
                const updateResult = await this.updateFile(filePath, newVersion, {
                    format: 'json',
                    versionPath: 'version',
                });
                if (!(0, result_js_1.isOk)(updateResult)) {
                    return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `Failed to update ${configFile}`, updateResult.error));
                }
            }
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', 'Failed to update Node.js workspace', error));
        }
    }
    async findConfigFile(workspacePath) {
        for (const fileName of this.supportedFiles) {
            const filePath = (0, node_path_1.join)(workspacePath, fileName);
            try {
                await (0, promises_1.access)(filePath);
                return fileName;
            }
            catch {
                continue;
            }
        }
        return null;
    }
    async findAllConfigFiles(workspacePath) {
        const existingFiles = [];
        for (const fileName of this.supportedFiles) {
            const filePath = (0, node_path_1.join)(workspacePath, fileName);
            try {
                await (0, promises_1.access)(filePath);
                existingFiles.push(fileName);
            }
            catch {
                continue;
            }
        }
        return existingFiles;
    }
}
exports.NodeAdapter = NodeAdapter;
//# sourceMappingURL=NodeAdapter.js.map