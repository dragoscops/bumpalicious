/**
 * GitHub Action for automated version management
 * Detects changed workspaces, bumps versions according to semantic versioning rules,
 * and optionally creates pull requests and/or tags
 *
 * @module index
 */

import core from '@actions/core';
import * as workspaces from './core/workspaces.js';
import * as git from './utils/git.js';
import * as github from './utils/github.js';
import {logger} from './utils/logging.js';
import * as workspace from './utils/workspace.js';
import {projectName} from './constants.js';

const log = logger.child({module: projectName});

const warnNoChangedWorkspacesFound = 'No workspaces have changed since the last tag. No version bumping needed.';

/**
 * Main function to run the GitHub Action
 */
const run = async () => {
  try {
    // Get input parameters as a single options object
    const options = github.getOptions();

    //======================================================================

    core.startGroup('Gathering workspaces info');
    log.info({options}, 'Options received');

    // Get last created tag or 1st commit message
    const lastTag = await git.tag.lastCreated();
    if (!lastTag) {
      core.error('No tags found in the repository. Please create a tag before running this action.');
    }
    log.info({lastTag}, 'Last created tag');
    core.notice(`Last created tag: ${lastTag}`);

    // Get the last commit message
    const commitMessage = await git.commits.lastMessage();
    if (!commitMessage) {
      core.error('No commit messages found in the repository. Please make a commit before running this action.');
    }
    log.info({commitMessage}, 'Last commit message');
    core.notice(`Last commit message: ${commitMessage}`);
    core.endGroup();

    //======================================================================

    core.startGroup('Setting up Github');
    // Setup git user
    await git.config.set({
      'user.name': 'GitHub Actions',
      'user.email': 'actions@github.com',
      'safe.directory': process.env.GITHUB_WORKSPACE || process.cwd(),
    });
    core.endGroup();

    //======================================================================

    // Check if the commit message contains the PR message
    // If it does, we assume the PR is already created
    // and we only need to update the versions
    if (commitMessage.includes(options.prMessage)) {
      log.info(`Version PR was merged with message: ${commitMessage}`);
      core.notice(`Version PR was merged with message: ${commitMessage}`);
      // enrich all workspaces
      const changedWorkspaces = await workspaces.enrichWorkspaces(options.workspaces, lastTag);
      const changedWorkspacesTrees = workspace.buildUpdatedWorkspacesTrees(changedWorkspaces);
      // create tag
      workspaces.createVersionTags(changedWorkspacesTrees[0].workspace.version, options);
    } else {
      // If the PR message is not found, we assume the PR is not created
      // and we need go through the entire version bumping process

      // Check if the workspaces have changed since the last tag
      // TODO: rename to changedWorkspaces
      const updatedWorkspaces = await workspaces.updateVersionsForChangedWorkspaces(commitMessage, lastTag, options);
      if (updatedWorkspaces.length === 0) {
        log.warn(warnNoChangedWorkspacesFound);
        core.notice(warnNoChangedWorkspacesFound);
        return;
      } else {
        log.info({updatedWorkspaces}, 'Changed workspaces found');
      }

      //======================================================================

      core.startGroup('Updating workspaces tree');
      // Organizes workspaces into a tree like structure to also determine the root workspace
      const updatedWorkspacesTrees = workspace.buildUpdatedWorkspacesTrees(updatedWorkspaces);
      if (updatedWorkspacesTrees.length > 1) {
        log.error('Workspaces folder should only have a root workspace');
      }
      if (updatedWorkspacesTrees.length === 0) {
        log.error('No workspaces found');
      }
      log.info(
        {workspaces: updatedWorkspacesTrees},
        `Updated workspaces trees -> Found ${updatedWorkspacesTrees.length} main nodes`,
      );
      core.endGroup();

      //======================================================================

      if (options.pr) {
        // If createPR is true, create a pull request with the version changes
        /** @type {import('./utils/github.js').PRCreateResponse} */
        const pr = await workspaces.createVersionPR(updatedWorkspacesTrees, options);
        if (options.prAutoMerge) {
          await github.pr.merge({pullNumber: pr.number}, options);
          await github.pr.hasMerged({pullNumber: pr.number}, options);

          await git.branch.checkout(pr.base.ref);
          await git.branch.pull(pr.base.ref);
          await git.branch.remove(pr.head.ref);

          await workspaces.createVersionTags(updatedWorkspacesTrees[0].workspace.version, options);
        }
      } else {
        // Otherwise, create a commit with the version changes and tags
        await workspaces.createVersionCommit(updatedWorkspaces, options);
        await workspaces.createVersionTags(updatedWorkspacesTrees[0].workspace.version, options);
      }
    }
  } catch (error) {
    log.error({error}, 'Version bump failed');
    core.error('Version bump failed');
  }
};

// Run the action
run();
