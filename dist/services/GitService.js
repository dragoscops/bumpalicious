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
        this.log.info({
            ...github.getRepository(),
        }, 'GitService initialized');
    }
    async getRef(ref) {
        this.log.debug({
            ref,
        }, 'Getting Git reference');
        try {
            const { owner, repo } = this.github.getRepository();
            const reference = await this.github.executeWithRetry('getRef', (octokit) => octokit.rest.git.getRef({
                owner,
                repo,
                ref,
            }));
            this.log.info({
                ref,
                ...reference.data.object,
            }, 'Git reference retrieved successfully');
            return (0, result_js_1.ok)({
                ref: reference.data.ref,
                sha: reference.data.object.sha,
            });
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getRef', `Failed to get ref ${ref}`, error);
            this.log.error({ error: gitError, ref }, 'Failed to get Git reference');
            return (0, result_js_1.err)(gitError);
        }
    }
    async tagExists(tagName) {
        this.log.debug({ tagName }, 'Checking if tag exists');
        try {
            const { owner, repo } = this.github.getRepository();
            await this.github.executeWithRetry('getRef', (octokit) => octokit.rest.git.getRef({
                owner,
                repo,
                ref: `tags/${tagName}`,
            }));
            this.log.debug({ tagName }, 'Tag exists');
            return (0, result_js_1.ok)(true);
        }
        catch (error) {
            if (error?.status === 404) {
                this.log.debug({ tagName }, 'Tag does not exist');
                return (0, result_js_1.ok)(false);
            }
            const gitError = new errors_js_1.GitOperationError('tagExists', `Failed to check if tag ${tagName} exists`, error);
            this.log.error({ error: gitError, tagName }, 'Failed to check if tag exists');
            return (0, result_js_1.err)(gitError);
        }
    }
    async deleteTag(tagName) {
        this.log.debug({ tagName }, 'Deleting tag');
        try {
            const { owner, repo } = this.github.getRepository();
            await this.github.executeWithRetry('deleteRef', (octokit) => octokit.rest.git.deleteRef({
                owner,
                repo,
                ref: `tags/${tagName}`,
            }));
            this.log.info({ tagName }, 'Tag deleted successfully');
            return (0, result_js_1.ok)(undefined);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('deleteTag', `Failed to delete tag ${tagName}`, error);
            this.log.error({ error: gitError, tagName }, 'Failed to delete tag');
            return (0, result_js_1.err)(gitError);
        }
    }
    async createTag(params) {
        this.log.debug({
            tagName: params.tagName,
            commitSha: params.commitSha,
            message: params.message,
            hasTagger: !!(params.taggerName && params.taggerEmail),
        }, 'Creating Git tag');
        try {
            const { tagName, message, commitSha, taggerName, taggerEmail } = params;
            const { owner, repo } = this.github.getRepository();
            this.log.debug({ tagName }, 'Creating tag object');
            const tagObject = await this.github.executeWithRetry('createTag', (octokit) => octokit.rest.git.createTag({
                owner,
                repo,
                tag: tagName,
                message,
                object: commitSha,
                type: 'commit',
                tagger: taggerName && taggerEmail
                    ? {
                        name: taggerName,
                        email: taggerEmail,
                        date: new Date().toISOString(),
                    }
                    : undefined,
            }));
            this.log.debug({
                tagName,
                tagSha: tagObject.data.sha,
            }, 'Tag object created, creating reference');
            await this.github.executeWithRetry('createTagRef', (octokit) => octokit.rest.git.createRef({
                owner,
                repo,
                ref: `refs/tags/${tagName}`,
                sha: tagObject.data.sha,
            }));
            this.log.info({
                tagName,
                sha: tagObject.data.sha,
                commitSha,
            }, 'Git tag created successfully');
            return (0, result_js_1.ok)({
                name: tagName,
                sha: tagObject.data.sha,
                message,
            });
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('createTag', `Failed to create tag ${params.tagName}`, error);
            this.log.error({ error: gitError, tagName: params.tagName }, 'Failed to create Git tag');
            return (0, result_js_1.err)(gitError);
        }
    }
    async createCommit(params) {
        this.log.debug({
            message: params.message,
            tree: params.tree,
            parentsCount: params.parents.length,
            hasAuthor: !!params.author,
        }, 'Creating Git commit');
        try {
            const { message, tree, parents, author } = params;
            const { owner, repo } = this.github.getRepository();
            const commit = await this.github.executeWithRetry('createCommit', (octokit) => octokit.rest.git.createCommit({
                owner,
                repo,
                message,
                tree,
                parents: [...parents],
                author: author
                    ? {
                        name: author.name,
                        email: author.email,
                        date: new Date().toISOString(),
                    }
                    : undefined,
            }));
            this.log.info({
                sha: commit.data.sha,
                message: commit.data.message,
                author: commit.data.author.name,
            }, 'Git commit created successfully');
            return (0, result_js_1.ok)({
                sha: commit.data.sha,
                message: commit.data.message,
                author: {
                    name: commit.data.author.name,
                    email: commit.data.author.email,
                },
                date: commit.data.author.date,
            });
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('createCommit', 'Failed to create commit', error);
            this.log.error({ error: gitError, message: params.message }, 'Failed to create Git commit');
            return (0, result_js_1.err)(gitError);
        }
    }
    async updateRef(params) {
        this.log.debug({
            ref: params.ref,
            sha: params.sha,
            force: params.force ?? false,
        }, 'Updating Git reference');
        try {
            const { ref, sha, force = false } = params;
            const { owner, repo } = this.github.getRepository();
            const reference = await this.github.executeWithRetry('updateRef', (octokit) => octokit.rest.git.updateRef({
                owner,
                repo,
                ref,
                sha,
                force,
            }));
            this.log.info({
                ref,
                sha,
                updatedSha: reference.data.object.sha,
            }, 'Git reference updated successfully');
            return (0, result_js_1.ok)({
                ref: reference.data.ref,
                sha: reference.data.object.sha,
            });
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('updateRef', `Failed to update ref ${params.ref}`, error);
            this.log.error({ error: gitError, ref: params.ref }, 'Failed to update Git reference');
            return (0, result_js_1.err)(gitError);
        }
    }
    async getChangedFiles(base, head, path) {
        this.log.debug({
            base,
            head,
            path: path || 'all',
        }, 'Getting changed files between commits');
        try {
            const { owner, repo } = this.github.getRepository();
            const baseRef = base.startsWith('v') && !base.startsWith('refs/') ? `refs/tags/${base}` : base;
            const needsHeadPrefix = !head.match(/^[0-9a-f]{40}$/i) &&
                !head.startsWith('refs/') &&
                !head.startsWith('v') &&
                head !== 'HEAD';
            const headRef = needsHeadPrefix ? `refs/heads/${head}` : head;
            this.log.debug({
                originalBase: base,
                resolvedBase: baseRef,
                originalHead: head,
                resolvedHead: headRef,
                addedHeadPrefix: needsHeadPrefix,
            }, 'Resolved references for comparison');
            const comparison = await this.github.executeWithRetry('compareCommits', (octokit) => octokit.rest.repos.compareCommits({
                owner,
                repo,
                base: baseRef,
                head: headRef,
            }));
            let files = comparison.data.files || [];
            const rawCommits = comparison.data.commits || [];
            this.log.debug({
                base,
                head,
                status: comparison.data.status,
                aheadBy: comparison.data.ahead_by,
                behindBy: comparison.data.behind_by,
                totalCommits: comparison.data.total_commits,
                totalFiles: files.length,
            }, 'Comparison API response received');
            if (path) {
                const normalizedPath = path.endsWith('/') ? path : `${path}/`;
                const originalCount = files.length;
                files = files.filter((file) => file.filename.startsWith(normalizedPath));
                this.log.debug({
                    path: normalizedPath,
                    originalCount,
                    filteredCount: files.length,
                }, 'Files filtered by path');
            }
            const fileChanges = files.map((file) => ({
                path: file.filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
            }));
            const commits = rawCommits.map((commit) => ({
                sha: commit.sha,
                message: commit.commit.message,
                author: {
                    name: commit.commit.author?.name || 'Unknown',
                    email: commit.commit.author?.email || 'unknown@example.com',
                },
                date: commit.commit.author?.date || new Date().toISOString(),
            }));
            this.log.info({
                base,
                head,
                filesCount: fileChanges.length,
                commitsCount: commits.length,
                status: comparison.data.status,
            }, 'Changed files retrieved successfully');
            return (0, result_js_1.ok)({
                base,
                head,
                files: fileChanges,
                commits,
            });
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getChangedFiles', `Failed to get changed files between ${base} and ${head}`, error);
            this.log.error({ error: gitError, base, head }, 'Failed to get changed files');
            return (0, result_js_1.err)(gitError);
        }
    }
    async getLastCommit(branch) {
        this.log.debug({ branch }, 'Getting last commit');
        try {
            const { owner, repo } = this.github.getRepository();
            const commits = await this.github.executeWithRetry('listCommits', (octokit) => octokit.rest.repos.listCommits({
                owner,
                repo,
                sha: branch,
                per_page: 1,
            }));
            if (commits.data.length === 0) {
                this.log.info('No commits found in repository');
                return (0, result_js_1.ok)(null);
            }
            const commit = commits.data[0];
            const result = {
                sha: commit.sha,
                message: commit.commit.message,
            };
            this.log.debug({ sha: result.sha, messageStart: result.message.substring(0, 50) }, 'Last commit retrieved');
            return (0, result_js_1.ok)(result);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getLastCommit', `Failed to retrieve last commit: ${error instanceof Error ? error.message : String(error)}`, error);
            this.log.error({ error: gitError }, 'Failed to get last commit');
            return (0, result_js_1.err)(gitError);
        }
    }
    async getLastTag() {
        this.log.debug('Getting most recent tag from repository');
        try {
            const { owner, repo } = this.github.getRepository();
            const tags = await this.github.executeWithRetry('listTags', (octokit) => octokit.rest.repos.listTags({
                owner,
                repo,
                per_page: 1,
            }));
            if (tags.data.length === 0) {
                this.log.warn('No tags found in repository');
                return (0, result_js_1.ok)(null);
            }
            const lastTag = {
                name: tags.data[0].name,
                sha: tags.data[0].commit.sha,
            };
            this.log.info({
                tagName: lastTag.name,
                sha: lastTag.sha,
            }, 'Retrieved last tag');
            return (0, result_js_1.ok)(lastTag);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getLastTag', 'Failed to get last tag', error);
            this.log.error({ error: gitError }, 'Failed to get last tag');
            return (0, result_js_1.err)(gitError);
        }
    }
    async getCommitsSince(base, head = 'HEAD') {
        this.log.debug({
            base,
            head,
        }, 'Getting commits between references');
        try {
            const comparison = await this.getChangedFiles(base, head);
            if (!comparison.ok) {
                this.log.debug({
                    base,
                    head,
                    error: comparison.error,
                }, 'Failed to get comparison for commits');
                return (0, result_js_1.err)(comparison.error);
            }
            this.log.info({
                base,
                head,
                count: comparison.value.commits.length,
            }, 'Retrieved commits successfully');
            return (0, result_js_1.ok)(comparison.value.commits);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('getCommitsSince', `Failed to get commits since ${base}`, error);
            this.log.error({ error: gitError, base, head }, 'Failed to get commits');
            return (0, result_js_1.err)(gitError);
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map