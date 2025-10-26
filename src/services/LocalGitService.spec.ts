/**
 * LocalGitService Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LocalGitService } from './LocalGitService.js';
import type { Version } from '../types/version.js';
import type { WorkspaceTree } from '../types/workspace.js';

// Mock @actions/exec
vi.mock('@actions/exec', () => ({
  exec: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('LocalGitService', () => {
  let service: LocalGitService;
  let mockExec: ReturnType<typeof vi.fn>;

  const mockTree: WorkspaceTree = {
    root: {
      workspace: {
        path: '.',
        type: 'node',
        name: 'root',
        version: '1.0.0' as Version,
        hasChanges: true,
        changedFiles: [],
        newVersion: '2.0.0' as Version,
      },
      children: [],
      isRoot: true,
    },
    masterVersion: '2.0.0' as Version,
    allWorkspaces: [],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const exec = await import('@actions/exec');
    mockExec = vi.mocked(exec.exec);

    // Default mock implementation
    mockExec.mockImplementation(
      async (command: string, args: string[], options?: { listeners?: { stdout?: (data: Buffer) => void } }) => {
        if (command === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD' && options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('abc123def456\n'));
        }
        if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--abbrev-ref' && options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('main\n'));
        }
        if (command === 'git' && args[0] === 'config' && options?.listeners?.stdout) {
          // Simulate git config already set
          options.listeners.stdout(Buffer.from('github-actions[bot]\n'));
        }
        return 0;
      },
    );

    service = new LocalGitService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configureGit', () => {
    it('should configure git user.name if not set', async () => {
      mockExec.mockImplementation(
        async (command: string, args: string[], options?: { listeners?: { stdout?: (data: Buffer) => void } }) => {
          if (command === 'git' && args[0] === 'config' && args[1] === 'user.name' && options?.listeners?.stdout) {
            // Simulate user.name not set
            options.listeners.stdout(Buffer.from(''));
          }
          if (command === 'git' && args[0] === 'config' && args[1] === 'user.email' && options?.listeners?.stdout) {
            // Simulate user.email already set
            options.listeners.stdout(Buffer.from('test@example.com\n'));
          }
          return 0;
        },
      );

      await service.configureGit();

      expect(mockExec).toHaveBeenCalledWith('git', ['config', 'user.name', 'github-actions[bot]']);
    });

    it('should configure git user.email if not set', async () => {
      mockExec.mockImplementation(
        async (command: string, args: string[], options?: { listeners?: { stdout?: (data: Buffer) => void } }) => {
          if (command === 'git' && args[0] === 'config' && args[1] === 'user.name' && options?.listeners?.stdout) {
            // Simulate user.name already set
            options.listeners.stdout(Buffer.from('test\n'));
          }
          if (command === 'git' && args[0] === 'config' && args[1] === 'user.email' && options?.listeners?.stdout) {
            // Simulate user.email not set
            options.listeners.stdout(Buffer.from(''));
          }
          return 0;
        },
      );

      await service.configureGit();

      expect(mockExec).toHaveBeenCalledWith('git', [
        'config',
        'user.email',
        'github-actions[bot]@users.noreply.github.com',
      ]);
    });

    it('should not configure git if already set', async () => {
      await service.configureGit();

      const configCalls = mockExec.mock.calls.filter(
        (call) => call[0] === 'git' && call[1][0] === 'config' && call[1].length === 3,
      );
      expect(configCalls).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockRejectedValue(new Error('Git config failed'));

      await expect(service.configureGit()).resolves.not.toThrow();
    });
  });

  describe('createVersionCommit', () => {
    it('should create and push version commit', async () => {
      const result = await service.createVersionCommit(mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('abc123def456');
      }

      expect(mockExec).toHaveBeenCalledWith('git', ['add', '-A']);
      expect(mockExec).toHaveBeenCalledWith('git', ['commit', '-m', 'chore: bump version to 2.0.0', '--no-verify']);
      expect(mockExec).toHaveBeenCalledWith('git', ['push', '--set-upstream', 'origin', 'main', '--no-verify']);
    });

    it('should handle commit creation failure', async () => {
      mockExec.mockRejectedValue(new Error('Commit failed'));

      const result = await service.createVersionCommit(mockTree);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to create version commit');
      }
    });
  });

  describe('createVersionBranch', () => {
    it('should create and push version branch', async () => {
      const result = await service.createVersionBranch(mockTree, 'version-bump');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatch(/^version-bump\/v2\.0\.0-[a-z0-9]+$/);
      }

      expect(mockExec).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout', '-b']));
      expect(mockExec).toHaveBeenCalledWith('git', ['add', '-A']);
      expect(mockExec).toHaveBeenCalledWith('git', ['commit', '-m', 'chore: bump version to 2.0.0', '--no-verify']);
    });

    it('should include random suffix in branch name', async () => {
      const result1 = await service.createVersionBranch(mockTree, 'version-bump');
      const result2 = await service.createVersionBranch(mockTree, 'version-bump');

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        // Branch names should be different due to random suffix
        expect(result1.value).not.toBe(result2.value);
      }
    });

    it('should handle branch creation failure', async () => {
      mockExec.mockRejectedValue(new Error('Branch creation failed'));

      const result = await service.createVersionBranch(mockTree, 'version-bump');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to create version branch');
      }
    });
  });
});
