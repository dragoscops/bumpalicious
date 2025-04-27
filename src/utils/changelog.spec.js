/**
 * Tests for changelog generation utilities
 */
import {describe, it, expect, beforeEach, vi, afterAll, beforeAll, afterEach} from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import * as changelog from './changelog.js';
import {mockCConsole, unMockCConsole, setupLoggingCallsTest} from '../vitest/setup.logging.tests.js';

// Mock the conventional-changelog-core module
vi.mock('conventional-changelog-core', () => {
  return {
    default: vi.fn(() => {
      const {Readable} = require('stream');
      const readable = new Readable();
      readable.push('# Changelog\n\n## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
      readable.push(null);
      return readable;
    }),
  };
});

// Mock fs methods
vi.mock('fs', () => {
  const actual = vi.importActual('fs');
  return {
    ...actual,
    createReadStream: vi.fn(() => {
      const {Readable} = require('stream');
      const readable = new Readable();
      readable.push('# Old Changelog Content\n');
      readable.push(null);
      return readable;
    }),
    createWriteStream: vi.fn(() => {
      const {EventEmitter} = require('events');
      const emitter = new EventEmitter();

      // Add a pipe method that just triggers finish event after a tick
      emitter.pipe = vi.fn((source) => {
        process.nextTick(() => {
          source.emit('end');
          emitter.emit('finish');
        });
        return emitter;
      });

      return emitter;
    }),
    constants: {
      F_OK: 0,
    },
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  access: vi.fn((path, mode) => {
    if (path.includes('existingChangelog')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('File not found'));
  }),
  writeFile: vi.fn(() => Promise.resolve()),
}));

describe('changelog.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCConsole();
  });

  afterEach(() => {
    unMockCConsole();
  });

  describe('generateWorkspaceChangelog()', () => {
    it('generates changelog for a workspace with no existing changelog', async () => {
      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };

      const result = await changelog.generateWorkspaceChangelog(workspace);

      expect(result).toBe(true);
      setupLoggingCallsTest('info', [
        expect.stringContaining('INFO'),
        expect.stringContaining('Generated changelog for test-project'),
      ]);
    });

    it('appends to existing changelog when append option is true', async () => {
      const workspace = {
        path: '/test/workspace/existingChangelog',
        name: 'test-project',
        version: '1.0.0',
      };

      const result = await changelog.generateWorkspaceChangelog(workspace, {append: true});

      expect(result).toBe(true);
      setupLoggingCallsTest('info', [
        expect.stringContaining('INFO'),
        expect.stringContaining('Updated changelog for test-project'),
      ]);
    });

    it('handles errors during changelog generation', async () => {
      // Mock conventional-changelog-core to throw an error
      const conventionalChangelog = require('conventional-changelog-core').default;
      conventionalChangelog.mockImplementationOnce(() => {
        const {Readable} = require('stream');
        const readable = new Readable();
        process.nextTick(() => {
          readable.emit('error', new Error('Test error'));
        });
        return readable;
      });

      const workspace = {
        path: '/test/workspace',
        name: 'test-project',
        version: '1.0.0',
      };

      await expect(changelog.generateWorkspaceChangelog(workspace)).rejects.toThrow('Test error');

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to generate changelog for test-project'),
      ]);
    });
  });

  describe('generateWorkspacesChangelogs()', () => {
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

      const results = await changelog.generateWorkspacesChangelogs(workspaces);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('handles errors for individual workspaces', async () => {
      const conventionalChangelog = require('conventional-changelog-core').default;

      // Make the second call throw an error
      conventionalChangelog
        .mockImplementationOnce(() => {
          const {Readable} = require('stream');
          const readable = new Readable();
          readable.push('# Changelog\n\n## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
          readable.push(null);
          return readable;
        })
        .mockImplementationOnce(() => {
          const {Readable} = require('stream');
          const readable = new Readable();
          process.nextTick(() => {
            readable.emit('error', new Error('Test error'));
          });
          return readable;
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

      const results = await changelog.generateWorkspacesChangelogs(workspaces);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});
