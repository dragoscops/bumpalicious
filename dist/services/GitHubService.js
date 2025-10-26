"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const github_1 = require("@actions/github");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
const retry_js_1 = require("../utils/retry.js");
class GitHubService extends Loggable_js_1.Loggable {
    octokit;
    repository;
    retryOptions;
    constructor(token, config) {
        super();
        this.octokit = (0, github_1.getOctokit)(token);
        this.repository = config.repository;
        this.retryOptions = config.retryOptions ?? {};
        this.log.info({
            owner: this.repository.owner,
            repo: this.repository.repo,
        }, 'GitHubService initialized');
    }
    getOctokit() {
        this.log.debug('Returning Octokit instance for direct API access');
        return this.octokit;
    }
    getRepository() {
        this.log.debug({
            owner: this.repository.owner,
            repo: this.repository.repo,
        }, 'Returning repository context');
        return { ...this.repository };
    }
    async executeWithRetry(operationName, operation) {
        this.log.debug({
            operation: operationName,
            retryOptions: this.retryOptions,
        }, 'Executing GitHub API operation with retry logic');
        try {
            const result = await (0, retry_js_1.retry)(async () => {
                try {
                    return await operation(this.octokit);
                }
                catch (error) {
                    throw this.wrapGitHubError(operationName, error);
                }
            }, {
                ...this.retryOptions,
                operationName,
            });
            this.log.debug({
                operation: operationName,
            }, 'GitHub API operation succeeded');
            return result;
        }
        catch (error) {
            if (error instanceof errors_js_1.GitHubAPIError) {
                this.log.error({
                    code: error.code,
                    statusCode: error.statusCode,
                    message: error.message,
                }, `GitHub API operation failed: ${operationName}`);
                throw error;
            }
            const wrapped = this.wrapGitHubError(operationName, error);
            this.log.error({
                code: wrapped.code,
                message: wrapped.message,
            }, `GitHub API operation failed: ${operationName}`);
            throw wrapped;
        }
    }
    async getRateLimit() {
        this.log.debug('Fetching GitHub API rate limit information');
        try {
            const response = await this.octokit.rest.rateLimit.get();
            const rateLimit = {
                limit: response.data.rate.limit,
                remaining: response.data.rate.remaining,
                reset: response.data.rate.reset,
                used: response.data.rate.used,
            };
            this.log.debug({
                ...rateLimit,
                resetAt: new Date(rateLimit.reset * 1000).toISOString(),
            }, 'Rate limit information retrieved');
            return rateLimit;
        }
        catch (error) {
            throw this.wrapGitHubError('getRateLimit', error);
        }
    }
    async checkRateLimit(threshold = 10) {
        this.log.debug({
            threshold,
        }, 'Checking rate limit against threshold');
        try {
            const rateLimit = await this.getRateLimit();
            if (rateLimit.remaining < threshold) {
                this.log.debug({
                    remaining: rateLimit.remaining,
                    threshold,
                }, 'Rate limit below threshold, calculating wait time');
                const resetDate = new Date(rateLimit.reset * 1000);
                const waitMs = resetDate.getTime() - Date.now();
                if (waitMs > 0) {
                    this.log.warn({
                        remaining: rateLimit.remaining,
                        resetAt: resetDate.toISOString(),
                        waitMs,
                    }, 'Rate limit approaching, waiting for reset');
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                    this.log.info('Rate limit reset, continuing');
                    return true;
                }
            }
            this.log.debug({
                remaining: rateLimit.remaining,
                threshold,
            }, 'Rate limit sufficient, no waiting required');
            return false;
        }
        catch (error) {
            this.log.warn({ error }, 'Failed to check rate limit');
            return false;
        }
    }
    async deleteBranch(branchName) {
        this.log.debug({ branchName }, 'Deleting branch');
        try {
            await this.executeWithRetry('deleteBranch', (octokit) => octokit.rest.git.deleteRef({
                owner: this.repository.owner,
                repo: this.repository.repo,
                ref: `heads/${branchName}`,
            }));
            this.log.info({ branchName }, 'Branch deleted successfully');
        }
        catch (error) {
            const apiError = error instanceof errors_js_1.GitHubAPIError
                ? error
                : new errors_js_1.GitHubAPIError('deleteBranch', 'Failed to delete branch', undefined, error);
            this.log.error({
                operation: 'deleteBranch',
                branchName,
                error: apiError.message,
                statusCode: apiError.statusCode,
            }, 'Failed to delete branch');
            throw apiError;
        }
    }
    wrapGitHubError(operation, error) {
        if (error instanceof errors_js_1.GitHubAPIError) {
            this.log.debug({
                operation,
                errorCode: error.code,
            }, 'Error already wrapped as GitHubAPIError');
            return error;
        }
        let statusCode;
        let message;
        if (error && typeof error === 'object' && 'status' in error) {
            statusCode = typeof error.status === 'number' ? error.status : undefined;
        }
        if (error instanceof Error) {
            message = error.message;
        }
        else {
            message = String(error);
        }
        this.log.debug({
            operation,
            statusCode,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
        }, 'Wrapping error as GitHubAPIError');
        return new errors_js_1.GitHubAPIError(operation, message, statusCode, error);
    }
}
exports.GitHubService = GitHubService;
//# sourceMappingURL=GitHubService.js.map