/**
 * Tests for changelog generation utilities
 */
import conventionalChangelog from 'conventional-changelog-core';
import {Readable} from 'stream';
import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';

import {fs, stream} from './node-wrapper.js';
import * as changelog from './changelog.js';
import {mockCConsole, unMockCConsole, setupLoggingCallsTest} from '../vitest/setup.logging.tests.js';
import {mockNode, unMockNode} from '../vitest/setup.node.test.js';

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
    mockCConsole();
    mockNode();
  });

  afterEach(() => {
    unMockCConsole();
    unMockNode();
  });

  describe('checkChangelogExists()', () => {
    it('returns true if changelog file exists', async () => {
      const result = await changelog.changelogExists('/path/to/CHANGELOG.md');

      expect(result).toBe(true);
    });

    it('returns false if changelog file does not exist', async () => {
      fs.async.access.mockRestore();
      vi.spyOn(fs.async, 'access').mockImplementation((path) => {
        throw new Error('File not found');
      });

      const result = await changelog.changelogExists('/path/to/CHANGELOG.md');

      expect(result).toBe(false);
    });
  });

  describe('createInitialChangelog()', () => {
    it('creates a new changelog file with default header', async () => {
      await changelog.createInitialChangelog('/path/to/CHANGELOG.md');
      expect(fs.async.writeFile).toHaveBeenCalledWith('/path/to/CHANGELOG.md', expect.stringContaining('# Changelog'));
    });

    it('handles errors during changelog creation', async () => {
      fs.async.writeFile.mockRestore();
      vi.spyOn(fs.async, 'writeFile').mockImplementation(() => {
        throw new Error('Write error');
      });

      await changelog.createInitialChangelog('/path/to/CHANGELOG.md');

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to create initial changelog'),
        expect.any(Error),
      ]);
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

      await changelog.writeChangelogStream(clStream, '/path/to/output.md');
      expect(stream.async.pipeline).toHaveBeenCalled();
    });
  });

  describe('mergeChangelogContent()', () => {
    it('merges new changelog content with existing content', async () => {
      await changelog.mergeChangelogContent('/path/to/CHANGELOG.md', '/path/to/CHANGELOG.new.md');

      expect(fs.async.writeFile).toHaveBeenCalledWith('/path/to/CHANGELOG.md', expect.stringContaining('# Changelog'));
      expect(fs.async.unlink).toHaveBeenCalledWith('/path/to/CHANGELOG.new.md');
    });

    it('handles errors during changelog merging', async () => {
      fs.async.writeFile.mockRestore();
      vi.spyOn(fs.async, 'writeFile').mockImplementation(() => {
        throw new Error('Write error');
      });

      await changelog.mergeChangelogContent('/path/to/CHANGELOG.md', '/path/to/CHANGELOG.new.md');

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to merge changelog content'),
        expect.any(Error),
      ]);
    });
  });

  describe('generateWorkspaceChangelog()', () => {
    it('returns false for invalid workspace', async () => {
      await changelog.generateWorkspaceChangelog(null);

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Invalid workspace provided'),
      ]);
    });

    it('generates changelog for a workspace', async () => {
      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };
      const lastTag = 'v0.9.0';

      await changelog.generateWorkspaceChangelog(workspace, lastTag);

      expect(fs.async.writeFile).toHaveBeenCalled();
      expect(fs.async.unlink).toHaveBeenCalled();
    });

    it('handles errors during changelog generation', async () => {
      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };
      const lastTag = 'v0.9.0';

      vi.spyOn(fs.async, 'writeFile').mockRejectedValueOnce(new Error('Write error'));

      await changelog.generateWorkspaceChangelog(workspace, lastTag);

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to merge changelog'),
        expect.any(Error),
      ]);
    });
  });

  describe('generateWorkspacesChangelogs()', () => {
    it('handles empty workspaces array', async () => {
      await changelog.generateWorkspacesChangelogs([], 'v0.1.0');

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('No workspaces provided'),
      ]);
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

      expect(fs.async.writeFile).toHaveBeenCalledTimes(2);
      expect(fs.async.unlink).toHaveBeenCalledTimes(2);
    });

    it('handles failures for individual workspaces', async () => {
      fs.async.writeFile.mockRestore();
      let writeCallCount = 0;
      // Mock the access function to succeed for first workspace and fail for second
      vi.spyOn(fs.async, 'writeFile').mockImplementation(() => {
        writeCallCount++;
        if (writeCallCount <= 2) {
          // First workspace's calls
          throw new Error('Write error');
        }
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

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to merge changelog content'),
        expect.any(Error),
      ]);
    });
  });
});
