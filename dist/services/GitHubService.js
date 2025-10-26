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
        this.log.info({ owner: this.repository.owner, repo: this.repository.repo }, 'GitHubService initialized');
    }
    getOctokit() {
        this.log.debug('Returning Octokit instance for direct API access');
        return this.octokit;
    }
    getRepository() {
        this.log.debug({ owner: this.repository.owner, repo: this.repository.repo }, 'Returning repository context');
        return { ...this.repository };
    }
    async executeWithRetry(operationName, operation) {
        this.log.debug({ operation: operationName, retryOptions: this.retryOptions }, 'Executing with retry');
        try {
            const result = await this.executeOperation(operationName, operation);
            this.log.debug({ operation: operationName }, 'Operation succeeded');
            return result;
        }
        catch (error) {
            return this.handleOperationError(operationName, error);
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
            this.log.info({ branchName }, 'Branch deleted');
        }
        catch (error) {
            throw this.wrapDeleteBranchError(branchName, error);
        }
    }
    async getRateLimit() {
        this.log.debug('Fetching rate limit');
        try {
            const response = await this.octokit.rest.rateLimit.get();
            const rateLimit = {
                limit: response.data.rate.limit,
                remaining: response.data.rate.remaining,
                reset: response.data.rate.reset,
                used: response.data.rate.used,
            };
            this.log.debug({ ...rateLimit, resetAt: new Date(rateLimit.reset * 1000).toISOString() }, 'Rate limit retrieved');
            return rateLimit;
        }
        catch (error) {
            throw this.wrapGitHubError('getRateLimit', error);
        }
    }
    async checkRateLimit(threshold = 10) {
        this.log.debug({ threshold }, 'Checking rate limit');
        try {
            const rateLimit = await this.getRateLimit();
            if (rateLimit.remaining >= threshold) {
                this.log.debug({ remaining: rateLimit.remaining, threshold }, 'Rate limit sufficient');
                return false;
            }
            return await this.waitForRateLimitReset(rateLimit);
        }
        catch (error) {
            this.log.warn({ error }, 'Failed to check rate limit');
            return false;
        }
    }
    async waitForRateLimitReset(rateLimit) {
        const resetDate = new Date(rateLimit.reset * 1000);
        const waitMs = resetDate.getTime() - Date.now();
        if (waitMs <= 0)
            return false;
        this.log.warn({ remaining: rateLimit.remaining, resetAt: resetDate.toISOString(), waitMs }, 'Rate limit approaching, waiting');
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        this.log.info('Rate limit reset');
        return true;
    }
    async executeOperation(operationName, operation) {
        return (0, retry_js_1.retry)(async () => {
            try {
                return await operation(this.octokit);
            }
            catch (error) {
                throw this.wrapGitHubError(operationName, error);
            }
        }, { ...this.retryOptions, operationName });
    }
    handleOperationError(operationName, error) {
        const wrapped = error instanceof errors_js_1.GitHubAPIError ? error : this.wrapGitHubError(operationName, error);
        this.log.error({ code: wrapped.code, statusCode: wrapped.statusCode, message: wrapped.message }, `Operation failed: ${operationName}`);
        throw wrapped;
    }
    wrapGitHubError(operation, error) {
        if (error instanceof errors_js_1.GitHubAPIError) {
            this.log.debug({ operation, errorCode: error.code }, 'Error already wrapped');
            return error;
        }
        const statusCode = this.extractStatusCode(error);
        const message = error instanceof Error ? error.message : String(error);
        this.log.debug({ operation, statusCode, errorType: error instanceof Error ? error.constructor.name : typeof error }, 'Wrapping error');
        return new errors_js_1.GitHubAPIError(operation, message, statusCode, error);
    }
    wrapDeleteBranchError(branchName, error) {
        const apiError = error instanceof errors_js_1.GitHubAPIError
            ? error
            : new errors_js_1.GitHubAPIError('deleteBranch', 'Failed to delete branch', undefined, error);
        this.log.error({ operation: 'deleteBranch', branchName, error: apiError.message, statusCode: apiError.statusCode }, 'Branch deletion failed');
        throw apiError;
    }
    extractStatusCode(error) {
        if (error && typeof error === 'object' && 'status' in error) {
            return typeof error.status === 'number' ? error.status : undefined;
        }
        return undefined;
    }
}
exports.GitHubService = GitHubService;
//# sourceMappingURL=GitHubService.js.map