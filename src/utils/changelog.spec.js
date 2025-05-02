/**
 * Tests for changelog generation utilities
 */
import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import * as fsPromises from 'fs/promises';
import * as changelog from './changelog.js';
import {mockCConsole, unMockCConsole, setupLoggingCallsTest} from '../vitest/setup.logging.tests.js';

// Mock the modules
vi.mock('fs/promises');
vi.mock('fs', () => ({
  constants: {F_OK: 0},
  createWriteStream: vi.fn(() => ({pipe: vi.fn()})),
}));
vi.mock('conventional-changelog-core', () => ({
  default: vi.fn().mockImplementation(() => {
    const {Readable} = require('stream');
    const stream = new Readable();
    stream.push('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
    stream.push(null);
    return stream;
  }),
}));
vi.mock('stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

describe('changelog.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCConsole();

    // Setup default mock implementations
    vi.mocked(fsPromises.access).mockImplementation((path) => {
      if (path.includes('existingChangelog')) {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error('File not found'));
    });

    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

    vi.mocked(fsPromises.readFile).mockImplementation((path) => {
      if (String(path).includes('.new.md')) {
        return Promise.resolve('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
      }
      return Promise.resolve('# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n');
    });

    vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);
  });

  afterEach(() => {
    unMockCConsole();
  });

  describe('checkChangelogExists()', () => {
    it('returns true if changelog file exists', async () => {
      vi.mocked(fsPromises.access).mockResolvedValueOnce(undefined);

      const result = await changelog.checkChangelogExists('/path/to/CHANGELOG.md');
      expect(result).toBe(true);
    });

    it('returns false if changelog file does not exist', async () => {
      vi.mocked(fsPromises.access).mockRejectedValueOnce(new Error('File not found'));

      const result = await changelog.checkChangelogExists('/path/to/CHANGELOG.md');
      expect(result).toBe(false);
    });
  });

  describe('createInitialChangelog()', () => {
    it('creates a new changelog file with default header', async () => {
      const fsPromises = require('fs/promises');
      await changelog.createInitialChangelog('/path/to/CHANGELOG.md');

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        '/path/to/CHANGELOG.md',
        expect.stringContaining('# Changelog'),
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

      const conventionalChangelog = require('conventional-changelog-core').default;

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
      const {Readable} = require('stream');
      const stream = new Readable();
      stream.push('Test content');
      stream.push(null);

      const pipelineMock = require('stream/promises').pipeline;

      await changelog.writeChangelogStream(stream, '/path/to/output.md');

      expect(pipelineMock).toHaveBeenCalled();
    });
  });

  describe('mergeChangelogContent()', () => {
    it('merges new changelog content with existing content', async () => {
      const fsPromises = require('fs/promises');
      fsPromises.readFile.mockImplementation((path) => {
        if (path.includes('.new.md')) {
          return Promise.resolve('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
        }
        return Promise.resolve('# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n');
      });

      await changelog.mergeChangelogContent('/path/to/CHANGELOG.md', '/path/to/CHANGELOG.new.md');

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        '/path/to/CHANGELOG.md',
        expect.stringContaining('# Changelog'),
      );
      expect(fsPromises.unlink).toHaveBeenCalledWith('/path/to/CHANGELOG.new.md');
    });
  });

  describe('generateWorkspaceChangelog()', () => {
    it('returns false for invalid workspace', async () => {
      const result = await changelog.generateWorkspaceChangelog(null);
      expect(result).toBe(false);

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

      // Mock fs/promises.access to simulate non-existent file
      const fsPromises = require('fs/promises');
      fsPromises.access.mockRejectedValueOnce(new Error('File not found'));

      const result = await changelog.generateWorkspaceChangelog(workspace, lastTag);

      expect(result).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('handles errors during changelog generation', async () => {
      const fsPromises = require('fs/promises');
      fsPromises.access.mockRejectedValueOnce(new Error('File not found'));
      fsPromises.writeFile.mockRejectedValueOnce(new Error('Write error'));

      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };

      const result = await changelog.generateWorkspaceChangelog(workspace, 'v0.9.0');

      expect(result).toBe(false);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to generate changelog'),
      ]);
    });
  });

  describe('generateWorkspacesChangelogs()', () => {
    it('handles empty workspaces array', async () => {
      const results = await changelog.generateWorkspacesChangelogs([], 'v0.1.0');

      expect(results).toEqual([]);
      setupLoggingCallsTest('warning', [
        expect.stringContaining('WARNING'),
        expect.stringContaining('No workspaces provided'),
      ]);
    });

    it('generates changelogs for multiple workspaces', async () => {
      const fsPromises = require('fs/promises');
      // Reset mock behavior to default success
      fsPromises.access.mockReset();
      fsPromises.access.mockImplementation((path) => {
        if (path.includes('existingChangelog')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.writeFile.mockResolvedValue(undefined);

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

      const results = await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('handles failures for individual workspaces', async () => {
      const fsPromises = require('fs/promises');

      // First workspace succeeds
      fsPromises.access.mockRejectedValueOnce(new Error('File not found'));

      // Second workspace fails
      fsPromises.access.mockImplementationOnce(() => {
        throw new Error('Access error');
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

      const results = await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});
