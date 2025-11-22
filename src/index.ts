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
import { WorkspaceManager } from './core/WorkspaceManager.js';
import { WorkspaceTreeBuilder } from './core/WorkspaceTreeBuilder.js';
import type { ChangelogPreset } from './services/ChangelogService.js';
import { ChangelogService } from './services/ChangelogService.js';
import { GitHubService } from './services/GitHubService.js';
import { GitService } from './services/GitService.js';
import { LocalGitService } from './services/LocalGitService.js';
import { PRService } from './services/PRService.js';
import { TagService } from './services/TagService.js';
import { VersionService } from './services/VersionService.js';
import { WorkspaceService } from './services/WorkspaceService.js';
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
    const localGitService = new LocalGitService();
    const tagService = new TagService(gitService);
    const workspaceService = new WorkspaceService(gitService);
    const prService = new PRService(githubService);
    const versionService = new VersionService(gitService);
    const changelogService = new ChangelogService();
    const treeBuilder = new WorkspaceTreeBuilder();

    const workspaceManager = new WorkspaceManager({
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
      changelog: {
        preset: inputs.changelogPreset,
        skip: process.env.SKIP_CHANGELOG_GENERATION === 'true' || false,
      },
      setOutput: (name: string, value: string) => {
        core.setOutput(name, value);
        core.debug(`Output set: ${name}=${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      },
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

    // Step 7: Log results (outputs already set by WorkspaceManager)
    core.startGroup('📤 Results Summary');
    const { tag, allTags, prNumber, prMerged, tree } = result.value;

    // Log outputs for visibility
    if (tag) {
      core.info(`✓ Version tag: ${tag}`);
    }
    core.info(`✓ Version: ${tree.masterVersion}`);
    if (allTags.length > 1) {
      core.info(`✓ All tags: ${allTags.join(', ')}`);
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
