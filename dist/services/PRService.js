"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRService = void 0;
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class PRService extends Loggable_js_1.Loggable {
    github;
    constructor(github) {
        super();
        this.github = github;
        this.log.info({
            ...github.getRepository(),
        }, 'PRService initialized');
    }
    async create(params) {
        this.log.debug({
            title: params.title,
            base: params.base,
            head: params.head,
            draft: params.draft ?? false,
            bodyLength: params.body.length,
        }, 'Creating pull request');
        try {
            const { owner, repo } = this.github.getRepository();
            const response = await this.github.executeWithRetry('createPR', (octokit) => octokit.rest.pulls.create({
                owner,
                repo,
                title: params.title,
                body: params.body,
                base: params.base,
                head: params.head,
                draft: params.draft ?? false,
            }));
            const result = {
                number: response.data.number,
                htmlUrl: response.data.html_url,
                state: response.data.state,
            };
            this.log.info({
                prNumber: result.number,
                htmlUrl: result.htmlUrl,
                state: result.state,
                title: params.title,
            }, 'Pull request created successfully');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('createPR', 'Failed to create pull request', undefined, error);
            this.log.error({
                operation: 'createPR',
                title: params.title,
                base: params.base,
                head: params.head,
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to create pull request');
            return (0, result_js_1.err)(apiError);
        }
    }
    async merge(params) {
        this.log.debug({
            prNumber: params.prNumber,
            mergeMethod: params.mergeMethod ?? 'merge',
            hasCommitTitle: !!params.commitTitle,
            hasCommitMessage: !!params.commitMessage,
        }, 'Merging pull request');
        try {
            const { owner, repo } = this.github.getRepository();
            const response = await this.github.executeWithRetry('mergePR', (octokit) => octokit.rest.pulls.merge({
                owner,
                repo,
                pull_number: params.prNumber,
                merge_method: params.mergeMethod ?? 'merge',
                commit_title: params.commitTitle,
                commit_message: params.commitMessage,
            }));
            const result = {
                merged: response.data.merged,
                sha: response.data.sha,
                message: response.data.message,
            };
            this.log.info({
                prNumber: params.prNumber,
                merged: result.merged,
                sha: result.sha,
                mergeMethod: params.mergeMethod ?? 'merge',
            }, 'Pull request merged successfully');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('mergePR', 'Failed to merge pull request', undefined, error);
            this.log.error({
                operation: 'mergePR',
                prNumber: params.prNumber,
                mergeMethod: params.mergeMethod ?? 'merge',
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to merge pull request');
            return (0, result_js_1.err)(apiError);
        }
    }
    async hasMerged(params) {
        const timeout = params.timeout ?? 60000;
        const interval = params.interval ?? 5000;
        const startTime = Date.now();
        this.log.debug({
            prNumber: params.prNumber,
            timeout,
            interval,
        }, 'Starting merge status polling');
        try {
            const { owner, repo } = this.github.getRepository();
            while (Date.now() - startTime < timeout) {
                const response = await this.github.executeWithRetry('getPR', (octokit) => octokit.rest.pulls.get({
                    owner,
                    repo,
                    pull_number: params.prNumber,
                }));
                if (response.data.merged) {
                    this.log.info({
                        prNumber: params.prNumber,
                        mergedAt: response.data.merged_at,
                    }, 'Pull request has been merged');
                    return (0, result_js_1.ok)(true);
                }
                if (response.data.state === 'closed' && !response.data.merged) {
                    this.log.info({
                        prNumber: params.prNumber,
                        state: response.data.state,
                    }, 'Pull request is closed but not merged');
                    return (0, result_js_1.ok)(false);
                }
                await new Promise((resolve) => setTimeout(resolve, interval));
            }
            this.log.warn({
                prNumber: params.prNumber,
                timeout,
                elapsed: Date.now() - startTime,
            }, 'Timeout reached while waiting for PR to merge');
            return (0, result_js_1.ok)(false);
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('hasMerged', 'Failed to check if pull request is merged', undefined, error);
            this.log.error({
                operation: 'hasMerged',
                prNumber: params.prNumber,
                elapsedMs: Date.now() - startTime,
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to check PR merge status');
            return (0, result_js_1.err)(apiError);
        }
    }
    async exists(params) {
        this.log.debug({
            base: params.base,
            head: params.head,
        }, 'Checking if pull request exists');
        try {
            const { owner, repo } = this.github.getRepository();
            const response = await this.github.executeWithRetry('listPRs', (octokit) => octokit.rest.pulls.list({
                owner,
                repo,
                state: 'open',
                base: params.base,
                head: `${owner}:${params.head}`,
            }));
            if (response.data.length > 0) {
                const pr = response.data[0];
                const result = {
                    exists: true,
                    number: pr.number,
                    state: pr.state,
                };
                this.log.info({
                    prNumber: result.number,
                    state: result.state,
                }, 'Pull request exists');
                return (0, result_js_1.ok)(result);
            }
            this.log.info({
                base: params.base,
                head: params.head,
            }, 'No pull request found');
            return (0, result_js_1.ok)({ exists: false });
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('existsPR', 'Failed to check if pull request exists', undefined, error);
            this.log.error({
                operation: 'existsPR',
                base: params.base,
                head: params.head,
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to check PR existence');
            return (0, result_js_1.err)(apiError);
        }
    }
    async waitForChecks(params) {
        const timeout = params.timeout ?? 300000;
        const interval = params.interval ?? 10000;
        const startTime = Date.now();
        this.log.debug({
            prNumber: params.prNumber,
            timeout,
            interval,
        }, 'Waiting for PR checks to complete');
        try {
            const { owner, repo } = this.github.getRepository();
            while (Date.now() - startTime < timeout) {
                const prResponse = await this.github.executeWithRetry('getPR', (octokit) => octokit.rest.pulls.get({
                    owner,
                    repo,
                    pull_number: params.prNumber,
                }));
                const pr = prResponse.data;
                const headSha = pr.head.sha;
                const mergeableState = pr.mergeable_state || 'unknown';
                this.log.debug({
                    prNumber: params.prNumber,
                    mergeableState,
                    mergeable: pr.mergeable,
                    headSha,
                }, 'PR status checked');
                const statusResponse = await this.github.executeWithRetry('getCombinedStatus', (octokit) => octokit.rest.repos.getCombinedStatusForRef({
                    owner,
                    repo,
                    ref: headSha,
                }));
                const combinedStatus = statusResponse.data;
                const checkRunsResponse = await this.github.executeWithRetry('listCheckRuns', (octokit) => octokit.rest.checks.listForRef({
                    owner,
                    repo,
                    ref: headSha,
                }));
                const checkRuns = checkRunsResponse.data.check_runs;
                const statusChecks = combinedStatus.statuses;
                const totalStatusChecks = statusChecks.length;
                const totalCheckRuns = checkRuns.length;
                const totalChecks = totalStatusChecks + totalCheckRuns;
                const passedStatusChecks = statusChecks.filter((s) => s.state === 'success').length;
                const failedStatusChecks = statusChecks.filter((s) => s.state === 'failure' || s.state === 'error').length;
                const pendingStatusChecks = statusChecks.filter((s) => s.state === 'pending').length;
                const passedCheckRuns = checkRuns.filter((c) => c.conclusion === 'success').length;
                const failedCheckRuns = checkRuns.filter((c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out').length;
                const pendingCheckRuns = checkRuns.filter((c) => c.status !== 'completed').length;
                const passedChecks = passedStatusChecks + passedCheckRuns;
                const failedChecks = failedStatusChecks + failedCheckRuns;
                const pendingChecks = pendingStatusChecks + pendingCheckRuns;
                const failedCheckNames = [
                    ...statusChecks.filter((s) => s.state === 'failure' || s.state === 'error').map((s) => s.context),
                    ...checkRuns
                        .filter((c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out')
                        .map((c) => c.name),
                ];
                this.log.debug({
                    prNumber: params.prNumber,
                    totalChecks,
                    passedChecks,
                    failedChecks,
                    pendingChecks,
                    mergeableState,
                    combinedState: combinedStatus.state,
                }, 'Checks status');
                const noChecks = totalChecks === 0;
                const allComplete = pendingChecks === 0 && totalChecks > 0;
                const allPassed = allComplete && failedChecks === 0;
                if (failedChecks > 0) {
                    const result = {
                        allPassed: false,
                        pending: false,
                        totalChecks,
                        passedChecks,
                        failedChecks,
                        mergeableState,
                        failedCheckNames,
                    };
                    this.log.warn({
                        prNumber: params.prNumber,
                        failedChecks,
                        failedCheckNames,
                    }, 'PR checks failed');
                    return (0, result_js_1.ok)(result);
                }
                if (allPassed || noChecks) {
                    const result = {
                        allPassed: true,
                        pending: false,
                        totalChecks,
                        passedChecks,
                        failedChecks: 0,
                        mergeableState,
                    };
                    this.log.info({
                        prNumber: params.prNumber,
                        totalChecks,
                        passedChecks,
                        noChecks,
                    }, 'All PR checks passed');
                    return (0, result_js_1.ok)(result);
                }
                this.log.debug({
                    prNumber: params.prNumber,
                    pendingChecks,
                    waitingMs: interval,
                }, 'Checks still pending, waiting...');
                await new Promise((resolve) => setTimeout(resolve, interval));
            }
            const apiError = new errors_js_1.GitHubAPIError('waitForChecks', `Timeout waiting for PR checks to complete after ${timeout}ms`, undefined);
            this.log.error({
                operation: 'waitForChecks',
                prNumber: params.prNumber,
                timeout,
            }, 'Timeout waiting for PR checks');
            return (0, result_js_1.err)(apiError);
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('waitForChecks', 'Failed to check PR status', undefined, error);
            this.log.error({
                operation: 'waitForChecks',
                prNumber: params.prNumber,
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to wait for PR checks');
            return (0, result_js_1.err)(apiError);
        }
    }
    async getPullRequest(prNumber) {
        this.log.debug({ prNumber }, 'Getting pull request details');
        try {
            const { owner, repo } = this.github.getRepository();
            const response = await this.github.executeWithRetry('getPullRequest', (octokit) => octokit.rest.pulls.get({
                owner,
                repo,
                pull_number: prNumber,
            }));
            const result = {
                headRef: response.data.head.ref,
                baseRef: response.data.base.ref,
                merged: response.data.merged,
                state: response.data.state,
            };
            this.log.info({
                prNumber,
                headRef: result.headRef,
                merged: result.merged,
                state: result.state,
            }, 'Pull request details retrieved');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('getPullRequest', 'Failed to get pull request details', undefined, error);
            this.log.error({
                operation: 'getPullRequest',
                prNumber,
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to get pull request details');
            return (0, result_js_1.err)(apiError);
        }
    }
    static buildPRBody(tree) {
        const sections = [
            `# Version Update: ${tree.root.workspace.name} ${tree.masterVersion}`,
            '',
            '## 📦 Workspace Versions',
            '',
        ];
        sections.push(`### 🏠 Root: ${tree.root.workspace.name}`);
        sections.push(`**Version**: \`${tree.root.workspace.version}\`  `);
        sections.push(`**Path**: \`${tree.root.workspace.path}\`  `);
        sections.push(`**Type**: \`${tree.root.workspace.type}\`  `);
        sections.push('');
        if (tree.root.children.length > 0) {
            sections.push('### 📁 Child Workspaces');
            sections.push('');
            for (const child of tree.root.children) {
                sections.push(...PRService.formatWorkspaceNode(child, 0));
            }
        }
        return sections.join('\n');
    }
    static formatWorkspaceNode(node, indentLevel) {
        const indent = '  '.repeat(indentLevel);
        const changeIndicator = node.workspace.hasChanges ? '🔄' : '✓';
        const lines = [
            `${indent}- ${changeIndicator} **${node.workspace.name}** \`${node.workspace.version}\``,
            `${indent}  - Path: \`${node.workspace.path}\``,
            `${indent}  - Type: \`${node.workspace.type}\``,
        ];
        if (node.children.length > 0) {
            for (const child of node.children) {
                lines.push(...PRService.formatWorkspaceNode(child, indentLevel + 1));
            }
        }
        return lines;
    }
}
exports.PRService = PRService;
//# sourceMappingURL=PRService.js.map