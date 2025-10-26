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
            let hasUserName = false;
            await exec.exec('git', ['config', 'user.name'], {
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        hasUserName = data.toString().trim().length > 0;
                    },
                },
            });
            if (!hasUserName) {
                await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
                this.log.debug('Configured git user.name');
            }
            let hasUserEmail = false;
            await exec.exec('git', ['config', 'user.email'], {
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        hasUserEmail = data.toString().trim().length > 0;
                    },
                },
            });
            if (!hasUserEmail) {
                await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
                this.log.debug('Configured git user.email');
            }
        }
        catch (error) {
            this.log.warn({ error }, 'Failed to configure git user, will proceed anyway');
        }
    }
    async createVersionCommit(tree) {
        this.log.debug({ version: tree.masterVersion }, 'Creating version commit');
        try {
            await this.configureGit();
            await exec.exec('git', ['add', '-A']);
            const commitMessage = `chore: bump version to ${tree.masterVersion}`;
            await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);
            let commitSha = '';
            await exec.exec('git', ['rev-parse', 'HEAD'], {
                listeners: {
                    stdout: (data) => {
                        commitSha += data.toString().trim();
                    },
                },
            });
            let branchName = '';
            await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                listeners: {
                    stdout: (data) => {
                        branchName += data.toString().trim();
                    },
                },
            });
            await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);
            this.log.info({ sha: commitSha, message: commitMessage }, 'Version commit created and pushed');
            return (0, result_js_1.ok)(commitSha);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('createVersionCommit', 'Failed to create version commit', error);
            this.log.error({ error: gitError }, 'Failed to create version commit');
            return (0, result_js_1.err)(gitError);
        }
    }
    async createVersionBranch(tree, branchPrefix) {
        const randomSuffix = Math.floor(Math.random() * 10000).toString(36);
        const branchName = `${branchPrefix}/v${tree.masterVersion}-${randomSuffix}`;
        this.log.debug({ branch: branchName, version: tree.masterVersion }, 'Creating version branch');
        try {
            await this.configureGit();
            await exec.exec('git', ['checkout', '-b', branchName]);
            await exec.exec('git', ['add', '-A']);
            const commitMessage = `chore: bump version to ${tree.masterVersion}`;
            await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);
            await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);
            this.log.info({ branch: branchName, message: commitMessage }, 'Version branch created and pushed');
            return (0, result_js_1.ok)(branchName);
        }
        catch (error) {
            const gitError = new errors_js_1.GitOperationError('createVersionBranch', 'Failed to create version branch', error);
            this.log.error({ error: gitError }, 'Failed to create version branch');
            return (0, result_js_1.err)(gitError);
        }
    }
}
exports.LocalGitService = LocalGitService;
//# sourceMappingURL=LocalGitService.js.map