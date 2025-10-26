"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RustAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const errors_js_1 = require("../../utils/errors.js");
class RustAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'rust';
    supportedFiles = ['Cargo.toml'];
    async detect(workspacePath) {
        const filePath = (0, node_path_1.join)(workspacePath, 'Cargo.toml');
        try {
            await (0, promises_1.access)(filePath);
        }
        catch {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, 'No Cargo.toml file found. This does not appear to be a Rust workspace.'));
        }
        const parseResult = await this.parseFile(filePath, {
            format: 'toml',
            versionPath: 'package.version',
            namePath: 'package.name',
        });
        if (!(0, result_js_1.isOk)(parseResult)) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, 'Failed to parse Cargo.toml', parseResult.error));
        }
        return (0, result_js_1.ok)(parseResult.value);
    }
    async update(workspacePath, newVersion) {
        const filePath = (0, node_path_1.join)(workspacePath, 'Cargo.toml');
        try {
            await (0, promises_1.access)(filePath);
        }
        catch {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(filePath, 'update', 'Cargo.toml not found. Cannot update version in non-existent file.'));
        }
        const updateResult = await this.updateFile(filePath, newVersion, {
            format: 'toml',
            versionPath: 'package.version',
        });
        return updateResult;
    }
}
exports.RustAdapter = RustAdapter;
//# sourceMappingURL=RustAdapter.js.map