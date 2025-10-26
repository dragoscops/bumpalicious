"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceManager = void 0;
const exec = __importStar(require("@actions/exec"));
const AdapterFactory_js_1 = require("./adapters/AdapterFactory.js");
const ConventionalCommitParser_js_1 = require("../parsers/ConventionalCommitParser.js");
const PRService_js_1 = require("../services/PRService.js");
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class WorkspaceManager extends Loggable_js_1.Loggable {
    gitService;
    githubService;
    prService;
    versionService;
    changelogService;
    treeBuilder;
    constructor(deps) {
        super();
        this.gitService = deps.gitService;
        this.githubService = deps.githubService;
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
            const targetBranch = options.branch || 'main';
            const lastCommitResult = await this.gitService.getLastCommit(targetBranch);
            if (lastCommitResult.ok && lastCommitResult.value) {
                const commitMessage = lastCommitResult.value.message;
                this.log.info({
                    commitMessage,
                    sha: lastCommitResult.value.sha,
                    branch: targetBranch,
                }, 'DEBUG: Checking last commit for merged PR detection');
                const prTitle = options.prOptions?.title || 'chore: version update';
                const isPRMerge = commitMessage.startsWith('chore: bump version to') || commitMessage.startsWith(prTitle);
                if (isPRMerge) {
                    this.log.info({ commitMessage }, 'Detected merged version bump PR - creating tags only');
                    const prNumberMatch = commitMessage.match(/#(\d+)\)/);
                    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : undefined;
                    const enrichResult = await this.enrichWorkspaces(options.workspaces);
                    if (!enrichResult.ok) {
                        return (0, result_js_1.err)(enrichResult.error);
                    }
                    const enrichedWorkspaces = enrichResult.value;
                    const workspacesWithVersion = enrichedWorkspaces.map((ws) => ({
                        ...ws,
                        newVersion: ws.version,
                        hasChanges: true,
                    }));
                    const tree = this.treeBuilder.build(workspacesWithVersion);
                    this.log.info({ version: tree.masterVersion }, 'Creating tags for merged PR version');
                    const commitSha = lastCommitResult.value.sha;
                    const tagsResult = await this.createVersionTags(tree, options, commitSha);
                    if (!tagsResult.ok) {
                        return (0, result_js_1.err)(tagsResult.error);
                    }
                    const allTags = tagsResult.value;
                    this.log.info({ tagCount: allTags.length }, 'Tags created for merged PR');
                    if (prNumber && options.prOptions?.branchPrefix) {
                        const prDetailsResult = await this.prService.getPullRequest(prNumber);
                        if (!prDetailsResult.ok) {
                            this.log.warn({ prNumber, error: prDetailsResult.error.message }, 'Failed to get PR details for branch deletion');
                        }
                        else {
                            const branchName = prDetailsResult.value.headRef;
                            try {
                                await this.githubService.deleteBranch(branchName);
                                this.log.info({ branch: branchName, prNumber }, 'Version branch deleted after manual merge');
                            }
                            catch (error) {
                                this.log.warn({ prNumber, branchName, error }, 'Failed to delete branch after manual merge');
                            }
                        }
                    }
                    const result = {
                        tag: allTags.length > 0 ? `v${tree.masterVersion}` : '',
                        allTags,
                        prNumber,
                        prMerged: true,
                        tree,
                    };
                    return (0, result_js_1.ok)(result);
                }
            }
            const lastTagResult = await this.gitService.getLastTag();
            if (!lastTagResult.ok) {
                return (0, result_js_1.err)(lastTagResult.error);
            }
            const lastTag = lastTagResult.value?.name || null;
            this.log.info({ lastTag }, 'Last tag retrieved');
            const enrichResult = await this.enrichWorkspaces(options.workspaces);
            if (!enrichResult.ok) {
                return (0, result_js_1.err)(enrichResult.error);
            }
            const enrichedWorkspaces = enrichResult.value;
            this.log.info({ count: enrichedWorkspaces.length }, 'Workspaces enriched');
            const branch = options.branch || 'main';
            const changedResult = await this.detectChangedWorkspaces(enrichedWorkspaces, lastTag, branch);
            if (!changedResult.ok) {
                return (0, result_js_1.err)(changedResult.error);
            }
            const changedWorkspaces = changedResult.value;
            if (changedWorkspaces.length === 0) {
                this.log.info({
                    lastTag,
                    branch,
                    totalWorkspaces: enrichedWorkspaces.length,
                    workspacePaths: enrichedWorkspaces.map((w) => w.path),
                }, 'No workspaces have changed - skipping version bump');
                return (0, result_js_1.err)(new errors_js_1.WorkspaceValidationError(`No workspaces have changed since last tag (${lastTag || 'none'}). Branch: ${branch}, Total workspaces: ${enrichedWorkspaces.length}`));
            }
            this.log.info({ count: changedWorkspaces.length }, 'Changed workspaces detected');
            const versionsResult = await this.calculateVersions(changedWorkspaces, lastTag, branch);
            if (!versionsResult.ok) {
                return (0, result_js_1.err)(versionsResult.error);
            }
            const changedWorkspacesWithVersions = versionsResult.value;
            this.log.info('New versions calculated');
            const allWorkspacesWithVersions = enrichedWorkspaces.map((workspace) => {
                const changed = changedWorkspacesWithVersions.find((w) => w.path === workspace.path);
                if (changed) {
                    return changed;
                }
                return {
                    ...workspace,
                    newVersion: workspace.version,
                };
            });
            const tree = this.treeBuilder.build(allWorkspacesWithVersions);
            this.log.info({ rootVersion: tree.masterVersion }, 'Workspace tree built');
            const updateResult = await this.updateVersionFiles(changedWorkspacesWithVersions);
            if (!updateResult.ok) {
                return (0, result_js_1.err)(updateResult.error);
            }
            this.log.info('Version files updated');
            if (!options.changelog?.skip) {
                const changelogResult = await this.generateChangelogs(tree, { ...options, lastTag });
                if (!changelogResult.ok) {
                    return (0, result_js_1.err)(changelogResult.error);
                }
                this.log.info('Changelogs generated');
            }
            else {
                this.log.debug('Skipping changelog generation (changelog.skip=true)');
            }
            let prNumber;
            let commitSha;
            let allTags = [];
            if (options.createPR) {
                const branchResult = await this.createVersionBranch(tree, options);
                if (!branchResult.ok) {
                    return (0, result_js_1.err)(branchResult.error);
                }
                this.log.info({ branch: branchResult.value }, 'Version branch created');
                const prResult = await this.createVersionPR(tree, options, branchResult.value);
                if (!prResult.ok) {
                    return (0, result_js_1.err)(prResult.error);
                }
                prNumber = prResult.value.number;
                const prMerged = prResult.value.merged;
                this.log.info({ prNumber, merged: prMerged }, 'Pull request created');
                if (prMerged) {
                    const mergeCommitSha = prResult.value.mergeCommitSha;
                    if (!mergeCommitSha) {
                        return (0, result_js_1.err)(new errors_js_1.GitOperationError('createVersionTags', 'PR was merged but no merge commit SHA found'));
                    }
                    this.log.debug({ mergeCommitSha }, 'PR was merged, creating tags');
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
            }
            else {
                const commitResult = await this.createVersionCommit(tree);
                if (!commitResult.ok) {
                    return (0, result_js_1.err)(commitResult.error);
                }
                commitSha = commitResult.value;
                this.log.info({ sha: commitResult.value }, 'Version commit created');
                this.log.debug({ commitSha, hasSha: !!commitSha }, 'About to create tags with commit SHA');
                const tagsResult = await this.createVersionTags(tree, options, commitSha);
                if (!tagsResult.ok) {
                    return (0, result_js_1.err)(tagsResult.error);
                }
                allTags = tagsResult.value;
                this.log.info({ tagCount: allTags.length }, 'Version tags created');
            }
            const result = {
                tag: allTags.length > 0 ? `v${tree.masterVersion}` : '',
                allTags,
                prNumber,
                prMerged: options.createPR ? allTags.length > 0 : undefined,
                tree,
            };
            this.log.info({
                tag: result.tag || '(none - PR not merged)',
                prNumber,
                prMerged: result.prMerged,
            }, 'Workflow completed successfully');
            return (0, result_js_1.ok)(result);
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
            const absolutePath = config.path === '.'
                ? process.cwd()
                : config.path.startsWith('/')
                    ? config.path
                    : `${process.cwd()}/${config.path}`;
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
        const cwd = process.cwd();
        const updated = workspaces.map((workspace) => {
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
        const changedWorkspaces = updated.filter((w) => w.hasChanges);
        this.log.info({
            changedCount: changedWorkspaces.length,
            changedWorkspaceNames: changedWorkspaces.map((w) => w.name),
            totalWorkspaces: workspaces.length,
        }, 'Changed workspaces identified');
        return (0, result_js_1.ok)(changedWorkspaces);
    }
    async calculateVersions(workspaces, lastTag, branch) {
        this.log.debug({
            workspaceCount: workspaces.length,
            lastTag,
            branch,
        }, 'Calculating new versions');
        const base = lastTag || 'HEAD^';
        const commitsResult = await this.gitService.getCommitsSince(base, branch);
        if (!commitsResult.ok) {
            return (0, result_js_1.err)(commitsResult.error);
        }
        const commits = commitsResult.value;
        const commitMessages = commits.map((c) => c.message);
        this.log.debug({
            base,
            commitCount: commits.length,
            firstMessage: commitMessages[0],
            lastMessage: commitMessages[commitMessages.length - 1],
        }, 'Commits retrieved for version calculation');
        commits.forEach((c, index) => {
            const { sha, message } = c;
            this.log.debug({ sha, message }, `Commit #${index + 1} detail`);
        });
        const workspacesWithVersions = [];
        for (const workspace of workspaces) {
            const workspaceCommits = workspace.path === '.'
                ? commitMessages
                : commitMessages.filter(() => {
                    return true;
                });
            this.log.debug({ workspace: workspace.path, commits: workspaceCommits.length }, 'Workspace commit analysis');
            workspaceCommits.forEach((message) => this.log.debug({ message }, 'Workspace commit detail'));
            const analysis = (0, ConventionalCommitParser_js_1.parseCommitMessages)(workspaceCommits);
            let newVersion;
            if (analysis) {
                newVersion = this.versionService.calculateNewVersion(workspace.version, analysis);
                this.log.debug({ workspace: workspace.path, oldVersion: workspace.version, newVersion, bumpType: analysis.type }, 'Version calculated from commits');
            }
            else {
                newVersion = this.versionService.increaseVersion(workspace.version, 'patch');
                this.log.debug({ workspace: workspace.path, oldVersion: workspace.version, newVersion }, 'Version bumped (patch - no conventional commits)');
            }
            workspacesWithVersions.push({
                ...workspace,
                newVersion,
            });
        }
        return (0, result_js_1.ok)(workspacesWithVersions);
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
        const branch = options.branch || 'main';
        const base = options.lastTag || 'HEAD^';
        this.log.debug({ branch, base, hasLastTag: !!options.lastTag }, 'Getting commits for changelog');
        const commitsResult = await this.gitService.getCommitsSince(base, branch);
        if (!commitsResult.ok) {
            this.log.error({ error: commitsResult.error, branch, base }, 'Failed to get commits for changelog');
            return (0, result_js_1.err)(new errors_js_1.FileOperationError('CHANGELOG.md', 'generate', 'Failed to get commits for changelog generation', commitsResult.error));
        }
        this.log.debug({ rawCommitCount: commitsResult.value.length }, 'Raw commits retrieved');
        const commits = commitsResult.value;
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
    async configureGit() {
        try {
            let hasUserName = false;
            await exec.exec('git', ['config', 'user.name'], {
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        hasUserName = data.toString().trim().length > 0;
                    },
                },
            });
            if (!hasUserName) {
                await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
                this.log.debug('Configured git user.name');
            }
            let hasUserEmail = false;
            await exec.exec('git', ['config', 'user.email'], {
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        hasUserEmail = data.toString().trim().length > 0;
                    },
                },
            });
            if (!hasUserEmail) {
                await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
                this.log.debug('Configured git user.email');
            }
        }
        catch (error) {
            this.log.warn({ error }, 'Failed to configure git user, will proceed anyway');
        }
    }
    async createVersionCommit(tree) {
        this.log.debug({ version: tree.masterVersion }, 'Creating version commit');
        try {
            await this.configureGit();
            await exec.exec('git', ['add', '-A']);
            const commitMessage = `chore: bump version to ${tree.masterVersion}`;
            await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);
            let commitSha = '';
            await exec.exec('git', ['rev-parse', 'HEAD'], {
                listeners: {
                    stdout: (data) => {
                        commitSha += data.toString().trim();
                    },
                },
            });
            let branchName = '';
            await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                listeners: {
                    stdout: (data) => {
                        branchName += data.toString().trim();
                    },
                },
            });
            await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);
            this.log.info({ sha: commitSha, message: commitMessage }, 'Version commit created and pushed');
            return (0, result_js_1.ok)(commitSha);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('createVersionCommit', 'Failed to create version commit', error);
            this.log.error({ error: gitError }, 'Failed to create version commit');
            return (0, result_js_1.err)(gitError);
        }
    }
    async createVersionBranch(tree, options) {
        const randomSuffix = Math.floor(Math.random() * 10000).toString(36);
        const branchName = `${options.prOptions?.branchPrefix || 'version-bump'}/v${tree.masterVersion}-${randomSuffix}`;
        this.log.debug({ branch: branchName, version: tree.masterVersion }, 'Creating version branch');
        try {
            await this.configureGit();
            await exec.exec('git', ['checkout', '-b', branchName]);
            await exec.exec('git', ['add', '-A']);
            const commitMessage = `chore: bump version to ${tree.masterVersion}`;
            await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);
            await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);
            this.log.info({ branch: branchName, message: commitMessage }, 'Version branch created and pushed');
            return (0, result_js_1.ok)(branchName);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('createVersionBranch', 'Failed to create version branch', error);
            this.log.error({ error: gitError }, 'Failed to create version branch');
            return (0, result_js_1.err)(gitError);
        }
    }
    async createVersionPR(tree, options, branchName) {
        this.log.debug({ version: tree.masterVersion, branch: branchName }, 'Creating version PR');
        const title = `chore: bump version to ${tree.masterVersion}`;
        const body = PRService_js_1.PRService.buildPRBody(tree);
        const prResult = await this.prService.create({
            title,
            body,
            head: branchName,
            base: options.branch || 'main',
            draft: options.prOptions?.draft || false,
        });
        if (!prResult.ok) {
            return (0, result_js_1.err)(prResult.error);
        }
        const pr = prResult.value;
        this.log.info({ prNumber: pr.number, prUrl: pr.htmlUrl }, 'Version PR created');
        let merged = false;
        let mergeCommitSha;
        if (options.prOptions?.autoMerge) {
            this.log.debug({ prNumber: pr.number }, 'Waiting for PR checks to complete');
            const checksResult = await this.prService.waitForChecks({
                prNumber: pr.number,
                timeout: 300000,
                interval: 10000,
            });
            if (!checksResult.ok) {
                this.log.error({ prNumber: pr.number, error: checksResult.error.message }, 'Failed to wait for PR checks');
                return (0, result_js_1.err)(checksResult.error);
            }
            const checksStatus = checksResult.value;
            if (!checksStatus.allPassed) {
                const checkError = new Error(`PR checks did not pass. Failed checks: ${checksStatus.failedCheckNames?.join(', ') || 'unknown'}`);
                this.log.error({
                    prNumber: pr.number,
                    failedChecks: checksStatus.failedChecks,
                    failedCheckNames: checksStatus.failedCheckNames,
                    mergeableState: checksStatus.mergeableState,
                }, 'PR checks failed');
                return (0, result_js_1.err)(checkError);
            }
            this.log.info({ prNumber: pr.number }, 'All PR checks passed, proceeding with merge');
            const mergeResult = await this.prService.merge({
                prNumber: pr.number,
                mergeMethod: 'squash',
            });
            if (!mergeResult.ok) {
                this.log.warn({ prNumber: pr.number }, 'Auto-merge failed - PR remains open');
                merged = false;
            }
            else {
                merged = true;
                mergeCommitSha = mergeResult.value.sha;
                this.log.info({ prNumber: pr.number, mergeCommitSha }, 'PR auto-merged');
                try {
                    await this.githubService.deleteBranch(branchName);
                    this.log.info({ branch: branchName }, 'Version branch deleted after merge');
                }
                catch (error) {
                    this.log.warn({ branch: branchName, error }, 'Failed to delete branch after merge');
                }
            }
        }
        else {
            this.log.info({ prNumber: pr.number }, 'PR created without auto-merge - waiting for manual merge');
        }
        return (0, result_js_1.ok)({
            number: pr.number,
            merged,
            mergeCommitSha,
        });
    }
    async createVersionTags(tree, options, providedCommitSha) {
        this.log.debug('Creating version tags');
        const createdTags = [];
        let commitSha;
        if (providedCommitSha) {
            commitSha = providedCommitSha;
            this.log.debug({ commitSha }, 'Using provided commit SHA');
        }
        else {
            const branch = options.branch || 'main';
            const branchRef = `heads/${branch}`;
            const refResult = await this.gitService.getRef(branchRef);
            if (!refResult.ok) {
                this.log.error({ branch: branchRef }, 'Failed to get current branch HEAD SHA');
                return (0, result_js_1.err)(refResult.error);
            }
            commitSha = refResult.value.sha;
            this.log.debug({ commitSha, branch: branchRef }, 'Retrieved current HEAD SHA');
        }
        const masterTag = `v${tree.masterVersion}`;
        const masterTagResult = await this.gitService.createTag({
            tagName: masterTag,
            message: `Release ${tree.masterVersion}`,
            commitSha,
        });
        if (!masterTagResult.ok) {
            return (0, result_js_1.err)(masterTagResult.error);
        }
        createdTags.push(masterTag);
        this.log.debug({ tag: masterTag }, 'Master tag created');
        if (options.tagOptions?.shortTag) {
            const parts = tree.masterVersion.split('.');
            const shortTag = parts.length >= 2 ? `v${parts[0]}` : masterTag;
            if (shortTag !== masterTag) {
                const shortTagExists = await this.gitService.tagExists(shortTag);
                if (shortTagExists.ok && shortTagExists.value) {
                    this.log.debug({ tag: shortTag }, 'Short tag already exists and will be updated to latest version');
                    const deleteResult = await this.gitService.deleteTag(shortTag);
                    if (!deleteResult.ok) {
                        this.log.warn({ tag: shortTag, error: deleteResult.error }, 'Failed to delete existing short tag');
                    }
                }
                else {
                    this.log.debug({ tag: shortTag }, 'Short tag does not exist and will be created');
                }
                const shortTagResult = await this.gitService.createTag({
                    tagName: shortTag,
                    message: `Release ${shortTag} (latest: ${tree.masterVersion})`,
                    commitSha,
                });
                if (!shortTagResult.ok) {
                    this.log.warn({ tag: shortTag, version: tree.masterVersion }, 'Failed to create/update short tag');
                }
                else {
                    createdTags.push(shortTag);
                    this.log.info({ tag: shortTag, pointsTo: tree.masterVersion }, 'Short tag created/updated to point to latest version');
                }
            }
        }
        this.log.info({ tagCount: createdTags.length, tags: createdTags }, 'Tags created');
        return (0, result_js_1.ok)(createdTags);
    }
}
exports.WorkspaceManager = WorkspaceManager;
//# sourceMappingURL=WorkspaceManager.js.map