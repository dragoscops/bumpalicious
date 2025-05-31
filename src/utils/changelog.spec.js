/**
 * Tests for changelog generation utilities
 */
import conventionalChangelog from 'conventional-changelog-core';
import {Readable} from 'stream';
import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';

import * as changelog from './changelog.js';
import {mockPino, unMockPino} from '../vitest/setup.logging.tests.js';

vi.mock('conventional-changelog-core', () => ({
  default: vi.fn().mockImplementation(() => {
    const {Readable} = require('stream');
    const stream = new Readable();
    stream.push('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
    stream.push(null);
    return stream;
  }),
}));

describe('changelog.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPino(changelog.log);

    // Mock forMock functions
    vi.spyOn(changelog.forMock, 'fileExists').mockResolvedValue(true);
    vi.spyOn(changelog.forMock, 'readFile').mockImplementation((path) => {
      if (String(path).includes('.new.md')) {
        return Promise.resolve('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
      }
      return Promise.resolve('# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n');
    });
    vi.spyOn(changelog.forMock, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(changelog.forMock, 'unlink').mockResolvedValue(undefined);
    vi.spyOn(changelog.forMock, 'pipeline').mockResolvedValue(undefined);
  });

  afterEach(() => {
    unMockPino(changelog.log);

    // Restore forMock spies
    changelog.forMock.fileExists.mockRestore?.();
    changelog.forMock.readFile.mockRestore?.();
    changelog.forMock.writeFile.mockRestore?.();
    changelog.forMock.unlink.mockRestore?.();
    changelog.forMock.pipeline.mockRestore?.();
  });

  describe('checkChangelogExists()', () => {
    it('returns true if changelog file exists', async () => {
      const result = await changelog.changelogExists('/path/to/CHANGELOG.md');

      expect(result).toBe(true);
      expect(changelog.forMock.fileExists).toHaveBeenCalledWith('/path/to/CHANGELOG.md');
    });

    it('returns false if changelog file does not exist', async () => {
      changelog.forMock.fileExists.mockResolvedValueOnce(false);

      const result = await changelog.changelogExists('/path/to/CHANGELOG.md');

      expect(result).toBe(false);
      expect(changelog.forMock.fileExists).toHaveBeenCalledWith('/path/to/CHANGELOG.md');
    });
  });

  describe('createInitialChangelog()', () => {
    it('creates a new changelog file with default header', async () => {
      const result = await changelog.createInitialChangelog('/path/to/CHANGELOG.md');

      expect(result).toBe(true);
      expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
        '/path/to/CHANGELOG.md',
        expect.stringContaining('# Changelog'),
      );
    });

    it('handles errors during changelog creation', async () => {
      changelog.forMock.writeFile.mockRejectedValueOnce(new Error('Write error'));

      const result = await changelog.createInitialChangelog('/path/to/CHANGELOG.md');

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        {changelogPath: '/path/to/CHANGELOG.md', error: expect.any(Error)},
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
          pkg: {path: workspace.path},
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

      const result = await changelog.writeChangelogStream(clStream, '/path/to/output.md');

      expect(result).toBe(true);
      expect(changelog.forMock.pipeline).toHaveBeenCalledWith(clStream, '/path/to/output.md');
    });

    it('handles errors during stream writing', async () => {
      const clStream = new Readable();
      clStream.push('Test content');
      clStream.push(null);

      changelog.forMock.pipeline.mockRejectedValueOnce(new Error('Pipeline error'));

      const result = await changelog.writeChangelogStream(clStream, '/path/to/output.md');

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        {outputPath: '/path/to/output.md', error: expect.any(Error)},
        changelog.warnFailedToWrite,
      );
    });
  });

  describe('mergeChangelogContent()', () => {
    it('merges new changelog content with existing content', async () => {
      const result = await changelog.mergeChangelogContent('/path/to/CHANGELOG.md', '/path/to/CHANGELOG.new.md');

      expect(result).toBe(true);
      expect(changelog.forMock.readFile).toHaveBeenCalledWith('/path/to/CHANGELOG.new.md');
      expect(changelog.forMock.readFile).toHaveBeenCalledWith('/path/to/CHANGELOG.md');
      expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
        '/path/to/CHANGELOG.md',
        expect.stringContaining('# Changelog'),
      );
      expect(changelog.forMock.unlink).toHaveBeenCalledWith('/path/to/CHANGELOG.new.md');
    });

    it('handles errors during changelog merging', async () => {
      changelog.forMock.writeFile.mockRejectedValueOnce(new Error('Write error'));

      const result = await changelog.mergeChangelogContent('/path/to/CHANGELOG.md', '/path/to/CHANGELOG.new.md');

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        {
          changelogPath: '/path/to/CHANGELOG.md',
          newContentPath: '/path/to/CHANGELOG.new.md',
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
        {workspace: null, lastTag: undefined},
        changelog.errorInvalidWorkspace,
      );
    });

    it('generates changelog for a workspace', async () => {
      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };
      const lastTag = 'v0.9.0';

      // Mock changelog doesn't exist initially
      changelog.forMock.fileExists.mockResolvedValueOnce(false);

      const result = await changelog.generateWorkspaceChangelog(workspace, lastTag);

      expect(result).toBe(true);
      expect(changelog.forMock.writeFile).toHaveBeenCalled();
      expect(changelog.forMock.unlink).toHaveBeenCalled();
      expect(changelog.log.info).toHaveBeenCalledWith(
        {workspaceName: workspace.name, workspacePath: workspace.path},
        changelog.infoChangelogCreated,
      );
    });

    it('handles errors during changelog generation', async () => {
      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };
      const lastTag = 'v0.9.0';

      // Mock the mergeChangelogContent step to fail by making writeFile fail on the merge step
      // This simulates an error during the file merge operation
      changelog.forMock.writeFile.mockImplementation((path, content) => {
        // Let the initial changelog creation succeed, but fail on merge
        if (path.includes('CHANGELOG.md') && !path.includes('.new.md')) {
          throw new Error('Write error');
        }
        return Promise.resolve();
      });

      const result = await changelog.generateWorkspaceChangelog(workspace, lastTag);

      expect(result).toBe(false);
      expect(changelog.log.error).toHaveBeenCalledWith(
        {
          changelogPath: expect.stringContaining('CHANGELOG.md'),
          newContentPath: expect.stringContaining('CHANGELOG.new.md'),
          error: expect.any(Error),
        },
        changelog.errorMergeChangelog,
      );
    });
  });

  describe('generateWorkspacesChangelogs()', () => {
    it('handles empty workspaces array', async () => {
      await changelog.generateWorkspacesChangelogs([], 'v0.1.0');

      expect(changelog.log.error).toHaveBeenCalledWith(
        {workspaces: [], lastTag: 'v0.1.0'},
        changelog.errorNoWorkspacesProvided,
      );
    });

    it('handles null workspaces', async () => {
      await changelog.generateWorkspacesChangelogs(null, 'v0.1.0');

      expect(changelog.log.error).toHaveBeenCalledWith(
        {workspaces: null, lastTag: 'v0.1.0'},
        changelog.errorNoWorkspacesProvided,
      );
    });

    it('generates changelogs for multiple workspaces', async () => {
      const workspaces = [
        {
          path: '/test/workspace1',
          name: 'project1',
          version: '1.0.0',
        },
        {
          path: '/test/workspace2',
          name: 'project2',
          version: '2.0.0',
        },
      ];
      const lastTag = 'v0.9.0';

      await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

      expect(changelog.forMock.writeFile).toHaveBeenCalled();
      expect(changelog.forMock.unlink).toHaveBeenCalled();
    });

    it('handles failures for individual workspaces', async () => {
      // Mock writeFile to fail during the merge step for both workspaces
      changelog.forMock.writeFile.mockImplementation((path, content) => {
        // Let the initial changelog creation succeed, but fail on merge
        if (path.includes('CHANGELOG.md') && !path.includes('.new.md')) {
          throw new Error('Write error');
        }
        return Promise.resolve();
      });

      const workspaces = [
        {
          path: '/test/workspace1',
          name: 'project1',
          version: '1.0.0',
        },
        {
          path: '/test/workspace2',
          name: 'project2',
          version: '2.0.0',
        },
      ];
      const lastTag = 'v0.9.0';

      await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

      expect(changelog.log.error).toHaveBeenCalledWith(
        {
          changelogPath: expect.stringContaining('workspace1'),
          newContentPath: expect.stringContaining('workspace1'),
          error: expect.any(Error),
        },
        changelog.errorMergeChangelog,
      );
    });
  });
});
