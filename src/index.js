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
      // createPR: core.getInput('create-pr') === 'true',
      // createTags: core.getInput('create-tags') === 'true',
      // mergeBranch: core.getInput('merge-branch') || 'main',
      // updateChangelog: core.getInput('update-changelog') === 'true',
      // automaticMerge: core.getInput('automatic-merge') === 'true',
      platform: (core.getInput('git-platform') || 'github').toLowerCase(),
    };

    console.log(options)

    logging.info('Affecting workspaces:', options.workspaces);

    // validate platform value
    git.validatePlatform(options.platform);

    // Setup git user
    await git.setupUser(options);
    const lastTag = await git.lastCreatedTag();
    logging.info(`Last tag: ${lastTag}`);
    if (!lastTag) {
      logging.error('No tags found in the repository');
    }

    const commitMessage = await git.lastCommitMessage();
    logging.info(`Latest commit message: ${commitMessage}`);
    if (!commitMessage) {
      logging.error('No commit message found');
    }

    const changedWorkspaces = workspace.enrichChangedWorkspaces(options.workspaces, lastTag);
    logging.info('Workspaces:', changedWorkspaces);
    if (changedWorkspaces.length === 0) {
      logging.warning('No changed workspaces found');
      return;
    }

    //   // Store changed workspaces information as output
    //   const changedWorkspacesInfo = changedWorkspaces.map(ws =>
    //     `${ws.path}:${ws.type}:${ws.name}:${ws.version}`
    //   ).join(',');

    //   if (changedWorkspacesInfo) {
    //     storeOutput('changed_workspaces_info', changedWorkspacesInfo);
    //   } else {
    //     console.log('No changed workspaces detected.');
    //     return;
    //   }

    //   // Increase versions based on commit message
    //   const updatedWorkspaces = await increaseWorkspacesVersions({
    //     workspacesInfo: changedWorkspaces,
    //     commitMessage
    //   });

    //   // Store updated workspaces information as output
    //   const updatedWorkspacesInfo = updatedWorkspaces.map(ws =>
    //     `${ws.path}:${ws.type}:${ws.name}:${ws.updatedVersion || ws.version}`
    //   ).join(',');

    //   if (updatedWorkspacesInfo) {
    //     storeOutput('updated_workspaces_info', updatedWorkspacesInfo);
    //   }

    //   // Check if any version was actually updated
    //   const hasVersionUpdates = updatedWorkspaces.some(ws =>
    //     ws.updatedVersion && ws.updatedVersion !== ws.version
    //   );

    //   if (!hasVersionUpdates) {
    //     console.log('No version updates needed based on commit messages.');
    //     return;
    //   }

    //   // Update version files in workspaces
    //   await updateWorkspacesVersions(updatedWorkspaces);

    //   // Generate changelog if requested
    //   let changelogContent = '';
    //   if (options.updateChangelog) {
    //     changelogContent = await buildChangelog({
    //       lastTag,
    //       format: 'markdown',
    //       groupByType: true
    //     });

    //     if (changelogContent) {
    //       console.log('Generated changelog:\n', changelogContent);
    //     }
    //   }

    //   // Determine the overall new version (use the first workspace's update as reference)
    //   const firstWorkspace = updatedWorkspaces.find(ws => ws.updatedVersion) || updatedWorkspaces[0];
    //   const newVersion = firstWorkspace.updatedVersion || firstWorkspace.version;

    //   // Handle PR creation if requested
    //   if (options.createPR) {
    //     const prTitle = `chore: Update version to ${newVersion}`;
    //     const prMessage = changelogContent || `Update version to ${newVersion}`;

    //     // Create a version branch, commit changes, and push
    //     const versionBranch = await createVersionBranch({
    //       version: newVersion,
    //       mergeBranch,
    //       prTitle,
    //       prMessage
    //     });

    //     // Create pull request
    //     if (options.token) {
    //       const pr = await createPullRequest({
    //         token: options.token,
    //         title: prTitle,
    //         body: prMessage,
    //         head: versionBranch,
    //         base: mergeBranch
    //       });

    //       console.log(`Created PR #${pr.number}: ${pr.html_url}`);
    //       storeOutput('pr_number', `${pr.number}`);
    //       storeOutput('pr_url', pr.html_url);

    //       // TODO: Add automatic merge if requested
    //       if (options.automaticMerge) {
    //         // This would require additional octokit calls to merge the PR
    //         // Leaving as a TODO for now
    //       }
    //     } else {
    //       console.log('No GitHub token provided, skipping PR creation.');
    //     }
    //   } else {
    //     // If not creating a PR, commit changes directly to the current branch
    //     await commitVersionChanges({
    //       version: newVersion,
    //       branch: github.context.ref.replace('refs/heads/', ''),
    //       title: `Update version to ${newVersion}`,
    //       message: `Update version to ${newVersion}`,
    //       changelog: changelogContent
    //     });
    //   }

    //   // Create tags if requested
    //   if (options.createTags) {
    //     // Create a tag for each workspace with version updates
    //     for (const workspace of updatedWorkspaces) {
    //       if (workspace.updatedVersion && workspace.updatedVersion !== workspace.version) {
    //         const tagMessage = `Release ${workspace.name} v${workspace.updatedVersion}`;
    //         const tagName = await createTag({
    //           version: workspace.updatedVersion,
    //           tagMessage,
    //           refreshMinor: true
    //         });

    //         console.log(`Created tag ${tagName} for ${workspace.name}`);
    //       }
    //     }
    //   }

    //   // Output final results
    //   storeOutput('version', newVersion);
    //   console.log(`Successfully updated version to ${newVersion}`);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    console.error(error);
  }
};

// Run the action
run();
