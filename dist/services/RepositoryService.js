"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryService = void 0;
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const logger_js_1 = require("../utils/logger.js");
class RepositoryService {
    github;
    log = logger_js_1.logger.child({ service: 'RepositoryService' });
    constructor(github) {
        this.github = github;
        this.log.debug('RepositoryService initialized');
    }
    async getFileContent(params) {
        this.log.debug({ path: params.path, ref: params.ref }, 'Getting file content');
        try {
            const response = await this.fetchFileContent(params);
            if (!this.isFileResponse(response.data)) {
                return this.handleNotAFileError(params.path);
            }
            const fileContent = this.decodeFileContent(response.data);
            this.log.info({ path: params.path, size: fileContent.size }, 'File content retrieved');
            return (0, result_js_1.ok)(fileContent);
        }
        catch (error) {
            return this.handleError('getFileContent', `Failed to get content for ${params.path}`, error, {
                path: params.path,
            });
        }
    }
    async updateFile(params) {
        this.log.debug({ path: params.path, message: params.message, branch: params.branch }, 'Updating file');
        try {
            const response = await this.commitFileUpdate(params);
            const result = this.mapUpdateResponse(response.data, params.message);
            this.log.info({ path: params.path, commitSha: result.commit.sha, fileSha: result.sha }, 'File updated');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            return this.handleError('updateFile', `Failed to update file ${params.path}`, error, { path: params.path });
        }
    }
    async getCommits(options) {
        const { sha, path, perPage = 30, page = 1 } = options || {};
        this.log.debug({ sha, path, perPage, page }, 'Getting commits');
        try {
            const response = await this.fetchCommits(sha, path, perPage, page);
            const commits = this.mapCommits(response.data);
            this.log.info({ sha, path, count: commits.length }, 'Retrieved commits');
            return (0, result_js_1.ok)(commits);
        }
        catch (error) {
            return this.handleError('getCommits', 'Failed to get commits', error);
        }
    }
    async fetchFileContent(params) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('getContent', (octokit) => octokit.rest.repos.getContent({ owner, repo, path: params.path, ref: params.ref }));
    }
    async commitFileUpdate(params) {
        const { owner, repo } = this.github.getRepository();
        const encodedContent = Buffer.from(params.content, 'utf-8').toString('base64');
        return this.github.executeWithRetry('updateFile', (octokit) => octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: params.path,
            message: params.message,
            content: encodedContent,
            sha: params.sha,
            branch: params.branch,
        }));
    }
    async fetchCommits(sha, path, perPage = 30, page = 1) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('listCommits', (octokit) => octokit.rest.repos.listCommits({
            owner,
            repo,
            sha,
            path,
            per_page: Math.min(perPage, 100),
            page,
        }));
    }
    isFileResponse(data) {
        return typeof data === 'object' && data !== null && 'content' in data && !Array.isArray(data);
    }
    decodeFileContent(data) {
        return {
            path: data.path,
            content: Buffer.from(data.content, 'base64').toString('utf-8'),
            encoding: 'utf-8',
            sha: data.sha,
            size: data.size,
        };
    }
    mapUpdateResponse(data, defaultMessage) {
        return {
            sha: data.content?.sha || '',
            commit: {
                sha: data.commit.sha || '',
                message: data.commit.message || defaultMessage,
            },
        };
    }
    mapCommits(data) {
        return data.map((commit) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
                name: commit.commit.author?.name || 'Unknown',
                email: commit.commit.author?.email || 'unknown@example.com',
            },
            date: commit.commit.author?.date || new Date().toISOString(),
        }));
    }
    handleNotAFileError(path) {
        const error = new errors_js_1.GitOperationError('getFileContent', `Path ${path} is not a file`, undefined);
        this.log.error({ path }, 'Path is not a file');
        return (0, result_js_1.err)(error);
    }
    handleError(operation, message, error, context) {
        const gitError = new errors_js_1.GitOperationError(operation, message, error);
        this.log.error({ error: gitError, ...context }, `${operation} failed`);
        return (0, result_js_1.err)(gitError);
    }
}
exports.RepositoryService = RepositoryService;
//# sourceMappingURL=RepositoryService.js.map