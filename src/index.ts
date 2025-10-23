/**
 * GitHub Action Entry Point
 *
 * Main entry point for the Bumpalicious GitHub Action.
 * Orchestrates version bumping workflow by:
 * 1. Reading and validating action inputs
 * 2. Initializing required services
 * 3. Executing workspace manager workflow
 * 4. Setting action outputs
 * 5. Handling errors appropriately
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { ChangelogService } from './core/ChangelogService.js';
import type { ChangelogPreset } from './core/ChangelogService.js';
import { VersionService } from './core/VersionService.js';
import { WorkspaceManager } from './core/WorkspaceManager.js';
import { WorkspaceTreeBuilder } from './core/WorkspaceTreeBuilder.js';
import { GitHubService } from './services/GitHubService.js';
import { GitService } from './services/GitService.js';
import { PRService } from './services/PRService.js';
import type { ActionBumpType } from './types/action.js';
import type { WorkspaceNode } from './types/workspace.js';
import { logger } from './utils/logger.js';
import { validateInputs } from './utils/validators.js';
import { parseWorkspacesInput } from './utils/workspace-parser.js';

const log = logger.child({ module: 'index' });

/**
 * Read and parse action inputs
 *
 * @returns Validated action inputs
 */
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
      'conventionalcommits') as ChangelogPreset,
    debug: core.isDebug(),
  };

  // Log inputs (masking token)
  core.debug(`Inputs: ${JSON.stringify({ ...rawInputs, token: '***' })}`);

  return rawInputs;
}

/**
 * Main action execution
 */
