"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagService = void 0;
const result_js_1 = require("../types/result.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class TagService extends Loggable_js_1.Loggable {
    gitService;
    constructor(gitService) {
        super();
        this.gitService = gitService;
        this.log.info('TagService initialized');
    }
    async createVersionTags(version, commitSha, options) {
        this.log.debug({ version, commitSha, options }, 'Creating version tags');
        const createdTags = [];
        const masterTagResult = await this.createMasterTag(version, commitSha);
        if (!masterTagResult.ok) {
            return (0, result_js_1.err)(masterTagResult.error);
        }
        createdTags.push(masterTagResult.value);
        if (options?.shortTag) {
            const shortTagResult = await this.createShortTag(version, commitSha, masterTagResult.value);
            if (shortTagResult.ok && shortTagResult.value) {
                createdTags.push(shortTagResult.value);
            }
        }
        this.log.info({ tagCount: createdTags.length, tags: createdTags }, 'Tags created');
        return (0, result_js_1.ok)(createdTags);
    }
    async createVersionTagsForBranch(version, branch, options) {
        this.log.debug({ version, branch }, 'Getting branch HEAD for tags');
        const commitSha = await this.getBranchHead(branch);
        if (!commitSha.ok) {
            return (0, result_js_1.err)(commitSha.error);
        }
        return this.createVersionTags(version, commitSha.value, options);
    }
    async createMasterTag(version, commitSha) {
        const masterTag = `v${version}`;
        const result = await this.gitService.createTag({
            tagName: masterTag,
            message: `Release ${version}`,
            commitSha,
        });
        if (!result.ok) {
            return (0, result_js_1.err)(result.error);
        }
        this.log.debug({ tag: masterTag }, 'Master tag created');
        return (0, result_js_1.ok)(masterTag);
    }
    async createShortTag(version, commitSha, masterTag) {
        const shortTag = this.calculateShortTag(version, masterTag);
        if (shortTag === masterTag) {
            return (0, result_js_1.ok)(null);
        }
        await this.deleteExistingShortTag(shortTag);
        const result = await this.gitService.createTag({
            tagName: shortTag,
            message: `Release ${shortTag} (latest: ${version})`,
            commitSha,
        });
        if (!result.ok) {
            this.log.warn({ tag: shortTag, version }, 'Failed to create/update short tag');
            return (0, result_js_1.ok)(null);
        }
        this.log.info({ tag: shortTag, pointsTo: version }, 'Short tag created/updated');
        return (0, result_js_1.ok)(shortTag);
    }
    async getBranchHead(branch) {
        const branchRef = `heads/${branch}`;
        const refResult = await this.gitService.getRef(branchRef);
        if (!refResult.ok) {
            this.log.error({ branch: branchRef }, 'Failed to get branch HEAD SHA');
            return (0, result_js_1.err)(refResult.error);
        }
        this.log.debug({ commitSha: refResult.value.sha, branch: branchRef }, 'Retrieved branch HEAD SHA');
        return (0, result_js_1.ok)(refResult.value.sha);
    }
    calculateShortTag(version, masterTag) {
        const parts = version.split('.');
        return parts.length >= 2 ? `v${parts[0]}` : masterTag;
    }
    async deleteExistingShortTag(shortTag) {
        const exists = await this.gitService.tagExists(shortTag);
        if (exists.ok && exists.value) {
            this.log.debug({ tag: shortTag }, 'Short tag exists, updating to latest version');
            const deleteResult = await this.gitService.deleteTag(shortTag);
            if (!deleteResult.ok) {
                this.log.warn({ tag: shortTag, error: deleteResult.error }, 'Failed to delete existing short tag');
            }
        }
        else {
            this.log.debug({ tag: shortTag }, 'Creating new short tag');
        }
    }
}
exports.TagService = TagService;
//# sourceMappingURL=TagService.js.map