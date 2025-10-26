"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryService = void 0;
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const logger_js_1 = require("../utils/logger.js");
class RepositoryService {
    github;
    constructor(github) {
        this.github = github;
        logger_js_1.logger.debug('RepositoryService initialized');
    }
    async getFileContent(params) {
        try {
            const { path, ref } = params;
            const { owner, repo } = this.github.getRepository();
            logger_js_1.logger.debug({ path, ref }, 'Getting file content');
            const response = await this.github.executeWithRetry('getContent', (octokit) => octokit.rest.repos.getContent({
                owner,
                repo,
                path,
                ref,
            }));
            if (!('content' in response.data) || Array.isArray(response.data)) {
                const error = new errors_js_1.GitOperationError('getFileContent', `Path ${path} is not a file`, undefined);
                logger_js_1.logger.error({ path }, 'Path is not a file');
                return (0, result_js_1.err)(error);
            }
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            const fileContent = {
                path: response.data.path,
                content,
                encoding: 'utf-8',
                sha: response.data.sha,
                size: response.data.size,
            };
            logger_js_1.logger.info({ path, size: fileContent.size }, 'File content retrieved successfully');
            return (0, result_js_1.ok)(fileContent);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getFileContent', `Failed to get content for ${params.path}`, error);
            logger_js_1.logger.error({ error: gitError, path: params.path }, 'Failed to get file content');
            return (0, result_js_1.err)(gitError);
        }
    }
    async updateFile(params) {
        try {
            const { path, content, message, sha, branch } = params;
            const { owner, repo } = this.github.getRepository();
            logger_js_1.logger.debug({ path, message, branch }, 'Updating file');
            const encodedContent = Buffer.from(content, 'utf-8').toString('base64');
            const response = await this.github.executeWithRetry('updateFile', (octokit) => octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message,
                content: encodedContent,
                sha,
                branch,
            }));
            const result = {
                sha: response.data.content?.sha || '',
                commit: {
                    sha: response.data.commit.sha || '',
                    message: response.data.commit.message || message,
                },
            };
            logger_js_1.logger.info({
                path,
                commitSha: result.commit.sha,
                fileSha: result.sha,
            }, 'File updated successfully');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('updateFile', `Failed to update file ${params.path}`, error);
            logger_js_1.logger.error({ error: gitError, path: params.path }, 'Failed to update file');
            return (0, result_js_1.err)(gitError);
        }
    }
    async getCommits(options) {
        try {
            const { owner, repo } = this.github.getRepository();
            const { sha, path, perPage = 30, page = 1 } = options || {};
            logger_js_1.logger.debug({ sha, path, perPage, page }, 'Getting commits');
            const response = await this.github.executeWithRetry('listCommits', (octokit) => octokit.rest.repos.listCommits({
                owner,
                repo,
                sha,
                path,
                per_page: Math.min(perPage, 100),
                page,
            }));
            const commits = response.data.map((commit) => ({
                sha: commit.sha,
                message: commit.commit.message,
                author: {
                    name: commit.commit.author?.name || 'Unknown',
                    email: commit.commit.author?.email || 'unknown@example.com',
                },
                date: commit.commit.author?.date || new Date().toISOString(),
            }));
            logger_js_1.logger.info({
                sha,
                path,
                count: commits.length,
            }, 'Retrieved commits');
            return (0, result_js_1.ok)(commits);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getCommits', 'Failed to get commits', error);
            logger_js_1.logger.error({ error: gitError }, 'Failed to get commits');
            return (0, result_js_1.err)(gitError);
        }
    }
}
exports.RepositoryService = RepositoryService;
//# sourceMappingURL=RepositoryService.js.map