/**
 * WorkspaceService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GitService } from './GitService.js';
import { WorkspaceService } from './WorkspaceService.js';
import type { GitComparison, FileChange } from '../types/git.js';
import { ok, err } from '../types/result.js';
import type { Version } from '../types/version.js';
import type { WorkspaceConfig, Workspace } from '../types/workspace.js';
import { GitOperationError } from '../utils/errors.js';

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

// Mock adapter factory
vi.mock('../core/adapters/AdapterFactory.js', () => ({
  getAdapter: vi.fn(() => ({
    detect: vi.fn(async (path: string) => {
      const name = path.split('/').pop() || 'test-workspace';
      return ok({
        name,
        version: '1.0.0' as Version,
      });
    }),
  })),
}));

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let mockGitService: GitService;

  const mockVersion: Version = '1.0.0' as Version;
  const mockWorkspaceConfig: WorkspaceConfig = {
    path: 'packages/test',
    type: 'node',
  };

  beforeEach(() => {
    mockGitService = {
      getChangedFiles: vi.fn(),
    } as unknown as GitService;

    service = new WorkspaceService(mockGitService);
  });

  describe('enrichWorkspaces', () => {
    it('should enrich workspaces with metadata', async () => {
      const result = await service.enrichWorkspaces([mockWorkspaceConfig]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toMatchObject({
          type: mockWorkspaceConfig.type,
          hasChanges: false,
          changedFiles: [],
        });
        expect(result.value[0].name).toBeDefined();
        expect(result.value[0].version).toBeDefined();
        expect(result.value[0].path).toContain(mockWorkspaceConfig.path);
      }
    });

    it('should handle empty workspace array', async () => {
      const result = await service.enrichWorkspaces([]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle multiple workspaces', async () => {
      const configs: WorkspaceConfig[] = [
        { path: 'packages/a', type: 'node' },
        { path: 'packages/b', type: 'node' },
      ];

      const result = await service.enrichWorkspaces(configs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should resolve absolute paths correctly', async () => {
      const configs: WorkspaceConfig[] = [
        { path: '.', type: 'node' },
        { path: 'packages/test', type: 'node' },
      ];

      const result = await service.enrichWorkspaces(configs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].path).toBe(process.cwd());
        expect(result.value[1].path).toContain('packages/test');
      }
    });
  });

  describe('detectChangedWorkspaces', () => {
    const mockWorkspace: Workspace = {
      path: `${process.cwd()}/packages/test`,
      type: 'node',
      name: 'test-workspace',
      version: mockVersion,
      hasChanges: false,
      changedFiles: [],
    };

    const mockFileChange: FileChange = {
      path: 'packages/test/src/index.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
    };

    const mockGitComparison: GitComparison = {
      base: 'v1.0.0',
      head: 'HEAD',
      files: [mockFileChange],
      commits: [],
    };

    it('should detect changed workspaces with last tag', async () => {
      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(ok(mockGitComparison));

      const result = await service.detectChangedWorkspaces([mockWorkspace], 'v1.0.0', 'main');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].hasChanges).toBe(true);
        expect(result.value[0].changedFiles.length).toBeGreaterThan(0);
      }

      expect(mockGitService.getChangedFiles).toHaveBeenCalledWith('v1.0.0', 'main');
    });

    it('should mark all workspaces as changed without last tag', async () => {
      const result = await service.detectChangedWorkspaces([mockWorkspace], null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].hasChanges).toBe(true);
        expect(result.value[0].changedFiles).toEqual(['*']);
      }
    });

    it('should handle error from getChangedFiles', async () => {
      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(
        err(new GitOperationError('getChangedFiles', 'Failed to get changed files')),
      );

      const result = await service.detectChangedWorkspaces([mockWorkspace], 'v1.0.0');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });

    it('should mark root workspace as having changes when any file changed', async () => {
      const rootWorkspace: Workspace = {
        name: 'root',
        path: process.cwd(),
        type: 'node',
        version: mockVersion,
        hasChanges: false,
        changedFiles: [],
      };

      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(ok(mockGitComparison));

      const result = await service.detectChangedWorkspaces([rootWorkspace], 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].hasChanges).toBe(true);
      }
    });

    it('should only mark workspace as changed if file is in its path', async () => {
      const workspace1: Workspace = {
        name: 'workspace1',
        path: `${process.cwd()}/packages/workspace1`,
        type: 'node',
        version: mockVersion,
        hasChanges: false,
        changedFiles: [],
      };

      const workspace2: Workspace = {
        name: 'workspace2',
        path: `${process.cwd()}/packages/workspace2`,
        type: 'node',
        version: mockVersion,
        hasChanges: false,
        changedFiles: [],
      };

      const fileChange: FileChange = {
        path: 'packages/workspace1/src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      };

      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(ok({ ...mockGitComparison, files: [fileChange] }));

      const result = await service.detectChangedWorkspaces([workspace1, workspace2], 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0].hasChanges).toBe(true);
        expect(result.value[0].name).toBe('workspace1');
      }
    });
  });
});
