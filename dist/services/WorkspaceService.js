"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const AdapterFactory_js_1 = require("../core/adapters/AdapterFactory.js");
const result_js_1 = require("../types/result.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class WorkspaceService extends Loggable_js_1.Loggable {
    gitService;
    constructor(gitService) {
        super();
        this.gitService = gitService;
        this.log.info('WorkspaceService initialized');
    }
    async enrichWorkspaces(configs) {
        this.log.debug({
            count: configs.length,
            workspaces: configs.map((c) => ({ path: c.path, type: c.type })),
        }, 'Enriching workspaces');
        const enriched = [];
        for (const config of configs) {
            const adapter = (0, AdapterFactory_js_1.getAdapter)(config.type);
            const detectResult = await adapter.detect(config.path);
            if (!detectResult.ok) {
                this.log.error({ path: config.path, type: config.type }, 'Failed to detect workspace info');
                return (0, result_js_1.err)(detectResult.error);
            }
            const info = detectResult.value;
            const absolutePath = this.resolveAbsolutePath(config.path);
            const workspace = {
                ...config,
                path: absolutePath,
                name: info.name,
                version: info.version,
                hasChanges: false,
                changedFiles: [],
            };
            enriched.push(workspace);
            this.log.debug({
                originalPath: config.path,
                absolutePath,
                name: info.name,
                version: info.version,
            }, 'Workspace enriched');
        }
        return (0, result_js_1.ok)(enriched);
    }
    async detectChangedWorkspaces(workspaces, lastTag, branch = 'main') {
        this.log.debug({
            lastTag,
            branch,
            workspaceCount: workspaces.length,
            workspaces: workspaces.map((w) => ({ name: w.name, path: w.path, type: w.type })),
        }, 'Detecting changed workspaces');
        if (!lastTag) {
            this.log.info('No previous tag - all workspaces marked as changed');
            return (0, result_js_1.ok)(workspaces.map((w) => ({
                ...w,
                hasChanges: true,
                changedFiles: ['*'],
            })));
        }
        const changedFilesResult = await this.gitService.getChangedFiles(lastTag, branch);
        if (!changedFilesResult.ok) {
            return (0, result_js_1.err)(changedFilesResult.error);
        }
        const allChangedFiles = changedFilesResult.value.files;
        this.log.debug({
            fileCount: allChangedFiles.length,
            files: allChangedFiles.map((f) => f.path),
            commitCount: changedFilesResult.value.commits?.length,
        }, 'Changed files retrieved from comparison');
        const updated = this.matchFilesToWorkspaces(workspaces, allChangedFiles);
        const changedWorkspaces = updated.filter((w) => w.hasChanges);
        this.log.info({
            changedCount: changedWorkspaces.length,
            changedWorkspaceNames: changedWorkspaces.map((w) => w.name),
            totalWorkspaces: workspaces.length,
        }, 'Changed workspaces identified');
        return (0, result_js_1.ok)(changedWorkspaces);
    }
    matchFilesToWorkspaces(workspaces, allChangedFiles) {
        const cwd = process.cwd();
        return workspaces.map((workspace) => {
            const relativePath = workspace.path === cwd ? '.' : workspace.path.replace(`${cwd}/`, '');
            const workspacePath = relativePath === '.' ? '' : relativePath;
            const changedInWorkspace = allChangedFiles.filter((file) => {
                if (workspacePath === '') {
                    return true;
                }
                return file.path.startsWith(workspacePath + '/') || file.path === workspacePath;
            });
            this.log.debug({
                workspace: workspace.name,
                workspacePath,
                totalFiles: allChangedFiles.length,
                matchedFiles: changedInWorkspace.length,
                matchedFilenames: changedInWorkspace.map((f) => f.path),
            }, 'Workspace file matching');
            return {
                ...workspace,
                hasChanges: changedInWorkspace.length > 0,
                changedFiles: changedInWorkspace.map((f) => f.path),
            };
        });
    }
    resolveAbsolutePath(configPath) {
        if (configPath === '.') {
            return process.cwd();
        }
        if (configPath.startsWith('/')) {
            return configPath;
        }
        return `${process.cwd()}/${configPath}`;
    }
}
exports.WorkspaceService = WorkspaceService;
//# sourceMappingURL=WorkspaceService.js.map