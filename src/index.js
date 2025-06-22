import core from '@actions/core';
import * as workspaces from './core/workspaces.js';
import * as git from './utils/git.js';
import * as github from './utils/github.js';
import {logger} from './utils/logging.js';
import * as workspace from './utils/workspace.js';
import {projectName} from './constants.js';
import * as exec from './utils/exec.js';

const log = logger.child({module: projectName});

const warnNoChangedWorkspacesFound = 'No workspaces have changed since the last tag. No version bumping needed.';

/**
 * Main function to run the GitHub Action
 */
const run = async () => {
  try {
    // Get input parameters as a single options object
    const options = github.getOptions();
    exec.setCwd(process.env.GITHUB_WORKSPACE || process.cwd());

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

    {
      core.startGroup('Setting up Github');
      // Setup git user
      const result = await git.config.set({
        'user.name': 'GitHub Actions',
        'user.email': 'actions@github.com',
        'safe.directory': process.env.GITHUB_WORKSPACE || process.cwd(),
      });
      core.endGroup();
    }

    //======================================================================

    // Check if the commit message contains the PR message
    // If it does, we assume the PR is already created
    // and we only need to update the versions
    if (commitMessage.includes(options.prMessage)) {
      log.info(`Version PR was merged with message: ${commitMessage}`);
      core.notice(`Version PR was merged with message: ${commitMessage}`);
      // enrich all workspaces
      options.workspaces = await workspaces.enrichWorkspaces(options.workspaces, lastTag);
      const changedWorkspacesTrees = workspace.buildUpdatedWorkspacesTrees(options.workspaces);
      // create tag
      await workspaces.createVersionTags(changedWorkspacesTrees[0].workspace.version, options);
    } else {
      // If the PR message is not found, we assume the PR is not created
      // and we need go through the entire version bumping process

      // Check if the workspaces have changed since the last tag
      const changedWorkspaces = await workspaces.updateVersionsForChangedWorkspaces(commitMessage, lastTag, options);
      if (changedWorkspaces.length === 0) {
        log.warn(warnNoChangedWorkspacesFound);
        core.notice(warnNoChangedWorkspacesFound);
        return;
      } else {
        log.info({updatedWorkspaces: changedWorkspaces}, 'Changed workspaces found');
      }

      //======================================================================

      core.startGroup('Updating workspaces tree');
      // Organizes workspaces into a tree like structure to also determine the root workspace
      const changedWorkspacesTrees = workspace.buildUpdatedWorkspacesTrees(changedWorkspaces);
      if (changedWorkspacesTrees.length > 1) {
        log.error('Workspaces folder should only have a root workspace');
      }
      if (changedWorkspacesTrees.length === 0) {
        log.error('No workspaces found');
      }
      log.info(
        {workspaces: changedWorkspacesTrees},
        `Updated workspaces trees -> Found ${changedWorkspacesTrees.length} main nodes`,
      );
      core.endGroup();

      //======================================================================

      if (options.pr) {
        // If createPR is true, create a pull request with the version changes
        /** @type {import('./utils/github.js').PRCreateResponse} */
        const pr = await workspaces.createVersionPR(changedWorkspacesTrees, options);
        if (options.prAutoMerge) {
          await github.pr.merge({pullNumber: pr.number}, options);
          await github.pr.hasMerged({pullNumber: pr.number}, options);

          await git.branch.checkout(pr.base.ref);
          await git.branch.pull(pr.base.ref);
          await git.branch.remove(pr.head.ref);

          await workspaces.createVersionTags(changedWorkspacesTrees[0].workspace.version, options);
        }
      } else {
        // Otherwise, create a commit with the version changes and tags
        await workspaces.createVersionCommit(changedWorkspaces, options);
        await workspaces.createVersionTags(changedWorkspacesTrees[0].workspace.version, {
          ...options,
          workspaces: changedWorkspaces,
        });
      }
    }
  } catch (error) {
    log.error({error}, 'Version bump failed');
    core.error('Version bump failed');
  }
};

// Run the action
run();
