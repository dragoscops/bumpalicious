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
        this.log.debug({ count: configs.length }, 'Enriching workspaces');
        const enriched = [];
        for (const config of configs) {
            const result = await this.enrichSingleWorkspace(config);
            if (!result.ok) {
                return (0, result_js_1.err)(result.error);
            }
            enriched.push(result.value);
        }
        return (0, result_js_1.ok)(enriched);
    }
    async detectChangedWorkspaces(workspaces, lastTag, branch = 'main') {
        this.log.debug({ lastTag, branch, workspaceCount: workspaces.length }, 'Detecting changed workspaces');
        if (!lastTag) {
            return this.markAllAsChanged(workspaces);
        }
        const changedFilesResult = await this.gitService.getChangedFiles(lastTag, branch);
        if (!changedFilesResult.ok) {
            return (0, result_js_1.err)(changedFilesResult.error);
        }
        const allChangedFiles = changedFilesResult.value.files;
        this.log.debug({ fileCount: allChangedFiles.length }, 'Changed files retrieved');
        const updated = this.matchFilesToWorkspaces(workspaces, allChangedFiles);
        const changedWorkspaces = updated.filter((w) => w.hasChanges);
        this.log.info({ changedCount: changedWorkspaces.length, totalWorkspaces: workspaces.length }, 'Changed workspaces identified');
        return (0, result_js_1.ok)(changedWorkspaces);
    }
    async enrichSingleWorkspace(config) {
        const absolutePath = this.resolveAbsolutePath(config.path);
        const adapter = (0, AdapterFactory_js_1.getAdapter)(config.type);
        const detectResult = await adapter.detect(absolutePath);
        if (!detectResult.ok) {
            this.log.error({ path: config.path, absolutePath, type: config.type }, 'Failed to detect workspace info');
            return (0, result_js_1.err)(detectResult.error);
        }
        const info = detectResult.value;
        const workspace = {
            ...config,
            path: absolutePath,
            name: info.name,
            version: info.version,
            hasChanges: false,
            changedFiles: [],
        };
        this.log.debug({ path: config.path, absolutePath, name: info.name, version: info.version }, 'Workspace enriched');
        return (0, result_js_1.ok)(workspace);
    }
    markAllAsChanged(workspaces) {
        this.log.info('No previous tag - all workspaces marked as changed');
        return (0, result_js_1.ok)(workspaces.map((w) => ({
            ...w,
            hasChanges: true,
            changedFiles: ['*'],
        })));
    }
    matchFilesToWorkspaces(workspaces, allChangedFiles) {
        return workspaces.map((workspace) => {
            const workspacePath = this.getRelativePath(workspace.path);
            const changedInWorkspace = this.filterFilesForWorkspace(allChangedFiles, workspacePath);
            this.log.debug({ workspace: workspace.name, workspacePath, matchedFiles: changedInWorkspace.length }, 'Workspace file matching');
            return {
                ...workspace,
                hasChanges: changedInWorkspace.length > 0,
                changedFiles: changedInWorkspace.map((f) => f.path),
            };
        });
    }
    getRelativePath(absolutePath) {
        const cwd = process.cwd();
        if (absolutePath === cwd) {
            return '';
        }
        const relativePath = absolutePath.replace(`${cwd}/`, '');
        return relativePath === '.' ? '' : relativePath;
    }
    filterFilesForWorkspace(files, workspacePath) {
        if (workspacePath === '') {
            return [...files];
        }
        return files.filter((file) => file.path.startsWith(workspacePath + '/') || file.path === workspacePath);
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