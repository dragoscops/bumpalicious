"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextAdapter = exports.SUPPORTED_FILES = exports.WORKSPACE_TYPE = void 0;
exports.detectVersion = detectVersion;
exports.updateVersion = updateVersion;
exports.hasVersionFile = hasVersionFile;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const version_js_1 = require("../../types/version.js");
const errors_js_1 = require("../../utils/errors.js");
exports.WORKSPACE_TYPE = 'text';
exports.SUPPORTED_FILES = ['VERSION', 'VERSION.txt', 'version', 'version.txt'];
async function findVersionFile(workspacePath) {
    for (const fileName of exports.SUPPORTED_FILES) {
        const filePath = (0, node_path_1.join)(workspacePath, fileName);
        try {
            await (0, promises_1.access)(filePath);
            return filePath;
        }
        catch {
            continue;
        }
    }
    return null;
}
async function detectVersion(workspacePath) {
    try {
        const versionFile = await findVersionFile(workspacePath);
        if (!versionFile) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `No version file found. Supported files: ${exports.SUPPORTED_FILES.join(', ')}`));
        }
        const content = await (0, promises_1.readFile)(versionFile, 'utf-8');
        const versionString = content.trim();
        if (!versionString) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `Version file is empty: ${versionFile}`));
        }
        if (!(0, version_js_1.isVersion)(versionString)) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `Invalid version format in ${versionFile}: ${versionString}`));
        }
        return (0, result_js_1.ok)({
            name: '',
            version: (0, version_js_1.toVersion)(versionString),
        });
    }
    catch (error) {
        return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `Failed to detect version from text file`, error));
    }
}
async function updateVersion(workspacePath, newVersion) {
    try {
        const versionFile = await findVersionFile(workspacePath);
        if (!versionFile) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `No version file found. Supported files: ${exports.SUPPORTED_FILES.join(', ')}`));
        }
        await (0, promises_1.writeFile)(versionFile, `${newVersion}\n`, 'utf-8');
        return (0, result_js_1.ok)(undefined);
    }
    catch (error) {
        return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `Failed to update version in text file`, error));
    }
}
async function hasVersionFile(workspacePath) {
    const versionFile = await findVersionFile(workspacePath);
    return versionFile !== null;
}
class TextAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'text';
    supportedFiles = exports.SUPPORTED_FILES;
    async detect(workspacePath) {
        return detectVersion(workspacePath);
    }
    async update(workspacePath, newVersion) {
        return updateVersion(workspacePath, newVersion);
    }
}
exports.TextAdapter = TextAdapter;
//# sourceMappingURL=TextAdapter.js.map