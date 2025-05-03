/**
 * Changelog generation utilities
 * @module utils/changelog
 */

import {join} from 'path';
import conventionalChangelog from 'conventional-changelog-core';
import * as logging from './logging.js';
import {fs, stream} from './node-wrapper.js';

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
 * Default changelog header content for new changelogs
 */
const DEFAULT_CHANGELOG_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

/**
 * Generate changelogs for multiple workspaces
 *
 * @param {Workspace[]} workspaces - The workspaces to generate changelogs for
 * @param {string} lastTag - The last tag to compare against (if no tag, a commit hash is used)
 * @param {Object} options - Options for changelog generation
 * @param {ChangelogPreset} [options.preset='conventionalcommits'] - The conventional-changelog preset to use
 * @returns {Promise<void>} - Results of changelog generation
 */
export async function generateWorkspacesChangelogs(workspaces, lastTag, options = {}) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
    return logging.error('No workspaces provided for changelog generation');
  }

  for (const workspace of workspaces) {
    await generateWorkspaceChangelog(workspace, lastTag, options);
  }
}

/**
 * Generates a CHANGELOG.md file for a workspace
 *
 * @param {Workspace} workspace - The workspace to generate changelog for
 * @param {string} lastTag - The last tag to compare against (if no tag, a commit hash is used)
 * @param {Object} options - Options for changelog generation
 * @param {ChangelogPreset} [options.preset='conventionalcommits'] - The conventional-changelog preset to use
 * @returns {Promise<void>} - Whether the changelog was generated successfully
 */
export async function generateWorkspaceChangelog(workspace, lastTag, {preset = 'conventionalcommits'} = {}) {
  if (!workspace || !workspace.path) {
    return logging.error('Invalid workspace provided for changelog generation');
  }

  const changelogPath = join(workspace.path, 'CHANGELOG.md');
  const tempPath = join(workspace.path, 'CHANGELOG.new.md');

  try {
    // Check if changelog exists, create if it doesn't
    const exists = await changelogExists(changelogPath);
    if (!exists) {
      await createInitialChangelog(changelogPath);
      logging.info(`Created new changelog for ${workspace.name || workspace.path}`);
    }

    // Write new changelog content to temp file
    await writeChangelogStream(createChangelogStream(workspace, lastTag, preset), tempPath);

    // Merge with existing content
    await mergeChangelogContent(changelogPath, tempPath);

    logging.info(`Updated changelog for ${workspace.name || workspace.path} at ${changelogPath}`);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      const tempExists = await changelogExists(tempPath);
      if (tempExists) {
        await fs.async.unlink(tempPath);
      }
    } catch {
      // Ignore errors during cleanup
    }
    logging.error(`Failed to generate changelog for ${workspace.name || workspace.path}:`, error);
  }
}

/**
 * Check if a changelog file exists
 *
 * @param {string} changelogPath - Path to the changelog file
 * @returns {Promise<boolean>} - Whether the changelog file exists
 */
export async function changelogExists(changelogPath) {
  try {
    await fs.async.access(changelogPath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a new changelog file with default header
 *
 * @param {string} changelogPath - Path to create the changelog file
 * @returns {Promise<void>}
 */
export async function createInitialChangelog(changelogPath) {
  try {
    return fs.async.writeFile(changelogPath, DEFAULT_CHANGELOG_HEADER + '## [Unreleased]\n\n');
  } catch (error) {
    logging.error(`Failed to create initial changelog at ${changelogPath}:`, error);
  }
}

/**
 * Create a conventional changelog stream for a workspace
 *
 * @param {Workspace} workspace - The workspace to generate changelog for
 * @param {string} lastTag - The last tag to compare against (or commit hash)
 * @param {ChangelogPreset} preset - The conventional-changelog preset to use
 * @returns {stream.Readable} - Readable stream containing the changelog
 */
export function createChangelogStream(workspace, lastTag, preset) {
  const repoInfo = {
    host: 'https://github.com',
    owner: process.env.GITHUB_REPOSITORY?.split('/')[0],
    repository: process.env.GITHUB_REPOSITORY?.split('/')[1] || '',
  };

  // Configure the conventional-changelog options
  return conventionalChangelog(
    {
      preset,
      releaseCount: 0,
      pkg: {path: workspace.path},
      cwd: workspace.path,
      // Use lastTag if provided
      from: lastTag || undefined,
    },
    {
      // Context for template rendering
      version: workspace.version,
      ...repoInfo,
      linkCompare: true,
    },
  );
}

/**
 * Write changelog stream to a file
 *
 * @param {stream.Readable} changelogStream - Stream with changelog content
 * @param {string} outputPath - Path to write the content
 * @returns {Promise<void>}
 */
export async function writeChangelogStream(changelogStream, outputPath) {
  return stream.async.pipeline(changelogStream, fs.createWriteStream(outputPath));
}

/**
 * Merge the new changelog content with existing content
 *
 * @param {string} changelogPath - Path to the existing changelog
 * @param {string} newContentPath - Path to the new changelog content
 * @returns {Promise<void>}
 */
export async function mergeChangelogContent(changelogPath, newContentPath) {
  try {
    // Read new content
    const newContent = await fs.async.readFile(newContentPath, 'utf8');

    // Read existing content
    let existingContent = await fs.async.readFile(changelogPath, 'utf8');

    // Extract the header (everything before the first ## section)
    const headerMatch = existingContent.match(/^([\s\S]*?)(?=## |$)/);
    const header = headerMatch ? headerMatch[0] : DEFAULT_CHANGELOG_HEADER;

    // Merge content (header + new + existing without header)
    const mergedContent = header + newContent + existingContent.substring(header.length);

    // Write merged content
    await fs.async.writeFile(changelogPath, mergedContent);

    // Clean up temp file
    await fs.async.unlink(newContentPath);
  } catch (error) {
    logging.error(`Failed to merge changelog content:`, error);
  }
}
