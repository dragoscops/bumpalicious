"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoAdapter = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const BaseAdapter_js_1 = require("./BaseAdapter.js");
const result_js_1 = require("../../types/result.js");
const version_js_1 = require("../../types/version.js");
const errors_js_1 = require("../../utils/errors.js");
class GoAdapter extends BaseAdapter_js_1.BaseWorkspaceAdapter {
    type = 'go';
    supportedFiles = ['go.mod', 'version.go', 'version.txt'];
    FILE_CONFIGS = [
        {
            filename: 'go.mod',
            versionPattern: /\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m,
            versionReplacement: '// version: $VERSION',
            namePattern: /module\s+([\w\d./@:-]+)/m,
        },
        {
            filename: 'version.go',
            versionPattern: /(?:const|var)\s+[vV]ersion\s*=\s*"([^"]*)"/m,
            versionReplacement: 'const Version = "$VERSION"',
            namePattern: /package\s+(\w+)/m,
        },
        {
            filename: 'version.txt',
            versionPattern: /^v?(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)$/m,
            versionReplacement: '$VERSION',
            defaultName: '',
        },
    ];
    async detect(workspacePath) {
        try {
            const debug = process.env.ACTIONS_STEP_DEBUG === 'true' || process.env.RUNNER_DEBUG === '1';
            if (debug) {
                console.log(`[GoAdapter] Detecting in workspace: ${workspacePath}`);
            }
            for (const config of this.FILE_CONFIGS) {
                const filePath = (0, node_path_1.join)(workspacePath, config.filename);
                if (debug) {
                    console.log(`[GoAdapter] Checking file: ${filePath}`);
                }
                try {
                    await (0, promises_1.access)(filePath);
                    if (debug) {
                        console.log(`[GoAdapter] File exists: ${config.filename}`);
                    }
                }
                catch {
                    if (debug) {
                        console.log(`[GoAdapter] File not found: ${config.filename}`);
                    }
                    continue;
                }
                if (config.filename === 'version.txt') {
                    try {
                        const content = await (0, promises_1.readFile)(filePath, 'utf-8');
                        if (debug) {
                            console.log(`[GoAdapter] version.txt content: "${content.trim()}"`);
                        }
                        const versionMatch = content.match(config.versionPattern);
                        if (debug) {
                            console.log(`[GoAdapter] version.txt match: ${JSON.stringify(versionMatch)}`);
                        }
                        if (versionMatch && versionMatch[1] && (0, version_js_1.isVersion)(versionMatch[1])) {
                            if (debug) {
                                console.log(`[GoAdapter] Detected version from version.txt: ${versionMatch[1]}`);
                            }
                            return (0, result_js_1.ok)({ name: (0, node_path_1.basename)(workspacePath), version: versionMatch[1] });
                        }
                        if (debug) {
                            console.log(`[GoAdapter] version.txt parse failed, continuing...`);
                        }
                        continue;
                    }
                    catch (readError) {
                        if (debug) {
                            console.log(`[GoAdapter] Error reading version.txt: ${readError}`);
                        }
                        continue;
                    }
                }
                if (debug) {
                    console.log(`[GoAdapter] Parsing ${config.filename} with regex`);
                }
                const parseResult = await this.parseFile(filePath, {
                    format: 'regex',
                    versionPattern: config.versionPattern,
                    namePattern: config.namePattern,
                });
                if ((0, result_js_1.isOk)(parseResult)) {
                    if (debug) {
                        console.log(`[GoAdapter] Detected from ${config.filename}: ${JSON.stringify(parseResult.value)}`);
                    }
                    return (0, result_js_1.ok)(parseResult.value);
                }
                if (debug) {
                    console.log(`[GoAdapter] Parse failed for ${config.filename}, trying next...`);
                }
                continue;
            }
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, `No Go configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceDetectionError(workspacePath, 'Failed to detect Go workspace', error));
        }
    }
    async update(workspacePath, newVersion) {
        try {
            const existingFiles = await this.findAllConfigFiles(workspacePath);
            if (existingFiles.length === 0) {
                return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `No Go configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`));
            }
            for (const config of existingFiles) {
                const filePath = (0, node_path_1.join)(workspacePath, config.filename);
                const updateResult = await this.updateFile(filePath, newVersion, {
                    format: 'regex',
                    versionPattern: config.versionPattern,
                    versionReplacement: config.versionReplacement,
                });
                if (!(0, result_js_1.isOk)(updateResult)) {
                    return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', `Failed to update ${config.filename}`, updateResult.error));
                }
            }
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(workspacePath, 'update', 'Failed to update Go workspace', error));
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
exports.GoAdapter = GoAdapter;
//# sourceMappingURL=GoAdapter.js.map