"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZigAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const errors_js_1 = require("../../utils/errors.js");
class ZigAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'zig';
    supportedFiles = ['build.zig.zon', 'build.zig'];
    FILE_CONFIGS = [
        {
            filename: 'build.zig.zon',
            versionPattern: /\.version\s*=\s*"([^"]+)"/m,
            namePattern: /\.name\s*=\s*"([^"]+)"/m,
            versionReplacement: '.version = "$VERSION"',
        },
        {
            filename: 'build.zig',
            versionPattern: /const\s+VERSION\s*=\s*"([^"]+)"/i,
            namePattern: /const\s+NAME\s*=\s*"([^"]+)"/i,
            versionReplacement: 'const VERSION = "$VERSION"',
        },
    ];
    async detect(workspacePath) {
        for (const config of this.FILE_CONFIGS) {
            const filePath = (0, node_path_1.join)(workspacePath, config.filename);
            try {
                await (0, promises_1.access)(filePath);
            }
            catch {
                continue;
            }
            const parseResult = await this.parseFile(filePath, {
                format: 'regex',
                versionPattern: config.versionPattern,
                namePattern: config.namePattern,
            });
            if ((0, result_js_1.isOk)(parseResult)) {
                return (0, result_js_1.ok)(parseResult.value);
            }
            continue;
        }
        return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `No Zig configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
    }
    async update(workspacePath, newVersion) {
        const filesToUpdate = [];
        for (const config of this.FILE_CONFIGS) {
            const filePath = (0, node_path_1.join)(workspacePath, config.filename);
            try {
                await (0, promises_1.access)(filePath);
                filesToUpdate.push(config.filename);
            }
            catch {
                continue;
            }
        }
        if (filesToUpdate.length === 0) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', 'No Zig configuration files found. Cannot update version in non-existent files.'));
        }
        for (const filename of filesToUpdate) {
            const config = this.FILE_CONFIGS.find((c) => c.filename === filename);
            const filePath = (0, node_path_1.join)(workspacePath, filename);
            const updateResult = await this.updateFile(filePath, newVersion, {
                format: 'regex',
                versionPattern: config.versionPattern,
                versionReplacement: config.versionReplacement,
            });
            if (!(0, result_js_1.isOk)(updateResult)) {
                return updateResult;
            }
        }
        return (0, result_js_1.ok)(undefined);
    }
}
exports.ZigAdapter = ZigAdapter;
//# sourceMappingURL=ZigAdapter.js.map