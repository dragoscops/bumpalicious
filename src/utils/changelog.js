/**
 * Changelog generation utilities
 * @module utils/changelog
 */

import {join} from 'path';
import {writeFile, access} from 'fs/promises';
import {constants} from 'fs';
import conventionalChangelog from 'conventional-changelog-core';
import {createReadStream, createWriteStream} from 'fs';
import {Readable} from 'stream';
import * as logging from './logging.js';

/**
 * @typedef {import('./workspace.js').Workspace} Workspace
 */

/**
 * @typedef {'angular' | 'atom' | 'codemirror' | 'conventionalcommits'
 *            | 'ember' | 'eslint' | 'express' | 'jquery'
 *            | 'jshint' | 'gitlab'} ChangelogPreset
 *
 * @link https://github.com/conventional-changelog/conventional-changelog
 * @link https://www.conventionalcommits.org/en/v1.0.0/
 */

/**
 * Generates a CHANGELOG.md file for a workspace
 *
 * @param {Workspace} workspace - The workspace to generate changelog for
 * @param {string} lastTag - The last tag to compare against (if no tag, a commit hash is used)
 * @param {Object} options - Options for changelog generation
 * @param {ChangelogPreset} [options.preset='conventionalcommits'] - The conventional-changelog preset to use
 * @returns {Promise<boolean>} - Whether the changelog was generated successfully
 */
export async function generateWorkspaceChangelog(workspace, lastTag, {preset = 'conventionalcommits'} = {}) {
  const changelogPath = join(workspace.path, 'CHANGELOG.md');
  let changelogExists = false;

  try {
    await access(changelogPath, constants.F_OK);
    changelogExists = true;
  } finally {
  }

  // Create a readable stream for the changelog content
  const changelogStream = conventionalChangelog(
    {
      preset,
      releaseCount: 0, // 0 means all releases, you can set this to limit the number
      pkg: {
        path: workspace.path,
      },
      // The current working directory is important for git history
      cwd: workspace.path,
    },
    {
      // Context is used for template rendering
      version: workspace.version,
      host: 'https://github.com',
      owner: process.env.GITHUB_REPOSITORY?.split('/')[0],
      repository: process.env.GITHUB_REPOSITORY?.split('/')[1] || '',
      linkCompare: true,
    },
    // If you need to override the commit parsing logic
    {},
    // If you need to override the writer options
    {},
    // If you need to override the git raw commit option
    {},
  );

  if (!changelogExists) {
    await writeFile(
      changelogPath,
      `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

`,
    );
  }

  try {
    // Create a readable stream of the changelog content
    return new Promise((resolve, reject) => {
      // First, read the existing content
      const existingContent = createReadStream(changelogPath);

      // Then create a writable stream for the new content
      const tempPath = join(workspace.path, 'CHANGELOG.new.md');
      const output = createWriteStream(tempPath);

      // Pipe the new changelog content to the output
      changelogStream.pipe(output, {end: false});

      // When the new content is done, append the existing content
      changelogStream.on('end', () => {
        existingContent.pipe(output);
      });

      output.on('finish', async () => {
        try {
          // Rename the temp file to the final changelog
          await writeFile(changelogPath, '');
          const finalOutput = createWriteStream(changelogPath);
          const newContent = createReadStream(tempPath);
          newContent.pipe(finalOutput);

          newContent.on('end', () => {
            logging.info(`Updated changelog for ${workspace.name} at ${changelogPath}`);
            resolve(true);
          });

          finalOutput.on('error', (err) => {
            logging.error(`Failed to write final changelog for ${workspace.name}:`, err);
            reject(err);
          });
        } catch (err) {
          logging.error(`Failed to update changelog for ${workspace.name}:`, err);
          reject(err);
        }
      });

      output.on('error', (err) => {
        logging.error(`Failed to write temporary changelog for ${workspace.name}:`, err);
        reject(err);
      });

      existingContent.on('error', (err) => {
        logging.error(`Failed to read existing changelog for ${workspace.name}:`, err);
        reject(err);
      });
    });
  } catch (error) {
    logging.error(`Failed to generate changelog for ${workspace.name}:`, error);
    return false;
  }
}

/**
 * Generate changelogs for multiple workspaces
 *
 * @param {Workspace[]} workspaces - The workspaces to generate changelogs for
 * @param {Object} options - Options for changelog generation
 * @param {boolean} [options.firstRelease=false] - Whether this is the first release
 * @param {string} [options.preset='conventionalcommits'] - The conventional-changelog preset to use
 * @param {boolean} [options.append=true] - Whether to append to an existing changelog
 * @returns {Promise<Array<{workspace: Workspace, success: boolean}>>} - Results of changelog generation
 */
export async function generateWorkspacesChangelogs(workspaces, options = {}) {
  const results = [];

  for (const workspace of workspaces) {
    try {
      const success = await generateWorkspaceChangelog(workspace, options);
      results.push({workspace, success});
    } catch (error) {
      logging.error(`Failed to generate changelog for ${workspace.name}:`, error);
      results.push({workspace, success: false});
    }
  }

  return results;
}
