/**
 * Tests for changelog generation utilities
 */
import conventionalChangelog from 'conventional-changelog-core';
import {Readable} from 'stream';
import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';

import * as changelog from './changelog.js';
import {fs, stream} from './node-wrapper.js';
import {mockCConsole, unMockCConsole, setupLoggingCallsTest} from '../vitest/setup.logging.tests.js';

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
  });

  afterEach(() => {
    unMockCConsole();
  });

  describe('checkChangelogExists()', () => {
    it('returns true if changelog file exists', async () => {
      vi.spyOn(fs.async, 'access').mockResolvedValue((path) => true);

      try {
        const result = await changelog.checkChangelogExists('/path/to/CHANGELOG.md');
        expect(result).toBe(true);
      } finally {
        fs.async.access.mockRestore();
      }
    });

    it('returns false if changelog file does not exist', async () => {
      vi.spyOn(fs.async, 'access').mockImplementation((path) => {
        throw new Error('File not found');
      });

      try {
        const result = await changelog.checkChangelogExists('/path/to/CHANGELOG.md');
        expect(result).toBe(false);
      } finally {
        fs.async.access.mockRestore();
      }
    });
  });

  describe('createInitialChangelog()', () => {
    it('creates a new changelog file with default header', async () => {
      vi.spyOn(fs.async, 'writeFile').mockResolvedValue(undefined);

      try {
        await changelog.createInitialChangelog('/path/to/CHANGELOG.md');
        expect(fs.async.writeFile).toHaveBeenCalledWith(
          '/path/to/CHANGELOG.md',
          expect.stringContaining('# Changelog'),
        );
      } finally {
        fs.async.writeFile.mockRestore();
      }
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

      vi.spyOn(stream.async, 'pipeline').mockResolvedValue(undefined);
      vi.spyOn(fs, 'createWriteStream').mockReturnValue({
        pipe: vi.fn(),
      });

      try {
        await changelog.writeChangelogStream(clStream, '/path/to/output.md');
        expect(stream.async.pipeline).toHaveBeenCalled();
      } finally {
        stream.async.pipeline.mockRestore();
        fs.createWriteStream.mockRestore();
      }
    });
  });

  describe('mergeChangelogContent()', () => {
    it('merges new changelog content with existing content', async () => {
      vi.spyOn(fs.async, 'readFile').mockImplementation((path) => {
        if (String(path).includes('.new.md')) {
          return Promise.resolve('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
        }
        return Promise.resolve('# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n');
      });
      vi.spyOn(fs.async, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(fs.async, 'unlink').mockResolvedValue(undefined);

      try {
        await changelog.mergeChangelogContent('/path/to/CHANGELOG.md', '/path/to/CHANGELOG.new.md');

        expect(fs.async.writeFile).toHaveBeenCalledWith(
          '/path/to/CHANGELOG.md',
          expect.stringContaining('# Changelog'),
        );
        expect(fs.async.unlink).toHaveBeenCalledWith('/path/to/CHANGELOG.new.md');
      } finally {
        fs.async.readFile.mockRestore();
        fs.async.writeFile.mockRestore();
        fs.async.unlink.mockRestore();
      }
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

      vi.spyOn(fs.async, 'access').mockRejectedValueOnce(new Error('File not found'));
      vi.spyOn(fs.async, 'writeFile').mockResolvedValue(undefined);

      try {
        const result = await changelog.generateWorkspaceChangelog(workspace, lastTag);

        expect(result).toBe(true);
        expect(fs.async.writeFile).toHaveBeenCalled();
      } finally {
        fs.async.access.mockRestore();
        fs.async.writeFile.mockRestore();
      }
    });

    //   it('handles errors during changelog generation', async () => {
    //     const {fs} = require('./node-wrapper');
    //     fs.access.mockRejectedValueOnce(new Error('File not found'));
    //     fs.writeFile.mockRejectedValueOnce(new Error('Write error'));

    //     const workspace = {
    //       path: '/test/workspace',
    //       name: 'test-project',
    //       version: '1.0.0',
    //     };

    //     const result = await changelog.generateWorkspaceChangelog(workspace, 'v0.9.0');

    //     expect(result).toBe(false);
    //     setupLoggingCallsTest('error', [
    //       expect.stringContaining('ERROR'),
    //       expect.stringContaining('Failed to generate changelog'),
    //     ]);
    //   });
  });

  // describe('generateWorkspacesChangelogs()', () => {
  //   it('handles empty workspaces array', async () => {
  //     const results = await changelog.generateWorkspacesChangelogs([], 'v0.1.0');

  //     expect(results).toEqual([]);
  //     setupLoggingCallsTest('warning', [
  //       expect.stringContaining('WARNING'),
  //       expect.stringContaining('No workspaces provided'),
  //     ]);
  //   });

  //   it('generates changelogs for multiple workspaces', async () => {
  //     const {fs} = require('./node-wrapper');
  //     // Reset mock behavior to default success
  //     fs.access.mockReset();
  //     fs.access.mockImplementation((path) => {
  //       if (String(path).includes('existingChangelog')) {
  //         return Promise.resolve();
  //       }
  //       return Promise.reject(new Error('File not found'));
  //     });

  //     fs.writeFile.mockResolvedValue(undefined);

  //     const workspaces = [
  //       {
  //         path: '/test/workspace1',
  //         name: 'project1',
  //         version: '1.0.0',
  //       },
  //       {
  //         path: '/test/workspace2',
  //         name: 'project2',
  //         version: '2.0.0',
  //       },
  //     ];
  //     const lastTag = 'v0.9.0';

  //     const results = await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

  //     expect(results).toHaveLength(2);
  //     expect(results[0].success).toBe(true);
  //     expect(results[1].success).toBe(true);
  //   });

  //   it('handles failures for individual workspaces', async () => {
  //     const {fs} = require('./node-wrapper');

  //     // First workspace succeeds
  //     fs.access.mockRejectedValueOnce(new Error('File not found'));

  //     // Second workspace fails
  //     fs.access.mockImplementationOnce(() => {
  //       throw new Error('Access error');
  //     });

  //     const workspaces = [
  //       {
  //         path: '/test/workspace1',
  //         name: 'project1',
  //         version: '1.0.0',
  //       },
  //       {
  //         path: '/test/workspace2',
  //         name: 'project2',
  //         version: '2.0.0',
  //       },
  //     ];
  //     const lastTag = 'v0.9.0';

  //     const results = await changelog.generateWorkspacesChangelogs(workspaces, lastTag);

  //     expect(results).toHaveLength(2);
  //     expect(results[0].success).toBe(true);
  //     expect(results[1].success).toBe(false);
  //   });
  // });
});
