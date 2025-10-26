"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionInputsSchema = exports.WorkspaceConfigSchema = exports.WorkspaceTypeSchema = void 0;
exports.validateInputs = validateInputs;
exports.validateWorkspaceConfig = validateWorkspaceConfig;
exports.validateWorkspaceConfigs = validateWorkspaceConfigs;
const zod_1 = require("zod");
const errors_js_1 = require("./errors.js");
exports.WorkspaceTypeSchema = zod_1.z.enum(['node', 'python', 'deno', 'go', 'rust', 'zig', 'text']);
exports.WorkspaceConfigSchema = zod_1.z.object({
    path: zod_1.z
        .string()
        .min(1, 'Workspace path cannot be empty')
        .refine((path) => !path.includes('..'), {
        message: 'Workspace path cannot contain ".." for security reasons',
    }),
    type: exports.WorkspaceTypeSchema,
});
exports.ActionInputsSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'GitHub token is required'),
    workspaces: zod_1.z.string().min(1, 'At least one workspace must be specified'),
    createPr: zod_1.z.boolean(),
    autoMerge: zod_1.z.boolean(),
    prBaseBranch: zod_1.z.string().min(1, 'PR base branch cannot be empty'),
    prHeadBranch: zod_1.z.string().min(1, 'PR head branch cannot be empty'),
    prTitle: zod_1.z.string().min(1, 'PR title cannot be empty'),
    prBody: zod_1.z.string(),
    commitMessage: zod_1.z.string().min(1, 'Commit message cannot be empty'),
    tagPrefix: zod_1.z.string(),
    createShortTags: zod_1.z.boolean(),
    changelogPreset: zod_1.z.string().min(1, 'Changelog preset cannot be empty'),
    debug: zod_1.z.boolean(),
});
function validateInputs(inputs) {
    try {
        return exports.ActionInputsSchema.parse(inputs);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const messages = error.issues.map((err) => {
                const path = err.path.join('.');
                return `${path}: ${err.message}`;
            });
            throw new errors_js_1.InvalidConfigurationError('action inputs', messages.join('; '), error);
        }
        throw new errors_js_1.InvalidConfigurationError('action inputs', 'validation failed with unknown error', error);
    }
}
function validateWorkspaceConfig(config) {
    try {
        return exports.WorkspaceConfigSchema.parse(config);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const messages = error.issues.map((err) => {
                const path = err.path.join('.');
                return `${path}: ${err.message}`;
            });
            throw new errors_js_1.InvalidConfigurationError('workspace configuration', messages.join('; '), error);
        }
        throw new errors_js_1.InvalidConfigurationError('workspace configuration', 'validation failed with unknown error', error);
    }
}
function validateWorkspaceConfigs(configs) {
    if (!Array.isArray(configs)) {
        throw new errors_js_1.InvalidConfigurationError('workspaces', 'must be an array');
    }
    if (configs.length === 0) {
        throw new errors_js_1.InvalidConfigurationError('workspaces', 'at least one workspace configuration is required');
    }
    try {
        return configs.map((config, index) => {
            try {
                return validateWorkspaceConfig(config);
            }
            catch (error) {
                if (error instanceof errors_js_1.InvalidConfigurationError) {
                    throw new errors_js_1.InvalidConfigurationError(`workspaces[${index}]`, error.message, error.cause);
                }
                throw error;
            }
        });
    }
    catch (error) {
        if (error instanceof errors_js_1.InvalidConfigurationError) {
            throw error;
        }
        throw new errors_js_1.InvalidConfigurationError('workspaces', 'validation failed with unknown error', error);
    }
}
//# sourceMappingURL=validators.js.map