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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const WorkspaceManager_js_1 = require("./core/WorkspaceManager.js");
const WorkspaceTreeBuilder_js_1 = require("./core/WorkspaceTreeBuilder.js");
const ChangelogService_js_1 = require("./services/ChangelogService.js");
const GitHubService_js_1 = require("./services/GitHubService.js");
const GitService_js_1 = require("./services/GitService.js");
const LocalGitService_js_1 = require("./services/LocalGitService.js");
const PRService_js_1 = require("./services/PRService.js");
const TagService_js_1 = require("./services/TagService.js");
const VersionService_js_1 = require("./services/VersionService.js");
const WorkspaceService_js_1 = require("./services/WorkspaceService.js");
const logger_js_1 = require("./utils/logger.js");
const validators_js_1 = require("./utils/validators.js");
const workspace_parser_js_1 = require("./utils/workspace-parser.js");
const log = logger_js_1.logger.child({ module: 'index' });
function getInputs() {
    const rawInputs = {
        token: core.getInput('github_token', { required: true }),
        workspaces: core.getInput('workspaces', { required: false }) || '.:text',
        createPr: core.getBooleanInput('pr', { required: false }),
        autoMerge: core.getBooleanInput('pr_auto_merge', { required: false }),
        prBaseBranch: core.getInput('branch', { required: false }) || 'main',
        prHeadBranch: core.getInput('pr_version_prefix', { required: false }) || 'version_bump',
        prTitle: core.getInput('pr_message', { required: false }) || 'chore: version update',
        prBody: '',
        commitMessage: core.getInput('pr_message', { required: false }) || 'chore: version update',
        tagPrefix: 'v',
        createShortTags: core.getBooleanInput('short_tag', { required: false }),
        changelogPreset: (core.getInput('changelog_preset', { required: false }) ||
            'conventionalcommits'),
        debug: core.isDebug(),
    };
    core.debug(`Inputs: ${JSON.stringify({ ...rawInputs, token: '***' })}`);
    return rawInputs;
}
async function run() {
    try {
        core.info('🚀 Starting Bumpalicious version bump workflow');
        core.startGroup('📥 Reading inputs');
        const inputs = getInputs();
        core.info(`Workspaces: ${inputs.workspaces}`);
        core.info(`Create PR: ${inputs.createPr}`);
        core.info(`Auto-merge: ${inputs.autoMerge}`);
        core.info(`Changelog preset: ${inputs.changelogPreset}`);
        core.endGroup();
        core.startGroup('✅ Validating inputs');
        (0, validators_js_1.validateInputs)(inputs);
        core.info('✓ Inputs validated successfully');
        core.endGroup();
        core.startGroup('📦 Parsing workspaces');
        const workspaceConfigs = (0, workspace_parser_js_1.parseWorkspacesInput)(inputs.workspaces);
        core.info(`Found ${workspaceConfigs.length} workspace(s)`);
        for (const config of workspaceConfigs) {
            core.info(`  - ${config.path} (${config.type})`);
        }
        core.endGroup();
        core.startGroup('🔧 Initializing services');
        const { owner, repo } = github.context.repo;
        core.info(`Repository: ${owner}/${repo}`);
        const githubService = new GitHubService_js_1.GitHubService(inputs.token, {
            repository: { owner, repo },
        });
        const gitService = new GitService_js_1.GitService(githubService);
        const localGitService = new LocalGitService_js_1.LocalGitService();
        const tagService = new TagService_js_1.TagService(gitService);
        const workspaceService = new WorkspaceService_js_1.WorkspaceService(gitService);
        const prService = new PRService_js_1.PRService(githubService);
        const versionService = new VersionService_js_1.VersionService(gitService);
        const changelogService = new ChangelogService_js_1.ChangelogService();
        const treeBuilder = new WorkspaceTreeBuilder_js_1.WorkspaceTreeBuilder();
        const workspaceManager = new WorkspaceManager_js_1.WorkspaceManager({
            gitService,
            githubService,
            localGitService,
            tagService,
            workspaceService,
            prService,
            versionService,
            changelogService,
            treeBuilder,
        });
        core.info('✓ Services initialized');
        core.endGroup();
        core.startGroup('⚡ Executing workflow');
        const workflowOptions = {
            workspaces: workspaceConfigs,
            createPR: inputs.createPr,
            prOptions: inputs.createPr
                ? {
                    branchPrefix: inputs.prHeadBranch,
                    autoMerge: inputs.autoMerge,
                    draft: false,
                    title: inputs.prTitle,
                }
                : undefined,
            tagOptions: {
                shortTag: inputs.createShortTags,
                tagPrefix: inputs.tagPrefix,
            },
            repository: {
                owner,
                repo,
            },
            branch: inputs.prBaseBranch,
            changelog: {
                preset: inputs.changelogPreset,
                skip: process.env.SKIP_CHANGELOG_GENERATION === 'true' || false,
            },
        };
        core.debug(`Workflow options: ${JSON.stringify({ ...workflowOptions, workspaces: workflowOptions.workspaces.length })}`);
        const result = await workspaceManager.execute(workflowOptions);
        core.debug(`Workflow result: ${result.ok ? 'SUCCESS' : 'FAILURE'}`);
        core.endGroup();
        if (!result.ok) {
            throw result.error;
        }
        core.startGroup('📤 Setting outputs');
        const { tag, allTags, prNumber, prMerged, tree } = result.value;
        core.debug(`Result value structure: ${JSON.stringify({ tag, allTags: allTags.length, prNumber, treeKeys: Object.keys(tree) })}`);
        core.debug(`Tree root: ${JSON.stringify({ hasWorkspace: !!tree.root.workspace, hasChildren: !!tree.root.children, childrenCount: tree.root.children?.length })}`);
        const changedWorkspaces = tree.root.children
            .filter((node) => node.workspace.hasChanges)
            .map((node) => node.workspace.path);
        core.debug(`Changed workspaces from children: ${JSON.stringify(changedWorkspaces)}`);
        if (tree.root.workspace.hasChanges) {
            changedWorkspaces.unshift(tree.root.workspace.path);
            core.debug(`Root has changes, prepended: ${tree.root.workspace.path}`);
        }
        const oldVersion = tree.root.workspace.version;
        const newVersion = tree.root.workspace.newVersion;
        core.debug(`Version comparison: ${oldVersion} → ${newVersion}`);
        let bumpType = 'none';
        if (oldVersion !== newVersion) {
            const [oldMajor, oldMinor, oldPatch] = oldVersion.split('-')[0].split('.').map(Number);
            const [newMajor, newMinor, newPatch] = newVersion.split('-')[0].split('.').map(Number);
            core.debug(`Parsed versions: old=[${oldMajor}.${oldMinor}.${oldPatch}] new=[${newMajor}.${newMinor}.${newPatch}]`);
            if (newVersion.includes('-')) {
                bumpType = 'pre-release';
                core.debug(`Detected pre-release version: ${newVersion}`);
            }
            else if (newMajor > oldMajor) {
                bumpType = 'major';
                core.debug(`Major bump detected: ${oldMajor} → ${newMajor}`);
            }
            else if (newMinor > oldMinor) {
                bumpType = 'minor';
                core.debug(`Minor bump detected: ${oldMinor} → ${newMinor}`);
            }
            else if (newPatch > oldPatch) {
                bumpType = 'patch';
                core.debug(`Patch bump detected: ${oldPatch} → ${newPatch}`);
            }
            core.debug(`Final bump type: ${bumpType}`);
            core.setOutput('tag', tag);
            core.setOutput('version', tree.masterVersion);
            core.setOutput('pr', prNumber?.toString() ?? '');
            core.setOutput('all_tags', allTags.join(','));
            core.setOutput('changed_workspaces', JSON.stringify(changedWorkspaces));
            core.setOutput('bump_type', bumpType);
        }
        else {
            core.debug('No version change detected');
        }
        core.debug(`Outputs set: tag=${tag}, version=${tree.masterVersion}, pr=${prNumber ?? 'none'}, all_tags=${allTags.length}, changed_workspaces=${changedWorkspaces.length}, bump_type=${bumpType}`);
        if (tag) {
            core.info(`✓ Version tag: ${tag}`);
        }
        core.info(`✓ Version: ${tree.masterVersion}`);
        core.info(`✓ Bump type: ${bumpType}`);
        if (allTags.length > 1) {
            core.info(`✓ All tags: ${allTags.join(', ')}`);
        }
        if (changedWorkspaces.length > 0) {
            core.info(`✓ Changed workspaces: ${changedWorkspaces.join(', ')}`);
        }
        if (prNumber) {
            core.info(`✓ Pull Request: #${prNumber}`);
            if (prMerged === false) {
                core.info('  ℹ️  PR created - tags will be created after manual merge');
            }
            else if (prMerged === true) {
                core.info('  ✓ PR auto-merged - tags created');
            }
        }
        core.endGroup();
        if (tag) {
            core.notice(`✨ Version bump successful: ${tree.masterVersion} (${tag})`);
        }
        else if (prNumber && !prMerged) {
            core.notice(`✨ Version PR #${prNumber} created: ${tree.masterVersion} - awaiting merge`);
        }
        else if (bumpType === 'none') {
            core.notice(`ℹ️ No version changes - all workspaces remain at current versions`);
        }
        else {
            core.notice(`✨ Version bump successful: ${tree.masterVersion}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        core.error(`❌ Version bump failed: ${errorMessage}`);
        if (errorStack) {
            core.debug(`Stack trace: ${errorStack}`);
        }
        log.error({ error, errorMessage }, 'Action execution failed');
        core.setFailed(errorMessage);
    }
}
run();
//# sourceMappingURL=index.js.map