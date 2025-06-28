/**
 * Tests for changelog generation utilities
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import conventionalChangelog from 'conventional-changelog-core';
import { describe, it, expect, beforeEach, vi, afterEach, fail } from 'vitest';

import * as changelog from './changelog.js';
import { createTempProjectFolder, removeTempProjectFolder } from '../vitest/setup.fs.test.js';
import { mockPino, unMockPino } from '../vitest/setup.logging.tests.js';

vi.mock('conventional-changelog-core', () => ({
  default: vi.fn().mockImplementation(() => {
    const { Readable } = require('node:stream');
    const stream = new Readable();
    stream.push('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
    stream.push(null);
    return stream;
  }),
}));

/**
 * Creates a workspace object with specified properties
 * @param {string} basePath - Base path for workspace
 * @param {string} name - Workspace name
 * @param {string} version - Workspace version
 * @returns {Object} - Workspace object
 */
function createWorkspaceObject(basePath, name = 'test-project', version = '1.0.0') {
  return {
    path: basePath,
    name,
    version,
  };
}

/**
 * Creates a changelog file with specified content
 * @param {string} filePath - Path to create changelog
 * @param {string} content - Content for the changelog
 * @returns {Promise<void>}
 */
async function createChangelogFile(filePath, content = '# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n') {
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Reads a file and returns its content
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - File content
 */
async function readFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

// TODO: change and work with temp folders
describe.skip('changelog.js module', () => {
  let tempDir;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPino(changelog.log);

    // Create a fresh temp directory for each test
    tempDir = await createTempProjectFolder('changelog-test');
  });

  afterEach(async () => {
    unMockPino(changelog.log);

    // Clean up the temp directory after each test
    await removeTempProjectFolder(tempDir);
  });

  describe('changelogExists()', () => {
    it('returns true if changelog file exists', async () => {
      // Create a real changelog file
      const changelogPath = path.join(tempDir, 'CHANGELOG.md');
      await createChangelogFile(changelogPath);

      const result = await changelog.changelogExists(changelogPath);

      expect(result).toBe(true);
    });

    it('returns false if changelog file does not exist', async () => {
      // Path to a non-existent changelog file
      const changelogPath = path.join(tempDir, 'NON_EXISTENT_CHANGELOG.md');

      const result = await changelog.changelogExists(changelogPath);

      expect(result).toBe(false);
    });
  });

  describe('createInitialChangelog()', () => {
    it('creates a new changelog file with default header', async () => {
      const changelogPath = path.join(tempDir, 'CHANGELOG.md');

      const result = await changelog.createInitialChangelog(changelogPath);

      expect(result).toBe(true);

      // Verify actual file was created and contains expected content
      const content = await readFile(changelogPath);
      expect(content).toContain('# Changelog');
      expect(content).toContain('All notable changes to this project');
    });

    it('handles errors during changelog creation', async () => {
      // Use an invalid path to force an error
      // Creating a directory with the same name as the desired file to cause failure
      const badDir = path.join(tempDir, 'CHANGELOG.md');
      await fs.mkdir(badDir);

      const result = await changelog.createInitialChangelog(badDir);

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        { changelogPath: badDir, error: expect.any(Error) },
        changelog.errorInitialChangelog,
      );
    });
  });

  describe('createChangelogStream()', () => {
    it('creates a changelog stream with the correct options', () => {
      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };
      const lastTag = 'v0.9.0';
      const preset = 'conventionalcommits';

      changelog.createChangelogStream(workspace, lastTag, preset);

      expect(conventionalChangelog).toHaveBeenCalledWith(
        expect.objectContaining({
          preset,
          releaseCount: 0,
          pkg: { path: workspace.path },
          cwd: workspace.path,
          from: lastTag,
        }),
        expect.objectContaining({
          version: workspace.version,
          linkCompare: true,
        }),
      );
    });
  });

  describe('writeChangelogStream()', () => {
    it('pipes the changelog stream to the output file', async () => {
      const clStream = new Readable();
      clStream.push('Test content');
      clStream.push(null);

      const outputPath = path.join(tempDir, 'output.md');

      const result = await changelog.writeChangelogStream(clStream, outputPath);

      expect(result).toBe(true);

      // Verify file was actually created with correct content
      const content = await readFile(outputPath);
      expect(content).toBe('Test content');
    });

    it('handles errors during stream writing', async () => {
      const clStream = new Readable();
      clStream.push('Test content');
      clStream.push(null);

      // Use an invalid path to force an error
      // Creating a directory with the same name as the desired file to cause failure
      const badDir = path.join(tempDir, 'output.md');
      await fs.mkdir(badDir);

      const result = await changelog.writeChangelogStream(clStream, badDir);

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        { outputPath: badDir, error: expect.any(Error) },
        changelog.warnFailedToWrite,
      );
    });
  });

  describe('mergeChangelogContent()', () => {
    it('merges new changelog content with existing content', async () => {
      // Create both files with content
      const changelogPath = path.join(tempDir, 'CHANGELOG.md');
      const newContentPath = path.join(tempDir, 'CHANGELOG.new.md');

      await createChangelogFile(changelogPath, '# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n');
      await createChangelogFile(newContentPath, '## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');

      const result = await changelog.mergeChangelogContent(changelogPath, newContentPath);

      expect(result).toBe(true);

      // Verify the merged content
      const content = await readFile(changelogPath);
      expect(content).toContain('# Changelog');
      expect(content).toContain('## 1.0.0 (2023-04-27)');

      // Verify the new content file was deleted
      try {
        await fs.access(newContentPath);
        fail('The new content file should have been deleted');
      } catch (error) {
        expect(error.code).toBe('ENOENT');
      }
    });

    it('handles errors during changelog merging', async () => {
      // Create the new content file but make changelog path a directory to force error
      const changelogDir = path.join(tempDir, 'CHANGELOG.md');
      const newContentPath = path.join(tempDir, 'CHANGELOG.new.md');

      await fs.mkdir(changelogDir);
      await createChangelogFile(newContentPath, '## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');

      const result = await changelog.mergeChangelogContent(changelogDir, newContentPath);

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        {
          changelogPath: changelogDir,
          newContentPath: newContentPath,
          error: expect.any(Error),
        },
        changelog.errorMergeChangelog,
      );
    });
  });

  describe('generateWorkspaceChangelog()', () => {
    it('returns false for invalid workspace', async () => {
      const result = await changelog.generateWorkspaceChangelog(null);

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        { workspace: null, lastTag: undefined },
        changelog.errorInvalidWorkspace,
      );
    });

    it('generates changelog for a workspace', async () => {
      // Create workspace directory
      const workspacePath = path.join(tempDir, 'workspace');
      await fs.mkdir(workspacePath);

      const workspace = createWorkspaceObject(workspacePath);
      const lastTag = 'v0.9.0';

      const result = await changelog.generateWorkspaceChangelog(workspace, lastTag);

      expect(result).toBe(true);

      // Verify changelog was created
      const changelogPath = path.join(workspacePath, 'CHANGELOG.md');
      const content = await readFile(changelogPath);
      expect(content).toContain('# Changelog');

      expect(changelog.log.info).toHaveBeenCalledWith(
        { workspaceName: workspace.name, workspacePath: workspace.path },
        changelog.infoChangelogCreated,
      );
    });

    it('handles errors during changelog generation', async () => {
      // Create a workspace directory but make it read-only to cause failure
      const workspacePath = path.join(tempDir, 'workspace-error');
      await fs.mkdir(workspacePath);

      // Make directory readonly (will cause error when writing changelog)
      // Creating a file where the CHANGELOG.md should be to cause an error
      await fs.writeFile(path.join(workspacePath, 'CHANGELOG.md'), '');
      await fs.chmod(path.join(workspacePath, 'CHANGELOG.md'), 0o444); // Read-only

      const workspace = createWorkspaceObject(workspacePath);
      const lastTag = 'v0.9.0';

      const result = await changelog.generateWorkspaceChangelog(workspace, lastTag);

      expect(result).toBe(false);
      // Error could be in different places depending on exact implementation
      // so we just check that the result is false indicating failure
    });
  });

  describe('generateWorkspacesChangelogs()', () => {
    it('handles empty workspaces array', async () => {
      await changelog.generateWorkspacesChangelogs([], 'v0.1.0');

      expect(changelog.log.error).toHaveBeenCalledWith(
        { workspaces: [], lastTag: 'v0.1.0' },
        changelog.errorNoWorkspacesProvided,
      );
    });

    it('handles null workspaces', async () => {
      await changelog.generateWorkspacesChangelogs(null, 'v0.1.0');

      expect(changelog.log.error).toHaveBeenCalledWith(
        { workspaces: null, lastTag: 'v0.1.0' },
        changelog.errorNoWorkspacesProvided,
      );
    });

    it('generates changelogs for multiple workspaces', async () => {
      // Create workspace directories
      const workspace1Path = path.join(tempDir, 'workspace1');
      const workspace2Path = path.join(tempDir, 'workspace2');
      await fs.mkdir(workspace1Path);
      await fs.mkdir(workspace2Path);

      const workspaces = [
        createWorkspaceObject(workspace1Path, 'project1', '1.0.0'),
        createWorkspaceObject(workspace2Path, 'project2', '2.0.0'),
      ];
      const lastTag = 'v0.9.0';

      const result = await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

      expect(result).toBe(true);

      // Verify changelogs were created for both workspaces
      const changelog1Path = path.join(workspace1Path, 'CHANGELOG.md');
      const changelog2Path = path.join(workspace2Path, 'CHANGELOG.md');

      expect(await readFile(changelog1Path)).toContain('# Changelog');
      expect(await readFile(changelog2Path)).toContain('# Changelog');
    });

    it('handles failures for individual workspaces', async () => {
      // Create one good workspace and one that will fail (read-only)
      const workspace1Path = path.join(tempDir, 'workspace1-good');
      const workspace2Path = path.join(tempDir, 'workspace2-bad');
      await fs.mkdir(workspace1Path);
      await fs.mkdir(workspace2Path);

      // Make second workspace directory have a problematic CHANGELOG.md
      await fs.writeFile(path.join(workspace2Path, 'CHANGELOG.md'), '');
      await fs.chmod(path.join(workspace2Path, 'CHANGELOG.md'), 0o444); // Read-only

      const workspaces = [
        createWorkspaceObject(workspace1Path, 'project1', '1.0.0'),
        createWorkspaceObject(workspace2Path, 'project2', '2.0.0'),
      ];
      const lastTag = 'v0.9.0';

      const result = await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

      // Since one workspace fails, the overall operation should return false
      expect(result).toBe(false);

      // First workspace should still have a changelog because it's processed before the error
      const changelog1Path = path.join(workspace1Path, 'CHANGELOG.md');
      expect(await readFile(changelog1Path)).toContain('# Changelog');

      // Verify that error was logged for the problematic workspace
      expect(changelog.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          changelogPath: path.join(workspace2Path, 'CHANGELOG.md'),
          newContentPath: expect.stringContaining(workspace2Path),
          error: expect.any(Error),
        }),
        changelog.errorMergeChangelog,
      );
    });
  });
});
