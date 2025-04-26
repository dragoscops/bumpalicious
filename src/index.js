/**
 * GitHub Action for automated version management
 * Detects changed workspaces, bumps versions according to semantic versioning rules,
 * and optionally creates pull requests and/or tags
 *
 * @module index
 */

import * as workspace from './core/workspaces.js';
import * as git from './utils/git.js';
import * as github from './utils/github.js';
import * as logging from './utils/logging.js';

/**
 * Main function to run the GitHub Action
 */
const run = async () => {
  try {
    // Get input parameters as a single options object
    /** @type {import('./utils/github.js').ActionOptions} */
    const options = github.getOptions();

    logging.info('Affecting workspaces:', options.workspaces);

    // Setup git user
    await git.config.set({
      'user.name': 'GitHub Actions',
      'user.email': 'actions@github.com',
      'safe.directory': process.env.GITHUB_WORKSPACE || process.cwd(),
    });

    // Get last created tag or 1st commit message
    const lastTag = await git.tag.lastCreated();
    logging.info(`Last tag: ${lastTag}`);
    if (!lastTag) {
      logging.error('No tags found in the repository');
    }

    // Get the last commit message
    const commitMessage = await git.log.lastMessage();
    logging.info(`Latest commit message: ${commitMessage}`);
    if (!commitMessage) {
      logging.error('No commit message found');
    }

    // Check if the commit message contains the PR message
    // If it does, we assume the PR is already created
    // and we only need to update the versions
    if (commitMessage.includes(options.prMessage)) {
      // TODO: Implement logic to handle PR message
      // workspace.mergeVersionPR(options.token);
      // TODO: Implement logic to update tags
      // workspace.createVersionTags(options);
    } else {
      // If the PR message is not found, we assume the PR is not created
      // and we need go through the entire version bumping process

      // Check if the workspaces have changed since the last tag
      const updatedWorkspaces = await workspace.updateVersionsForChangedWorkspaces(commitMessage, lastTag, options);
      if (updatedWorkspaces.length === 0) {
        logging.warning('No workspaces have changed');
        return;
      }

      // Organizes workspaces into a tree like structure to also determine the root workspace
      const updatedWorkspacesTrees = workspace.buildUpdatedWorkspacesTrees(updatedWorkspaces);
      if (updatedWorkspacesTrees.length > 1) {
        logging.error('Workspaces folder should only have a root workspace');
      }
      if (updatedWorkspacesTrees.length === 0) {
        logging.error('No workspaces found');
      }

      if (options.pr) {
        // If createPR is true, create a pull request with the version changes
        workspace.createVersionPR(workspacesTree, options);
        // if (options.prAutoMerge) {
        //   workspace.mergePR(prId, options);
        // }
      } else {
        // Otherwise, create a commit with the version changes and tags
        workspace.createVersionCommit(updatedWorkspaces, options);
        workspace.createVersionTags(updatedWorkspacesTrees[0].workspace.version, options);
      }
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    console.error(error);
  }
};

// Run the action
run();
