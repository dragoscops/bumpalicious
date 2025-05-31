/**
 * Changelog generation utilities
 * @module utils/changelog
 */

import conventionalChangelog from 'conventional-changelog-core';
import {constants as fsConstants, createWriteStream, promises as fs} from 'fs';
import {join} from 'path';
import {pipeline} from 'stream/promises';

import {logger} from './logging.js';

export const log = logger.child({module: 'utils/changelog'});

// Log message constants
export const warnFailedToRead = 'Failed to read file';
export const warnFailedToWrite = 'Failed to write file';
export const errorNoWorkspacesProvided = 'No workspaces provided for changelog generation';
export const errorInvalidWorkspace = 'Invalid workspace provided for changelog generation';
export const infoChangelogCreated = 'Created new changelog for workspace';
export const infoChangelogUpdated = 'Updated changelog for workspace';
export const errorChangelogGeneration = 'Failed to generate changelog for workspace';
export const errorInitialChangelog = 'Failed to create initial changelog';
export const errorMergeChangelog = 'Failed to merge changelog content';

export const forMock = {
  /**
   * Check if a file exists and is accessible
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} - True if file exists, false otherwise
   */
  fileExists: async (filePath) => {
    try {
      await fs.access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Create a pipeline from a stream to a file
   * @param {stream.Readable} changelogStream - Source stream
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>} - Resolves when pipeline completes
   */
  pipeline: async (changelogStream, outputPath) => pipeline(changelogStream, createWriteStream(outputPath)),

  /**
   * Read file content with error logging
   * @param {string} filePath - Path to the file to read
   * @param {string} [encoding='utf8'] - File encoding
   * @returns {Promise<string>} - File content as string
   * @throws {Error} - Throws error if file cannot be read
   */
  readFile: async (filePath, encoding = 'utf8') => {
    try {
      return await fs.readFile(filePath, encoding);
    } catch (error) {
      log.warn({filePath, error}, warnFailedToRead);
      throw error;
    }
  },

  /**
   * Write content to file with error logging
   * @param {string} filePath - Path to the file to write
   * @param {string} content - Content to write
   * @param {string} [encoding='utf8'] - File encoding
   * @returns {Promise<void>} - Resolves when write completes
   * @throws {Error} - Throws error if file cannot be written
   */
  writeFile: async (filePath, content, encoding = 'utf8') => {
    try {
      return await fs.writeFile(filePath, content, encoding);
    } catch (error) {
      log.warn({filePath, error}, warnFailedToWrite);
      throw error;
    }
  },

  /**
   * Delete a file
   * @param {string} path - Path to the file to delete
   * @returns {Promise<void>} - Resolves when file is deleted
   */
  unlink: async (...args) => fs.unlink(...args),
};

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
 * @returns {Promise<boolean>} - Results of changelog generation
 */
export async function generateWorkspacesChangelogs(workspaces, lastTag, options = {}) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
    log.error({workspaces, lastTag}, errorNoWorkspacesProvided);
    return false;
  }

  for (const workspace of workspaces) {
    const result = await generateWorkspaceChangelog(workspace, lastTag, options);
    if (!result) {
      return false;
    }
  }

  return true;
}

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
  if (!workspace?.path) {
    log.error({workspace, lastTag}, errorInvalidWorkspace);
    return false;
  }

  const changelogPath = join(workspace.path, 'CHANGELOG.md');
  const tempPath = join(workspace.path, 'CHANGELOG.new.md');

  try {
    // Check if changelog exists, create if it doesn't
    const exists = await changelogExists(changelogPath);
    if (!exists) {
      const created = await createInitialChangelog(changelogPath);
      if (!created) {
        return false;
      }
      log.info({workspaceName: workspace.name, workspacePath: workspace.path}, infoChangelogCreated);
    }

    // Write new changelog content to temp file
    const wrote = await writeChangelogStream(createChangelogStream(workspace, lastTag, preset), tempPath);
    if (!wrote) {
      return false;
    }

    // Merge with existing content
    const merged = await mergeChangelogContent(changelogPath, tempPath);
    if (!merged) {
      return false;
    }

    log.info(
      {
        workspaceName: workspace.name,
        workspacePath: workspace.path,
        changelogPath,
      },
      infoChangelogUpdated,
    );
    return true;
  } catch (error) {
    // Clean up temp file if it exists
    try {
      const tempExists = await changelogExists(tempPath);
      if (tempExists) {
        await forMock.unlink(tempPath);
      }
    } catch {
      // Ignore errors during cleanup
    }
    log.error(
      {
        workspaceName: workspace.name,
        workspacePath: workspace.path,
        error,
      },
      errorChangelogGeneration,
    );
    return false;
  }
}

/**
 * Check if a changelog file exists
 *
 * @param {string} changelogPath - Path to the changelog file
 * @returns {Promise<boolean>} - Whether the changelog file exists
 */
export async function changelogExists(changelogPath) {
  return forMock.fileExists(changelogPath);
}

/**
 * Create a new changelog file with default header
 *
 * @param {string} changelogPath - Path to create the changelog file
 * @returns {Promise<boolean>}
 */
export async function createInitialChangelog(changelogPath) {
  try {
    await forMock.writeFile(changelogPath, DEFAULT_CHANGELOG_HEADER + '## [Unreleased]\n\n');
    return true;
  } catch (error) {
    log.error({changelogPath, error}, errorInitialChangelog);
    return false;
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
 * @returns {Promise<boolean>}
 */
export async function writeChangelogStream(changelogStream, outputPath) {
  try {
    await forMock.pipeline(changelogStream, outputPath);
    return true;
  } catch (error) {
    log.error({outputPath, error}, warnFailedToWrite);
    return false;
  }
}

/**
 * Merge the new changelog content with existing content
 *
 * @param {string} changelogPath - Path to the existing changelog
 * @param {string} newContentPath - Path to the new changelog content
 * @returns {Promise<boolean>}
 */
export async function mergeChangelogContent(changelogPath, newContentPath) {
  try {
    // Read new content
    const newContent = await forMock.readFile(newContentPath);

    // Read existing content
    const existingContent = await forMock.readFile(changelogPath);

    // Extract the header (everything before the first ## section)
    const headerRegex = /^([\s\S]*?)(?=## |$)/;
    const headerMatch = headerRegex.exec(existingContent);
    const header = headerMatch ? headerMatch[0] : DEFAULT_CHANGELOG_HEADER;

    // Merge content (header + new + existing without header)
    const mergedContent = header + newContent + existingContent.substring(header.length);

    // Write merged content
    await forMock.writeFile(changelogPath, mergedContent);

    // Clean up temp file
    await forMock.unlink(newContentPath);

    return true;
  } catch (error) {
    log.error({changelogPath, newContentPath, error}, errorMergeChangelog);
    return false;
  }
}
