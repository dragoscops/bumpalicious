/**
 * GitHub Action for automated version management
 * Detects changed workspaces, bumps versions according to semantic versioning rules,
 * and optionally creates pull requests and/or tags
 *
 * @module index
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as workspace from './core/workspaces.js';
import * as git from './utils/git.js';
import * as logging from './utils/logging.js';

/**
 * @typedef {Object} Workspace
 * @property {string} name
 * @property {string} path
 * @property {string} type
 * @property {string} version
 */

/**
 * Action configuration options
 * @typedef {Object} ActionOptions
 * @property {Workspace[]} workspaces - Comma-separated workspace definitions with format "path:type"
 * @property {string} token - GitHub/Gitea token for actions like creating pull requests
 * @property {boolean} createPR - Whether to create a pull request with version changes
 * @property {boolean} createTags - Whether to create tags for version changes
 * @property {string} mergeBranch - Target branch for pull requests
 * @property {boolean} updateChangelog - Whether to update the changelog with changes since last tag
 * @property {boolean} automaticMerge - Whether to automatically merge the PR if all checks pass
 * @property {string} platform - Git platform to use ('github' or 'gitea')
 */

/**
 * Main function to run the GitHub Action
 */
const run = async () => {
  try {
    // Get input parameters as a single options object
    /** @type {ActionOptions} */
    const options = {
      workspaces: (core.getInput('workspaces') || '.:text').split(';').map(workspace.fromString),
      token: core.getInput('token'),
      createPR: core.getBooleanInput('create-pr'),
      prMessage: core.getInput('pr-message'),
      mergeBranch: core.getInput('merge-branch'),
    };

    logging.info('Affecting workspaces:', options.workspaces);

    // Setup git user
    await git.setupUser(options);

    // Get last created tag or 1st commit message
    const lastTag = await git.lastCreatedTag();
    logging.info(`Last tag: ${lastTag}`);
    if (!lastTag) {
      logging.error('No tags found in the repository');
    }

    // Get the last commit message
    const commitMessage = await git.lastCommitMessage();
    logging.info(`Latest commit message: ${commitMessage}`);
    if (!commitMessage) {
      logging.error('No commit message found');
    }

    // Check if the commit message contains the PR message
    // If it does, we assume the PR is already created
    // and we only need to update the versions
    if (!commitMessage.includes(options.prMessage)) {
      // TODO: Implement logic to handle PR message
      // workspace.mergeVersionPR(options.token);
      // TODO: Implement logic to update tags
      // workspace.createVersionTags(options);
    } else {
      // If the PR message is not found, we assume the PR is not created
      // and we need go through the entire version bumping process

      // Check if the workspaces have changed since the last tag
      const updatedWorkspaces = await workspace.updateVersionsForChangedWorkspaces();
      if (!updatedWorkspaces.length) {
        logging.warning('No workspaces have changed');
        return;
      }

      // Organizes workspaces into a tree like structure to also determine the root workspace
      const workspacesTree = buildWorkspaceTree(updatedWorkspaces);
      if (workspacesTree.length > 1) {
        logging.error('Workspaces folder should only have a root workspace');
      }
      if (workspacesTree.length === 0) {
        logging.error('No workspaces found');
      }

      console.log(workspacesTree);

      // TODO: Implement logic to bump versions
      // if (options.createPR) {
      //   // If createPR is true, create a pull request with the version changes
      //   // TODO: Implement logic to create version pull request
      //   // workspace.createVersionPR(workspacesTree, options);
      // } else {
      //   // Otherwise, create a commit with the version changes and tags
      //   // TODO: Implement logic to commit version changes
      //   // workspace.createVersionCommit(workspacesTree, options);
      //   // TODO: Implement logic to update tags
      //   // workspace.createVersionTags(options);
      // }
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    console.error(error);
  }
};

// Run the action
run();
