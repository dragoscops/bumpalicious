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
        this.log.info({ ...github.getRepository() }, 'PRService initialized');
    }
    async create(params) {
        this.log.debug({
            title: params.title,
            base: params.base,
            head: params.head,
            draft: params.draft ?? false,
            bodyLength: params.body.length,
        }, 'Creating PR');
        try {
            const response = await this.createPR(params);
            const result = this.mapCreateResponse(response.data);
            this.log.info({ prNumber: result.number, htmlUrl: result.htmlUrl, state: result.state, title: params.title }, 'PR created');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            return this.handleError('createPR', 'Failed to create pull request', error, {
                title: params.title,
                base: params.base,
                head: params.head,
            });
        }
    }
    async merge(params) {
        this.log.debug({ prNumber: params.prNumber, mergeMethod: params.mergeMethod ?? 'merge', hasCommitTitle: !!params.commitTitle }, 'Merging PR');
        try {
            const response = await this.mergePR(params);
            const result = this.mapMergeResponse(response.data);
            this.log.info({
                prNumber: params.prNumber,
                merged: result.merged,
                sha: result.sha,
                mergeMethod: params.mergeMethod ?? 'merge',
            }, 'PR merged');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            return this.handleError('mergePR', 'Failed to merge pull request', error, {
                prNumber: params.prNumber,
                mergeMethod: params.mergeMethod ?? 'merge',
            });
        }
    }
    async getPullRequest(prNumber) {
        this.log.debug({ prNumber }, 'Getting PR details');
        try {
            const response = await this.fetchPR(prNumber);
            const result = {
                headRef: response.data.head.ref,
                baseRef: response.data.base.ref,
                merged: response.data.merged,
                state: response.data.state,
            };
            this.log.info({ prNumber, headRef: result.headRef, merged: result.merged, state: result.state }, 'PR details retrieved');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            return this.handleError('getPullRequest', 'Failed to get pull request details', error, { prNumber });
        }
    }
    async hasMerged(params) {
        const timeout = params.timeout ?? 60000;
        const interval = params.interval ?? 5000;
        const startTime = Date.now();
        this.log.debug({ prNumber: params.prNumber, timeout, interval }, 'Polling for merge status');
        try {
            return await this.pollUntilMerged(params.prNumber, timeout, interval, startTime);
        }
        catch (error) {
            return this.handleError('hasMerged', 'Failed to check if pull request is merged', error, {
                prNumber: params.prNumber,
                elapsedMs: Date.now() - startTime,
            });
        }
    }
    async exists(params) {
        this.log.debug({ base: params.base, head: params.head }, 'Checking PR existence');
        try {
            const response = await this.listPRs(params);
            if (response.data.length > 0) {
                const pr = response.data[0];
                this.log.info({ prNumber: pr.number, state: pr.state }, 'PR exists');
                return (0, result_js_1.ok)({ exists: true, number: pr.number, state: pr.state });
            }
            this.log.info({ base: params.base, head: params.head }, 'No PR found');
            return (0, result_js_1.ok)({ exists: false });
        }
        catch (error) {
            return this.handleError('existsPR', 'Failed to check if pull request exists', error, {
                base: params.base,
                head: params.head,
            });
        }
    }
    async waitForChecks(params) {
        const timeout = params.timeout ?? 300000;
        const interval = params.interval ?? 10000;
        const startTime = Date.now();
        this.log.debug({ prNumber: params.prNumber, timeout, interval }, 'Waiting for checks');
        try {
            return await this.pollUntilChecksComplete(params.prNumber, timeout, interval, startTime);
        }
        catch (error) {
            return this.handleError('waitForChecks', 'Failed to check PR status', error, { prNumber: params.prNumber });
        }
    }
    async pollUntilMerged(prNumber, timeout, interval, startTime) {
        while (Date.now() - startTime < timeout) {
            const response = await this.fetchPR(prNumber);
            if (response.data.merged) {
                this.log.info({ prNumber, mergedAt: response.data.merged_at }, 'PR merged');
                return (0, result_js_1.ok)(true);
            }
            if (response.data.state === 'closed' && !response.data.merged) {
                this.log.info({ prNumber, state: response.data.state }, 'PR closed but not merged');
                return (0, result_js_1.ok)(false);
            }
            await this.wait(interval);
        }
        this.log.warn({ prNumber, timeout, elapsed: Date.now() - startTime }, 'Timeout waiting for merge');
        return (0, result_js_1.ok)(false);
    }
    async pollUntilChecksComplete(prNumber, timeout, interval, startTime) {
        while (Date.now() - startTime < timeout) {
            const pr = await this.fetchPR(prNumber);
            const headSha = pr.data.head.sha;
            const mergeableState = pr.data.mergeable_state || 'unknown';
            this.log.debug({ prNumber, mergeableState, mergeable: pr.data.mergeable, headSha }, 'PR status checked');
            const checksStatus = await this.getChecksStatus(headSha, mergeableState);
            if (checksStatus.failedChecks > 0) {
                this.log.warn({ prNumber, failedChecks: checksStatus.failedChecks, failedCheckNames: checksStatus.failedCheckNames }, 'Checks failed');
                return (0, result_js_1.ok)(checksStatus);
            }
            if (checksStatus.allPassed || checksStatus.totalChecks === 0) {
                this.log.info({ prNumber, totalChecks: checksStatus.totalChecks, passedChecks: checksStatus.passedChecks }, 'All checks passed');
                return (0, result_js_1.ok)(checksStatus);
            }
            this.log.debug({ prNumber, pendingChecks: checksStatus.totalChecks - checksStatus.passedChecks }, 'Checks pending');
            await this.wait(interval);
        }
        return (0, result_js_1.err)(new errors_js_1.GitHubAPIError('waitForChecks', `Timeout waiting for PR checks after ${timeout}ms`, undefined));
    }
    async getChecksStatus(headSha, mergeableState) {
        const { owner, repo } = this.github.getRepository();
        const [statusResponse, checkRunsResponse] = await Promise.all([
            this.github.executeWithRetry('getCombinedStatus', (octokit) => octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: headSha })),
            this.github.executeWithRetry('listCheckRuns', (octokit) => octokit.rest.checks.listForRef({ owner, repo, ref: headSha })),
        ]);
        const statusChecks = statusResponse.data.statuses;
        const checkRuns = checkRunsResponse.data.check_runs;
        const statusStats = this.countStatusChecks(statusChecks);
        const checkRunStats = this.countCheckRuns(checkRuns);
        const totalChecks = statusStats.total + checkRunStats.total;
        const passedChecks = statusStats.passed + checkRunStats.passed;
        const failedChecks = statusStats.failed + checkRunStats.failed;
        const pendingChecks = statusStats.pending + checkRunStats.pending;
        const failedCheckNames = [
            ...statusChecks.filter((s) => s.state === 'failure' || s.state === 'error').map((s) => s.context),
            ...checkRuns
                .filter((c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out')
                .map((c) => c.name),
        ];
        return {
            allPassed: pendingChecks === 0 && failedChecks === 0 && totalChecks > 0,
            pending: pendingChecks > 0,
            totalChecks,
            passedChecks,
            failedChecks,
            mergeableState,
            failedCheckNames: failedCheckNames.length > 0 ? failedCheckNames : undefined,
        };
    }
    countStatusChecks(statuses) {
        return {
            total: statuses.length,
            passed: statuses.filter((s) => s.state === 'success').length,
            failed: statuses.filter((s) => s.state === 'failure' || s.state === 'error').length,
            pending: statuses.filter((s) => s.state === 'pending').length,
        };
    }
    countCheckRuns(checkRuns) {
        return {
            total: checkRuns.length,
            passed: checkRuns.filter((c) => c.conclusion === 'success').length,
            failed: checkRuns.filter((c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out').length,
            pending: checkRuns.filter((c) => c.status !== 'completed').length,
        };
    }
    async createPR(params) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('createPR', (octokit) => octokit.rest.pulls.create({
            owner,
            repo,
            title: params.title,
            body: params.body,
            base: params.base,
            head: params.head,
            draft: params.draft ?? false,
        }));
    }
    async mergePR(params) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('mergePR', (octokit) => octokit.rest.pulls.merge({
            owner,
            repo,
            pull_number: params.prNumber,
            merge_method: params.mergeMethod ?? 'merge',
            commit_title: params.commitTitle,
            commit_message: params.commitMessage,
        }));
    }
    async fetchPR(prNumber) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('getPullRequest', (octokit) => octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }));
    }
    async listPRs(params) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('listPRs', (octokit) => octokit.rest.pulls.list({ owner, repo, state: 'open', base: params.base, head: `${owner}:${params.head}` }));
    }
    mapCreateResponse(data) {
        return { number: data.number, htmlUrl: data.html_url, state: data.state };
    }
    mapMergeResponse(data) {
        return { merged: data.merged, sha: data.sha, message: data.message };
    }
    async wait(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    handleError(operation, message, error, context) {
        const apiError = error instanceof errors_js_1.GitHubAPIError ? error : new errors_js_1.GitHubAPIError(operation, message, undefined, error);
        this.log.error({ operation, error: apiError.message, statusCode: apiError.statusCode, ...context }, `${operation} failed`);
        return (0, result_js_1.err)(apiError);
    }
    static buildPRBody(tree) {
        const sections = [
            `# Version Update: ${tree.root.workspace.name} ${tree.masterVersion}`,
            '',
            '## 📦 Workspace Versions',
            '',
            `### 🏠 Root: ${tree.root.workspace.name}`,
            `**Version**: \`${tree.root.workspace.version}\`  `,
            `**Path**: \`${tree.root.workspace.path}\`  `,
            `**Type**: \`${tree.root.workspace.type}\`  `,
            '',
        ];
        if (tree.root.children.length > 0) {
            sections.push('### 📁 Child Workspaces', '');
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