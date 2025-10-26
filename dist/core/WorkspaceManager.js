"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceManager = void 0;
const AdapterFactory_js_1 = require("./adapters/AdapterFactory.js");
const PRService_js_1 = require("../services/PRService.js");
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class WorkspaceManager extends Loggable_js_1.Loggable {
    gitService;
    githubService;
    localGitService;
    tagService;
    workspaceService;
    prService;
    versionService;
    changelogService;
    treeBuilder;
    constructor(deps) {
        super();
        this.gitService = deps.gitService;
        this.githubService = deps.githubService;
        this.localGitService = deps.localGitService;
        this.tagService = deps.tagService;
        this.workspaceService = deps.workspaceService;
        this.prService = deps.prService;
        this.versionService = deps.versionService;
        this.changelogService = deps.changelogService;
        this.treeBuilder = deps.treeBuilder;
        this.log.info('WorkspaceManager initialized');
    }
    async execute(options) {
        this.log.info({
            workspaceCount: options.workspaces.length,
            createPR: options.createPR,
            branch: options.branch ?? 'main',
        }, 'Starting workflow execution');
        try {
            const mergedPRResult = await this.handleMergedPR(options);
            if (mergedPRResult) {
                return mergedPRResult;
            }
            return await this.executeVersionBump(options);
        }
        catch (error) {
            this.log.error({
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
            }, 'Workflow execution failed');
            return (0, result_js_1.err)(error instanceof Error ? error : new Error(String(error)));
        }
    }
    async enrichWorkspaces(configs) {
        return await this.workspaceService.enrichWorkspaces(configs);
    }
    async detectChangedWorkspaces(workspaces, lastTag, branch = 'main') {
        return await this.workspaceService.detectChangedWorkspaces(workspaces, lastTag, branch);
    }
    async calculateVersions(workspaces, lastTag, branch) {
        return await this.versionService.calculateVersionsForWorkspaces(workspaces, lastTag, branch);
    }
    async updateVersionFiles(workspaces) {
        this.log.debug({
            count: workspaces.length,
            workspaces: workspaces.map((w) => ({ name: w.name, version: w.newVersion })),
        }, 'Updating version files');
        for (const workspace of workspaces) {
            const adapter = (0, AdapterFactory_js_1.getAdapter)(workspace.type);
            const updateResult = await adapter.update(workspace.path, workspace.newVersion);
            if (!updateResult.ok) {
                this.log.error({ path: workspace.path, version: workspace.newVersion }, 'Failed to update version file');
                return (0, result_js_1.err)(updateResult.error);
            }
            this.log.debug({ path: workspace.path, version: workspace.newVersion }, 'Version file updated');
        }
        return (0, result_js_1.ok)(undefined);
    }
    async generateChangelogs(tree, options) {
        this.log.debug({
            rootWorkspace: tree.root.workspace.name,
            childrenCount: tree.root.children.length,
            preset: options.changelog?.preset,
        }, 'Generating changelogs');
        const commitsResult = await this.getCommitsForChangelog(options);
        if (!commitsResult.ok) {
            return (0, result_js_1.err)(commitsResult.error);
        }
        return await this.generateRootChangelog(tree, options, commitsResult.value);
    }
    async createVersionPR(tree, options, branchName) {
        this.log.debug({ version: tree.masterVersion, branch: branchName }, 'Creating version PR');
        const prResult = await this.createPR(tree, options, branchName);
        if (!prResult.ok) {
            return (0, result_js_1.err)(prResult.error);
        }
        const pr = prResult.value;
        this.log.info({ prNumber: pr.number, prUrl: pr.htmlUrl }, 'Version PR created');
        if (options.prOptions?.autoMerge) {
            return await this.handleAutoMerge(pr.number, branchName);
        }
        this.log.info({ prNumber: pr.number }, 'PR created without auto-merge - waiting for manual merge');
        return (0, result_js_1.ok)({
            number: pr.number,
            merged: false,
            mergeCommitSha: undefined,
        });
    }
    async handleMergedPR(options) {
        const mergeInfo = await this.detectMergedPR(options);
        if (!mergeInfo) {
            return null;
        }
        const { commitSha, prNumber } = mergeInfo;
        this.log.info('Detected merged version bump PR - creating tags only');
        const tagsResult = await this.createTagsForMergedPR(options, commitSha);
        if (!tagsResult.ok) {
            return (0, result_js_1.err)(tagsResult.error);
        }
        const { tree, allTags } = tagsResult.value;
        await this.cleanupPRBranch(prNumber, options.prOptions?.branchPrefix);
        return (0, result_js_1.ok)({
            tag: allTags.length > 0 ? `v${tree.masterVersion}` : '',
            allTags,
            prNumber,
            prMerged: true,
            tree,
        });
    }
    async executeVersionBump(options) {
        const branch = options.branch || 'main';
        const lastTag = await this.getLastTag();
        if (!lastTag.ok) {
            return (0, result_js_1.err)(lastTag.error);
        }
        const enrichedWorkspaces = await this.enrichAndDetectChanges(options, lastTag.value, branch);
        if (!enrichedWorkspaces.ok) {
            return (0, result_js_1.err)(enrichedWorkspaces.error);
        }
        const tree = await this.buildWorkspaceTree(enrichedWorkspaces.value, lastTag.value, branch);
        if (!tree.ok) {
            return (0, result_js_1.err)(tree.error);
        }
        const updateResult = await this.updateFilesAndChangelogs(tree.value, { ...options, lastTag: lastTag.value });
        if (!updateResult.ok) {
            return (0, result_js_1.err)(updateResult.error);
        }
        return await this.createReleaseArtifacts(tree.value, options);
    }
    async detectMergedPR(options) {
        const targetBranch = options.branch || 'main';
        const lastCommitResult = await this.gitService.getLastCommit(targetBranch);
        if (!lastCommitResult.ok || !lastCommitResult.value) {
            return null;
        }
        const { message, sha } = lastCommitResult.value;
        this.log.info({ commitMessage: message, sha, branch: targetBranch }, 'Checking last commit');
        if (!this.isVersionBumpCommit(message, options)) {
            return null;
        }
        return {
            commitSha: sha,
            prNumber: this.extractPRNumber(message),
        };
    }
    isVersionBumpCommit(message, options) {
        const prTitle = options.prOptions?.title || 'chore: version update';
        return message.startsWith('chore: bump version to') || message.startsWith(prTitle);
    }
    extractPRNumber(commitMessage) {
        const prNumberMatch = commitMessage.match(/#(\d+)\)/);
        return prNumberMatch ? parseInt(prNumberMatch[1], 10) : undefined;
    }
    async createTagsForMergedPR(options, commitSha) {
        const enrichResult = await this.enrichWorkspaces(options.workspaces);
        if (!enrichResult.ok) {
            return (0, result_js_1.err)(enrichResult.error);
        }
        const workspacesWithVersion = enrichResult.value.map((ws) => ({
            ...ws,
            newVersion: ws.version,
            hasChanges: true,
        }));
        const tree = this.treeBuilder.build(workspacesWithVersion);
        const tagsResult = await this.createVersionTags(tree, options, commitSha);
        if (!tagsResult.ok) {
            return (0, result_js_1.err)(tagsResult.error);
        }
        const allTags = tagsResult.value;
        this.log.info({ tagCount: allTags.length }, 'Tags created for merged PR');
        return (0, result_js_1.ok)({ tree, allTags });
    }
    async cleanupPRBranch(prNumber, branchPrefix) {
        if (!prNumber || !branchPrefix) {
            return;
        }
        const prDetailsResult = await this.prService.getPullRequest(prNumber);
        if (!prDetailsResult.ok) {
            this.log.warn({ prNumber, error: prDetailsResult.error.message }, 'Failed to get PR details for cleanup');
            return;
        }
        const branchName = prDetailsResult.value.headRef;
        try {
            await this.githubService.deleteBranch(branchName);
            this.log.info({ branch: branchName, prNumber }, 'Version branch deleted after manual merge');
        }
        catch (error) {
            this.log.warn({ prNumber, branchName, error }, 'Failed to delete branch after manual merge');
        }
    }
    async getLastTag() {
        const lastTagResult = await this.gitService.getLastTag();
        if (!lastTagResult.ok) {
            return (0, result_js_1.err)(lastTagResult.error);
        }
        const lastTag = lastTagResult.value?.name || null;
        this.log.info({ lastTag }, 'Last tag retrieved');
        return (0, result_js_1.ok)(lastTag);
    }
    async enrichAndDetectChanges(options, lastTag, branch) {
        const enrichResult = await this.enrichWorkspaces(options.workspaces);
        if (!enrichResult.ok) {
            return (0, result_js_1.err)(enrichResult.error);
        }
        const enrichedWorkspaces = enrichResult.value;
        this.log.info({ count: enrichedWorkspaces.length }, 'Workspaces enriched');
        const changedResult = await this.detectChangedWorkspaces(enrichedWorkspaces, lastTag, branch);
        if (!changedResult.ok) {
            return (0, result_js_1.err)(changedResult.error);
        }
        const changedWorkspaces = changedResult.value;
        if (changedWorkspaces.length === 0) {
            return (0, result_js_1.err)(new errors_js_1.WorkspaceValidationError(`No workspaces have changed since last tag (${lastTag || 'none'}). Branch: ${branch}, Total workspaces: ${enrichedWorkspaces.length}`));
        }
        this.log.info({ count: changedWorkspaces.length }, 'Changed workspaces detected');
        return (0, result_js_1.ok)(changedWorkspaces);
    }
    async buildWorkspaceTree(changedWorkspaces, lastTag, branch) {
        const versionsResult = await this.calculateVersions(changedWorkspaces, lastTag, branch);
        if (!versionsResult.ok) {
            return (0, result_js_1.err)(versionsResult.error);
        }
        const changedWorkspacesWithVersions = versionsResult.value;
        const allWorkspacesWithVersions = this.mergeWorkspaceVersions(changedWorkspaces, changedWorkspacesWithVersions);
        const tree = this.treeBuilder.build(allWorkspacesWithVersions);
        this.log.info({ rootVersion: tree.masterVersion }, 'Workspace tree built');
        return (0, result_js_1.ok)(tree);
    }
    mergeWorkspaceVersions(allWorkspaces, changedWorkspaces) {
        return allWorkspaces.map((workspace) => {
            const changed = changedWorkspaces.find((w) => w.path === workspace.path);
            if (changed) {
                return changed;
            }
            return {
                ...workspace,
                newVersion: workspace.version,
            };
        });
    }
    async updateFilesAndChangelogs(tree, options) {
        const workspacesToUpdate = tree.allWorkspaces.filter((ws) => ws.hasChanges);
        const updateResult = await this.updateVersionFiles(workspacesToUpdate);
        if (!updateResult.ok) {
            return (0, result_js_1.err)(updateResult.error);
        }
        this.log.info('Version files updated');
        if (!options.changelog?.skip) {
            const changelogResult = await this.generateChangelogs(tree, options);
            if (!changelogResult.ok) {
                return (0, result_js_1.err)(changelogResult.error);
            }
            this.log.info('Changelogs generated');
        }
        return (0, result_js_1.ok)(undefined);
    }
    async getCommitsForChangelog(options) {
        const branch = options.branch || 'main';
        const base = options.lastTag || 'HEAD^';
        this.log.debug({ branch, base, hasLastTag: !!options.lastTag }, 'Getting commits for changelog');
        const commitsResult = await this.gitService.getCommitsSince(base, branch);
        if (!commitsResult.ok) {
            this.log.error({ error: commitsResult.error, branch, base }, 'Failed to get commits for changelog');
            return (0, result_js_1.err)(new errors_js_1.FileOperationError('CHANGELOG.md', 'generate', 'Failed to get commits for changelog generation', commitsResult.error));
        }
        this.log.debug({ rawCommitCount: commitsResult.value.length }, 'Raw commits retrieved');
        return (0, result_js_1.ok)(commitsResult.value);
    }
    async generateRootChangelog(tree, options, commits) {
        this.log.debug({
            commitCount: commits.length,
            firstCommit: commits[0]?.message,
            commits: commits.map((c) => ({ sha: c.sha, message: c.message.substring(0, 50) })),
        }, 'Retrieved commits for changelog generation');
        const rootChangelogPath = `${tree.root.workspace.path}/CHANGELOG.md`;
        const generateOptions = {
            workspace: tree.root.workspace,
            changelogPath: rootChangelogPath,
            preset: options.changelog?.preset || 'conventionalcommits',
            childWorkspaces: tree.root.children,
            repository: options.repository,
            lastTag: options.lastTag,
            commits,
        };
        this.log.debug({ path: rootChangelogPath }, 'Generating root changelog');
        const rootResult = await this.changelogService.generateForWorkspace(generateOptions);
        if (!rootResult) {
            return (0, result_js_1.err)(new errors_js_1.FileOperationError(rootChangelogPath, 'generate', 'Failed to generate root changelog'));
        }
        return (0, result_js_1.ok)(undefined);
    }
    async createReleaseArtifacts(tree, options) {
        if (options.createPR) {
            return await this.createPRWorkflow(tree, options);
        }
        return await this.createDirectCommitWorkflow(tree, options);
    }
    async createPRWorkflow(tree, options) {
        const branchPrefix = options.prOptions?.branchPrefix || 'version-bump';
        const branchResult = await this.localGitService.createVersionBranch(tree, branchPrefix);
        if (!branchResult.ok) {
            return (0, result_js_1.err)(branchResult.error);
        }
        this.log.info({ branch: branchResult.value }, 'Version branch created');
        const prResult = await this.createVersionPR(tree, options, branchResult.value);
        if (!prResult.ok) {
            return (0, result_js_1.err)(prResult.error);
        }
        const { number: prNumber, merged: prMerged, mergeCommitSha } = prResult.value;
        this.log.info({ prNumber, merged: prMerged }, 'Pull request created');
        let allTags = [];
        if (prMerged && mergeCommitSha) {
            const tagsResult = await this.createVersionTags(tree, options, mergeCommitSha);
            if (!tagsResult.ok) {
                return (0, result_js_1.err)(tagsResult.error);
            }
            allTags = tagsResult.value;
            this.log.info({ tagCount: allTags.length }, 'Version tags created after PR merge');
        }
        else {
            this.log.info({ prNumber }, 'PR created without auto-merge - tags will be created after manual merge');
        }
        return (0, result_js_1.ok)({
            tag: allTags.length > 0 ? `v${tree.masterVersion}` : '',
            allTags,
            prNumber,
            prMerged: allTags.length > 0,
            tree,
        });
    }
    async createDirectCommitWorkflow(tree, options) {
        const commitResult = await this.localGitService.createVersionCommit(tree);
        if (!commitResult.ok) {
            return (0, result_js_1.err)(commitResult.error);
        }
        const commitSha = commitResult.value;
        this.log.info({ sha: commitSha }, 'Version commit created');
        const tagsResult = await this.createVersionTags(tree, options, commitSha);
        if (!tagsResult.ok) {
            return (0, result_js_1.err)(tagsResult.error);
        }
        const allTags = tagsResult.value;
        this.log.info({ tagCount: allTags.length }, 'Version tags created');
        return (0, result_js_1.ok)({
            tag: `v${tree.masterVersion}`,
            allTags,
            tree,
        });
    }
    async createPR(tree, options, branchName) {
        const title = `chore: bump version to ${tree.masterVersion}`;
        const body = PRService_js_1.PRService.buildPRBody(tree);
        return await this.prService.create({
            title,
            body,
            head: branchName,
            base: options.branch || 'main',
            draft: options.prOptions?.draft || false,
        });
    }
    async handleAutoMerge(prNumber, branchName) {
        const checksResult = await this.waitForPRChecks(prNumber);
        if (!checksResult.ok) {
            return (0, result_js_1.err)(checksResult.error);
        }
        const mergeResult = await this.mergePR(prNumber);
        if (!mergeResult.ok) {
            return (0, result_js_1.ok)({
                number: prNumber,
                merged: false,
                mergeCommitSha: undefined,
            });
        }
        const mergeCommitSha = mergeResult.value;
        await this.cleanupBranch(branchName);
        return (0, result_js_1.ok)({
            number: prNumber,
            merged: true,
            mergeCommitSha,
        });
    }
    async waitForPRChecks(prNumber) {
        this.log.debug({ prNumber }, 'Waiting for PR checks to complete');
        const checksResult = await this.prService.waitForChecks({
            prNumber,
            timeout: 300000,
            interval: 10000,
        });
        if (!checksResult.ok) {
            this.log.error({ prNumber, error: checksResult.error.message }, 'Failed to wait for PR checks');
            return (0, result_js_1.err)(checksResult.error);
        }
        const checksStatus = checksResult.value;
        if (!checksStatus.allPassed) {
            const checkError = new Error(`PR checks did not pass. Failed checks: ${checksStatus.failedCheckNames?.join(', ') || 'unknown'}`);
            this.log.error({
                prNumber,
                failedChecks: checksStatus.failedChecks,
                failedCheckNames: checksStatus.failedCheckNames,
                mergeableState: checksStatus.mergeableState,
            }, 'PR checks failed');
            return (0, result_js_1.err)(checkError);
        }
        this.log.info({ prNumber }, 'All PR checks passed');
        return (0, result_js_1.ok)(undefined);
    }
    async mergePR(prNumber) {
        this.log.debug({ prNumber }, 'Merging PR');
        const mergeResult = await this.prService.merge({
            prNumber,
            mergeMethod: 'squash',
        });
        if (!mergeResult.ok) {
            this.log.warn({ prNumber }, 'Auto-merge failed - PR remains open');
            return (0, result_js_1.err)(mergeResult.error);
        }
        const mergeCommitSha = mergeResult.value.sha;
        this.log.info({ prNumber, mergeCommitSha }, 'PR auto-merged');
        return (0, result_js_1.ok)(mergeCommitSha);
    }
    async cleanupBranch(branchName) {
        try {
            await this.githubService.deleteBranch(branchName);
            this.log.info({ branch: branchName }, 'Version branch deleted after merge');
        }
        catch (error) {
            this.log.warn({ branch: branchName, error }, 'Failed to delete branch after merge');
        }
    }
    async createVersionTags(tree, options, providedCommitSha) {
        if (providedCommitSha) {
            return await this.tagService.createVersionTags(tree.masterVersion, providedCommitSha, options.tagOptions);
        }
        const branch = options.branch || 'main';
        return await this.tagService.createVersionTagsForBranch(tree.masterVersion, branch, options.tagOptions);
    }
}
exports.WorkspaceManager = WorkspaceManager;
//# sourceMappingURL=WorkspaceManager.js.map