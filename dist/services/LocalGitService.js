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
exports.LocalGitService = void 0;
const exec = __importStar(require("@actions/exec"));
const result_js_1 = require("../types/result.js");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class LocalGitService extends Loggable_js_1.Loggable {
    constructor() {
        super();
        this.log.info('LocalGitService initialized');
    }
    async configureGit() {
        try {
            await this.ensureUserName();
            await this.ensureUserEmail();
        }
        catch (error) {
            this.log.warn({ error }, 'Failed to configure git user');
        }
    }
    async createVersionCommit(tree) {
        this.log.debug({ version: tree.masterVersion }, 'Creating version commit');
        try {
            await this.configureGit();
            const commitMessage = this.buildCommitMessage(tree.masterVersion);
            await this.stageChanges();
            await this.createCommit(commitMessage);
            const commitSha = await this.getCommitSha();
            const branchName = await this.getCurrentBranch();
            await this.pushBranch(branchName);
            this.log.info({ sha: commitSha, message: commitMessage }, 'Version commit created and pushed');
            return (0, result_js_1.ok)(commitSha);
        }
        catch (error) {
            return this.handleError('createVersionCommit', 'Failed to create version commit', error);
        }
    }
    async createVersionBranch(tree, branchPrefix) {
        const branchName = this.generateBranchName(branchPrefix, tree.masterVersion);
        this.log.debug({ branch: branchName, version: tree.masterVersion }, 'Creating version branch');
        try {
            await this.configureGit();
            const commitMessage = this.buildCommitMessage(tree.masterVersion);
            await this.createAndCheckoutBranch(branchName);
            await this.stageChanges();
            await this.createCommit(commitMessage);
            await this.pushBranch(branchName);
            this.log.info({ branch: branchName, message: commitMessage }, 'Version branch created and pushed');
            return (0, result_js_1.ok)(branchName);
        }
        catch (error) {
            return this.handleError('createVersionBranch', 'Failed to create version branch', error);
        }
    }
    async ensureUserName() {
        const hasUserName = await this.checkGitConfig('user.name');
        if (!hasUserName) {
            await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
            this.log.debug('Configured git user.name');
        }
    }
    async ensureUserEmail() {
        const hasUserEmail = await this.checkGitConfig('user.email');
        if (!hasUserEmail) {
            await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
            this.log.debug('Configured git user.email');
        }
    }
    async checkGitConfig(key) {
        let hasValue = false;
        await exec.exec('git', ['config', key], {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    hasValue = data.toString().trim().length > 0;
                },
            },
        });
        return hasValue;
    }
    async stageChanges() {
        await exec.exec('git', ['add', '-A']);
    }
    async createCommit(message) {
        await exec.exec('git', ['commit', '-m', message, '--no-verify']);
    }
    async createAndCheckoutBranch(branchName) {
        await exec.exec('git', ['checkout', '-b', branchName]);
    }
    async pushBranch(branchName) {
        await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);
    }
    async getCommitSha() {
        return this.captureGitOutput('rev-parse', 'HEAD');
    }
    async getCurrentBranch() {
        return this.captureGitOutput('rev-parse', '--abbrev-ref', 'HEAD');
    }
    async captureGitOutput(...args) {
        let output = '';
        await exec.exec('git', args, {
            listeners: {
                stdout: (data) => {
                    output += data.toString().trim();
                },
            },
        });
        return output;
    }
    buildCommitMessage(version) {
        return `chore: bump version to ${version}`;
    }
    generateBranchName(prefix, version) {
        const randomSuffix = Math.floor(Math.random() * 10000).toString(36);
        return `${prefix}/v${version}-${randomSuffix}`;
    }
    handleError(operation, message, error) {
        const gitError = new errors_js_1.GitOperationError(operation, message, error);
        this.log.error({ error: gitError }, `${operation} failed`);
        return (0, result_js_1.err)(gitError);
    }
}
exports.LocalGitService = LocalGitService;
//# sourceMappingURL=LocalGitService.js.map