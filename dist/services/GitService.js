"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class GitService extends Loggable_js_1.Loggable {
    github;
    constructor(github) {
        super();
        this.github = github;
        this.log.info({ ...github.getRepository() }, 'GitService initialized');
    }
    async getRef(ref) {
        this.log.debug({ ref }, 'Getting reference');
        try {
            const reference = await this.fetchRef(ref);
            this.log.info({ ref, ...reference.data.object }, 'Reference retrieved');
            return (0, result_js_1.ok)({ ref: reference.data.ref, sha: reference.data.object.sha });
        }
        catch (error) {
            return this.handleError('getRef', `Failed to get ref ${ref}`, error, { ref });
        }
    }
    async tagExists(tagName) {
        this.log.debug({ tagName }, 'Checking tag existence');
        try {
            await this.fetchRef(`tags/${tagName}`);
            this.log.debug({ tagName }, 'Tag exists');
            return (0, result_js_1.ok)(true);
        }
        catch (error) {
            if (this.isNotFoundError(error)) {
                this.log.debug({ tagName }, 'Tag does not exist');
                return (0, result_js_1.ok)(false);
            }
            return this.handleError('tagExists', `Failed to check tag ${tagName}`, error, { tagName });
        }
    }
    async getLastTag() {
        this.log.debug('Getting last tag');
        try {
            const tags = await this.fetchTags(1);
            if (tags.data.length === 0) {
                this.log.warn('No tags found');
                return (0, result_js_1.ok)(null);
            }
            const lastTag = { name: tags.data[0].name, sha: tags.data[0].commit.sha };
            this.log.info({ tagName: lastTag.name, sha: lastTag.sha }, 'Last tag retrieved');
            return (0, result_js_1.ok)(lastTag);
        }
        catch (error) {
            return this.handleError('getLastTag', 'Failed to get last tag', error);
        }
    }
    async createTag(params) {
        this.log.debug({ tagName: params.tagName, commitSha: params.commitSha, hasTagger: !!(params.taggerName && params.taggerEmail) }, 'Creating tag');
        try {
            const tagObject = await this.createTagObject(params);
            await this.createTagRef(params.tagName, tagObject.data.sha);
            this.log.info({ tagName: params.tagName, sha: tagObject.data.sha, commitSha: params.commitSha }, 'Tag created');
            return (0, result_js_1.ok)({ name: params.tagName, sha: tagObject.data.sha, message: params.message });
        }
        catch (error) {
            return this.handleError('createTag', `Failed to create tag ${params.tagName}`, error, {
                tagName: params.tagName,
            });
        }
    }
    async deleteTag(tagName) {
        this.log.debug({ tagName }, 'Deleting tag');
        try {
            await this.deleteRef(`tags/${tagName}`);
            this.log.info({ tagName }, 'Tag deleted');
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            return this.handleError('deleteTag', `Failed to delete tag ${tagName}`, error, { tagName });
        }
    }
    async updateRef(params) {
        this.log.debug({ ref: params.ref, sha: params.sha, force: params.force ?? false }, 'Updating reference');
        try {
            const { owner, repo } = this.github.getRepository();
            const reference = await this.github.executeWithRetry('updateRef', (octokit) => octokit.rest.git.updateRef({ owner, repo, ref: params.ref, sha: params.sha, force: params.force ?? false }));
            this.log.info({ ref: params.ref, sha: params.sha, updatedSha: reference.data.object.sha }, 'Reference updated');
            return (0, result_js_1.ok)({ ref: reference.data.ref, sha: reference.data.object.sha });
        }
        catch (error) {
            return this.handleError('updateRef', `Failed to update ref ${params.ref}`, error, { ref: params.ref });
        }
    }
    async getLastCommit(branch) {
        this.log.debug({ branch }, 'Getting last commit');
        try {
            const commits = await this.fetchCommits(branch, 1);
            if (commits.data.length === 0) {
                this.log.info('No commits found');
                return (0, result_js_1.ok)(null);
            }
            const result = { sha: commits.data[0].sha, message: commits.data[0].commit.message };
            this.log.debug({ sha: result.sha, messageStart: result.message.substring(0, 50) }, 'Last commit retrieved');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            return this.handleError('getLastCommit', 'Failed to get last commit', error);
        }
    }
    async getCommitsSince(base, head = 'HEAD') {
        this.log.debug({ base, head }, 'Getting commits between references');
        try {
            const comparison = await this.getChangedFiles(base, head);
            if (!comparison.ok) {
                this.log.debug({ base, head, error: comparison.error }, 'Failed to get comparison');
                return (0, result_js_1.err)(comparison.error);
            }
            this.log.info({ base, head, count: comparison.value.commits.length }, 'Commits retrieved');
            return (0, result_js_1.ok)(comparison.value.commits);
        }
        catch (error) {
            return this.handleError('getCommitsSince', `Failed to get commits since ${base}`, error, { base, head });
        }
    }
    async createCommit(params) {
        this.log.debug({ message: params.message, tree: params.tree, parentsCount: params.parents.length, hasAuthor: !!params.author }, 'Creating commit');
        try {
            const { owner, repo } = this.github.getRepository();
            const commit = await this.github.executeWithRetry('createCommit', (octokit) => octokit.rest.git.createCommit({
                owner,
                repo,
                message: params.message,
                tree: params.tree,
                parents: [...params.parents],
                author: params.author ? { ...params.author, date: new Date().toISOString() } : undefined,
            }));
            this.log.info({ sha: commit.data.sha, message: commit.data.message, author: commit.data.author.name }, 'Commit created');
            return (0, result_js_1.ok)({
                sha: commit.data.sha,
                message: commit.data.message,
                author: { name: commit.data.author.name, email: commit.data.author.email },
                date: commit.data.author.date,
            });
        }
        catch (error) {
            return this.handleError('createCommit', 'Failed to create commit', error, { message: params.message });
        }
    }
    async getChangedFiles(base, head, path) {
        this.log.debug({ base, head, path: path || 'all' }, 'Getting changed files');
        try {
            const { baseRef, headRef } = this.resolveRefs(base, head);
            const comparison = await this.compareCommits(baseRef, headRef);
            const files = this.filterFilesByPath(comparison.data.files || [], path);
            const fileChanges = this.mapFileChanges(files);
            const commits = this.mapCommits(comparison.data.commits || []);
            this.log.info({ base, head, filesCount: fileChanges.length, commitsCount: commits.length, status: comparison.data.status }, 'Changed files retrieved');
            return (0, result_js_1.ok)({ base, head, files: fileChanges, commits });
        }
        catch (error) {
            return this.handleError('getChangedFiles', `Failed to get changed files between ${base} and ${head}`, error, {
                base,
                head,
            });
        }
    }
    async fetchRef(ref) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('getRef', (octokit) => octokit.rest.git.getRef({ owner, repo, ref }));
    }
    async fetchTags(perPage) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('listTags', (octokit) => octokit.rest.repos.listTags({ owner, repo, per_page: perPage }));
    }
    async fetchCommits(branch, perPage) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('listCommits', (octokit) => octokit.rest.repos.listCommits({ owner, repo, sha: branch, per_page: perPage }));
    }
    async createTagObject(params) {
        const { owner, repo } = this.github.getRepository();
        this.log.debug({ tagName: params.tagName }, 'Creating tag object');
        return this.github.executeWithRetry('createTag', (octokit) => octokit.rest.git.createTag({
            owner,
            repo,
            tag: params.tagName,
            message: params.message,
            object: params.commitSha,
            type: 'commit',
            tagger: params.taggerName && params.taggerEmail
                ? { name: params.taggerName, email: params.taggerEmail, date: new Date().toISOString() }
                : undefined,
        }));
    }
    async createTagRef(tagName, sha) {
        const { owner, repo } = this.github.getRepository();
        this.log.debug({ tagName, tagSha: sha }, 'Creating tag reference');
        return this.github.executeWithRetry('createTagRef', (octokit) => octokit.rest.git.createRef({ owner, repo, ref: `refs/tags/${tagName}`, sha }));
    }
    async deleteRef(ref) {
        const { owner, repo } = this.github.getRepository();
        return this.github.executeWithRetry('deleteRef', (octokit) => octokit.rest.git.deleteRef({ owner, repo, ref }));
    }
    async compareCommits(base, head) {
        const { owner, repo } = this.github.getRepository();
        const comparison = await this.github.executeWithRetry('compareCommits', (octokit) => octokit.rest.repos.compareCommits({ owner, repo, base, head }));
        this.log.debug({
            base,
            head,
            status: comparison.data.status,
            aheadBy: comparison.data.ahead_by,
            behindBy: comparison.data.behind_by,
            totalCommits: comparison.data.total_commits,
            totalFiles: (comparison.data.files || []).length,
        }, 'Comparison received');
        return comparison;
    }
    resolveRefs(base, head) {
        const baseRef = base.startsWith('v') && !base.startsWith('refs/') ? `refs/tags/${base}` : base;
        const needsHeadPrefix = !head.match(/^[0-9a-f]{40}$/i) && !head.startsWith('refs/') && !head.startsWith('v') && head !== 'HEAD';
        const headRef = needsHeadPrefix ? `refs/heads/${head}` : head;
        this.log.debug({
            originalBase: base,
            resolvedBase: baseRef,
            originalHead: head,
            resolvedHead: headRef,
            addedHeadPrefix: needsHeadPrefix,
        }, 'Refs resolved');
        return { baseRef, headRef };
    }
    filterFilesByPath(files, path) {
        if (!path)
            return files;
        const normalizedPath = path.endsWith('/') ? path : `${path}/`;
        const originalCount = files.length;
        const filtered = files.filter((file) => file.filename.startsWith(normalizedPath));
        this.log.debug({ path: normalizedPath, originalCount, filteredCount: filtered.length }, 'Files filtered');
        return filtered;
    }
    mapFileChanges(files) {
        return files.map((file) => ({
            path: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
        }));
    }
    mapCommits(commits) {
        return commits.map((commit) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
                name: commit.commit.author?.name || 'Unknown',
                email: commit.commit.author?.email || 'unknown@example.com',
            },
            date: commit.commit.author?.date || new Date().toISOString(),
        }));
    }
    isNotFoundError(error) {
        return error?.status === 404;
    }
    handleError(operation, message, error, context) {
        const gitError = new errors_js_1.GitOperationError(operation, message, error);
        this.log.error({ error: gitError, ...context }, `${operation} failed`);
        return (0, result_js_1.err)(gitError);
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map