async function run(): Promise<void> {
  try {
    core.info('🚀 Starting Bumpalicious version bump workflow');

    // Step 1: Read inputs
    core.startGroup('📥 Reading inputs');
    const inputs = getInputs();
    core.info(`Workspaces: ${inputs.workspaces}`);
    core.info(`Create PR: ${inputs.createPr}`);
    core.info(`Auto-merge: ${inputs.autoMerge}`);
    core.info(`Changelog preset: ${inputs.changelogPreset}`);
    core.endGroup();

    // Step 2: Validate inputs
    core.startGroup('✅ Validating inputs');
    validateInputs(inputs);
    core.info('✓ Inputs validated successfully');
    core.endGroup();

    // Step 3: Parse workspaces
    core.startGroup('📦 Parsing workspaces');
    const workspaceConfigs = parseWorkspacesInput(inputs.workspaces);
    core.info(`Found ${workspaceConfigs.length} workspace(s)`);
    for (const config of workspaceConfigs) {
      core.info(`  - ${config.path} (${config.type})`);
    }
    core.endGroup();

    // Step 4: Initialize GitHub context
    core.startGroup('🔧 Initializing services');
    const { owner, repo } = github.context.repo;
    core.info(`Repository: ${owner}/${repo}`);

    // Step 5: Initialize services
    const githubService = new GitHubService(inputs.token, {
      repository: { owner, repo },
    });

    const gitService = new GitService(githubService);
    const prService = new PRService(githubService);
    const versionService = new VersionService();
    const changelogService = new ChangelogService();
    const treeBuilder = new WorkspaceTreeBuilder();

    const workspaceManager = new WorkspaceManager({
      gitService,
      prService,
      versionService,
      changelogService,
      treeBuilder,
    });

    core.info('✓ Services initialized');
    core.endGroup();

    // Step 6: Execute workflow
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
      changelogPreset: inputs.changelogPreset,
    };

    core.debug(
      `Workflow options: ${JSON.stringify({ ...workflowOptions, workspaces: workflowOptions.workspaces.length })}`,
    );

    const result = await workspaceManager.execute(workflowOptions);
    core.debug(`Workflow result: ${result.ok ? 'SUCCESS' : 'FAILURE'}`);
    core.endGroup();

    if (!result.ok) {
      throw result.error;
    }

    // Step 7: Set outputs
    core.startGroup('📤 Setting outputs');
    const { tag, allTags, prNumber, prMerged, tree } = result.value;

    core.debug(
      `Result value structure: ${JSON.stringify({ tag, allTags: allTags.length, prNumber, treeKeys: Object.keys(tree) })}`,
    );
    core.debug(
      `Tree root: ${JSON.stringify({ hasWorkspace: !!tree.root.workspace, hasChildren: !!tree.root.children, childrenCount: tree.root.children?.length })}`,
    );

    // Extract changed workspace paths from tree
    const changedWorkspaces = tree.root.children
      .filter((node: WorkspaceNode) => node.workspace.hasChanges)
      .map((node: WorkspaceNode) => node.workspace.path);

    core.debug(`Changed workspaces from children: ${JSON.stringify(changedWorkspaces)}`);

    // Add root if it has changes
    if (tree.root.workspace.hasChanges) {
      changedWorkspaces.unshift(tree.root.workspace.path);
      core.debug(`Root has changes, prepended: ${tree.root.workspace.path}`);
    }

    // Determine bump type by comparing old and new versions
    const oldVersion = tree.root.workspace.version;
    const newVersion = tree.root.workspace.newVersion;

    core.debug(`Version comparison: ${oldVersion} → ${newVersion}`);

    let bumpType: ActionBumpType = 'none';
    if (oldVersion !== newVersion) {
      const [oldMajor, oldMinor, oldPatch] = oldVersion.split('-')[0].split('.').map(Number);
      const [newMajor, newMinor, newPatch] = newVersion.split('-')[0].split('.').map(Number);

      core.debug(
        `Parsed versions: old=[${oldMajor}.${oldMinor}.${oldPatch}] new=[${newMajor}.${newMinor}.${newPatch}]`,
      );

      if (newVersion.includes('-')) {
        bumpType = 'pre-release';
        core.debug(`Detected pre-release version: ${newVersion}`);
      } else if (newMajor > oldMajor) {
        bumpType = 'major';
        core.debug(`Major bump detected: ${oldMajor} → ${newMajor}`);
      } else if (newMinor > oldMinor) {
        bumpType = 'minor';
        core.debug(`Minor bump detected: ${oldMinor} → ${newMinor}`);
      } else if (newPatch > oldPatch) {
        bumpType = 'patch';
        core.debug(`Patch bump detected: ${oldPatch} → ${newPatch}`);
      }
    } else {
      core.debug('No version change detected');
    }

    core.debug(`Final bump type: ${bumpType}`);

    // Set all outputs
    core.setOutput('tag', tag);
    core.setOutput('version', tree.masterVersion);
    core.setOutput('pr', prNumber?.toString() ?? '');
    core.setOutput('all_tags', allTags.join(','));
    core.setOutput('changed_workspaces', JSON.stringify(changedWorkspaces));
    core.setOutput('bump_type', bumpType);

    core.debug(
      `Outputs set: tag=${tag}, version=${tree.masterVersion}, pr=${prNumber ?? 'none'}, all_tags=${allTags.length}, changed_workspaces=${changedWorkspaces.length}, bump_type=${bumpType}`,
    );

    // Log outputs for visibility
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
      } else if (prMerged === true) {
        core.info('  ✓ PR auto-merged - tags created');
      }
    }
    core.endGroup();

    if (tag) {
      core.notice(`✨ Version bump successful: ${tree.masterVersion} (${tag})`);
    } else if (prNumber && !prMerged) {
      core.notice(`✨ Version PR #${prNumber} created: ${tree.masterVersion} - awaiting merge`);
    } else {
      core.notice(`✨ Version bump successful: ${tree.masterVersion}`);
    }
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    core.error(`❌ Version bump failed: ${errorMessage}`);
    if (errorStack) {
      core.debug(`Stack trace: ${errorStack}`);
    }

    // Log to logger for structured logging & set action has failed
    log.error({ error, errorMessage }, 'Action execution failed');
    core.setFailed(errorMessage);
  }
}

// Execute the action
run();
