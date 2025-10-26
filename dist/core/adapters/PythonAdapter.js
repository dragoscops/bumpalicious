"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const version_js_1 = require("../../types/version.js");
const errors_js_1 = require("../../utils/errors.js");
class PythonAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'python';
    supportedFiles = ['pyproject.toml', 'poetry.toml', 'setup.py', 'setup.cfg', '__init__.py'];
    static FILE_CONFIGS = [
        {
            filename: 'pyproject.toml',
            format: 'toml',
            versionPath: 'project.version',
            namePath: 'project.name',
        },
        {
            filename: 'poetry.toml',
            format: 'toml',
            versionPath: 'tool.poetry.version',
            namePath: 'tool.poetry.name',
        },
        {
            filename: 'setup.py',
            format: 'regex',
            versionPattern: /version\s*=\s*["']([^"']+)["']/m,
            namePattern: /name\s*=\s*["']([^"']+)["']/m,
            versionReplacement: 'version="$VERSION"',
        },
        {
            filename: 'setup.cfg',
            format: 'regex',
            versionPattern: /version\s*=\s*([^\s]+)/m,
            namePattern: /name\s*=\s*([^\s]+)/m,
            versionReplacement: 'version = $VERSION',
        },
        {
            filename: '__init__.py',
            format: 'regex',
            versionPattern: /__version__\s*=\s*["']([^"']+)["']/m,
            namePattern: /__name__\s*=\s*["']([^"']+)["']/m,
            versionReplacement: '__version__ = "$VERSION"',
        },
    ];
    async detect(workspacePath) {
        try {
            for (const config of PythonAdapter.FILE_CONFIGS) {
                const filePath = (0, node_path_1.join)(workspacePath, config.filename);
                try {
                    await (0, promises_1.access)(filePath);
                }
                catch {
                    continue;
                }
                let parseResult;
                if (config.format === 'toml' && config.versionPath && config.namePath) {
                    parseResult = await this.parseFile(filePath, {
                        format: 'toml',
                        versionPath: config.versionPath,
                        namePath: config.namePath,
                    });
                }
                else if (config.format === 'regex' && config.versionPattern) {
                    parseResult = await this.parseFile(filePath, {
                        format: 'regex',
                        versionPattern: config.versionPattern,
                        namePattern: config.namePattern,
                    });
                    if (!(0, result_js_1.isOk)(parseResult) && config.filename === '__init__.py') {
                        try {
                            const content = await (0, promises_1.readFile)(filePath, 'utf-8');
                            const versionMatch = content.match(config.versionPattern);
                            if (versionMatch && versionMatch[1] && (0, version_js_1.isVersion)(versionMatch[1])) {
                                return (0, result_js_1.ok)({
                                    name: (0, node_path_1.basename)(workspacePath),
                                    version: versionMatch[1],
                                });
                            }
                        }
                        catch {
                            continue;
                        }
                    }
                }
                else {
                    continue;
                }
                if ((0, result_js_1.isOk)(parseResult)) {
                    return (0, result_js_1.ok)({
                        name: parseResult.value.name || (0, node_path_1.basename)(workspacePath),
                        version: parseResult.value.version,
                    });
                }
            }
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `No valid Python configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, 'Failed to detect Python workspace', error));
        }
    }
    async update(workspacePath, newVersion) {
        try {
            const existingConfigs = await this.findAllConfigFiles(workspacePath);
            if (existingConfigs.length === 0) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `No Python configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
            }
            for (const config of existingConfigs) {
                const filePath = (0, node_path_1.join)(workspacePath, config.filename);
                let updateResult;
                if (config.format === 'toml' && config.versionPath) {
                    updateResult = await this.updateFile(filePath, newVersion, {
                        format: 'toml',
                        versionPath: config.versionPath,
                    });
                }
                else if (config.format === 'regex' && config.versionPattern && config.versionReplacement) {
                    updateResult = await this.updateFile(filePath, newVersion, {
                        format: 'regex',
                        versionPattern: config.versionPattern,
                        versionReplacement: config.versionReplacement,
                    });
                }
                else {
                    continue;
                }
                if (!(0, result_js_1.isOk)(updateResult)) {
                    return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `Failed to update ${config.filename}`, updateResult.error));
                }
            }
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', 'Failed to update Python workspace', error));
        }
    }
    async findAllConfigFiles(workspacePath) {
        const existingConfigs = [];
        for (const config of PythonAdapter.FILE_CONFIGS) {
            const filePath = (0, node_path_1.join)(workspacePath, config.filename);
            try {
                await (0, promises_1.access)(filePath);
                existingConfigs.push(config);
            }
            catch {
                continue;
            }
        }
        return existingConfigs;
    }
}
exports.PythonAdapter = PythonAdapter;
//# sourceMappingURL=PythonAdapter.js.map