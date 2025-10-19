/**
 * WorkspaceManager Tests
 *
 * Unit tests for workspace orchestration service.
 * Tests the main workflow execution and key orchestration methods.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceManager, type WorkflowOptions } from './WorkspaceManager.js';
import { ok, err } from '../types/result.js';
import { GitOperationError } from '../utils/errors.js';
import type { GitService } from '../services/GitService.js';
import type { PRService } from '../services/PRService.js';
import type { VersionService } from './VersionService.js';
import type { ChangelogService } from './ChangelogService.js';
import type { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';
import type { WorkspaceConfig, Workspace } from '../types/workspace.js';
import type { Version } from '../types/version.js';
import type { GitTag, GitComparison, FileChange } from '../types/git.js';
import { ok as okResult } from '../types/result.js';

// Mock @actions/exec to prevent real Git commands during tests
vi.mock('@actions/exec', () => ({
  exec: vi.fn().mockImplementation(async (command: string, args: string[], options?: any) => {
    // Simulate git rev-parse HEAD returning a commit SHA
    if (command === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD' && options?.listeners?.stdout) {
      options.listeners.stdout(Buffer.from('abc123def456789\n'));
    }
    return 0;
  }),
}));

// Mock logger before imports
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

// Mock adapter factory to return mock adapters
vi.mock('./adapters/AdapterFactory.js', () => ({
  getAdapter: vi.fn(() => ({
    detect: vi.fn(async (path: string) => {
      const name = path.split('/').pop() || 'test-workspace';
      return okResult({
        name,
        version: '1.0.0' as any,
      });
    }),
    update: vi.fn(async () => okResult(undefined)),
  })),
}));

describe('WorkspaceManager', () => {
  let workspaceManager: WorkspaceManager;
  let mockGitService: GitService;
  let mockPRService: PRService;
  let mockVersionService: VersionService;
  let mockChangelogService: ChangelogService;
  let mockTreeBuilder: WorkspaceTreeBuilder;

  // Test data
  const mockVersion: Version = '1.0.0' as Version;
  const mockWorkspaceConfig: WorkspaceConfig = {
    path: 'packages/test',
    type: 'node',
  };

  const mockGitTag: GitTag = {
    name: 'v1.0.0',
    sha: 'abc123',
    message: 'Release v1.0.0',
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

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock services
    mockGitService = {
      getLastTag: vi.fn(),
      getChangedFiles: vi.fn(),
      getCommitsSince: vi.fn(),
      createTag: vi.fn(),
      getRef: vi.fn(),
    } as unknown as GitService;

    mockPRService = {
      create: vi.fn(),
      hasMerged: vi.fn(),
    } as unknown as PRService;

    mockVersionService = {
      calculateNewVersion: vi.fn(),
      increaseVersion: vi.fn(),
    } as unknown as VersionService;

    mockChangelogService = {
      generateForWorkspace: vi.fn(),
    } as unknown as ChangelogService;

    mockTreeBuilder = {
      build: vi.fn(),
    } as unknown as WorkspaceTreeBuilder;

    workspaceManager = new WorkspaceManager({
      gitService: mockGitService,
      prService: mockPRService,
      versionService: mockVersionService,
      changelogService: mockChangelogService,
      treeBuilder: mockTreeBuilder,
    });
  });

  describe('constructor', () => {
    it('should create a new WorkspaceManager instance', () => {
      expect(workspaceManager).toBeInstanceOf(WorkspaceManager);
    });
  });

  describe('enrichWorkspaces', () => {
    it('should enrich workspaces with metadata from adapters', async () => {
      const result = await workspaceManager.enrichWorkspaces([mockWorkspaceConfig]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toMatchObject({
          path: mockWorkspaceConfig.path,
          type: mockWorkspaceConfig.type,
          hasChanges: false,
          changedFiles: [],
        });
        // Adapter should have detected name and version
        expect(result.value[0].name).toBeDefined();
        expect(result.value[0].version).toBeDefined();
      }
    });

    it('should handle empty workspace array', async () => {
      const result = await workspaceManager.enrichWorkspaces([]);

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

      const result = await workspaceManager.enrichWorkspaces(configs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });
  });

  describe('detectChangedWorkspaces', () => {
    const mockWorkspace: Workspace = {
      path: 'packages/test',
      type: 'node',
      name: 'test-workspace',
      version: mockVersion,
      hasChanges: false,
      changedFiles: [],
    };

    it('should detect changed workspaces with last tag', async () => {
      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(ok(mockGitComparison));

      const result = await workspaceManager.detectChangedWorkspaces([mockWorkspace], 'v1.0.0', 'main');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].hasChanges).toBe(true);
        expect(result.value[0].changedFiles.length).toBeGreaterThan(0);
      }

      expect(mockGitService.getChangedFiles).toHaveBeenCalledWith('v1.0.0', 'main');
    });

    it('should detect changed workspaces without last tag', async () => {
      const result = await workspaceManager.detectChangedWorkspaces([mockWorkspace], null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // When no last tag, all workspaces are marked as changed
        expect(result.value[0].hasChanges).toBe(true);
        expect(result.value[0].changedFiles).toEqual(['*']);
      }
    });

    it('should handle error from getChangedFiles', async () => {
      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(
        err(new GitOperationError('getChangedFiles', 'Failed to get changed files')),
      );

      const result = await workspaceManager.detectChangedWorkspaces([mockWorkspace], 'v1.0.0');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });

    it('should mark root workspace as having changes when any file changed', async () => {
      const rootWorkspace: Workspace = {
        name: 'root',
        path: '.',
        type: 'node',
        version: mockVersion,
        hasChanges: false,
        changedFiles: [],
      };

      vi.mocked(mockGitService.getChangedFiles).mockResolvedValue(ok(mockGitComparison));

      const result = await workspaceManager.detectChangedWorkspaces([rootWorkspace], 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].hasChanges).toBe(true);
      }
    });

    it('should only mark workspace as changed if file is in its path', async () => {
      const workspace1: Workspace = {
        name: 'workspace1',
        path: 'packages/workspace1',
        type: 'node',
        version: mockVersion,
        hasChanges: false,
        changedFiles: [],
      };

      const workspace2: Workspace = {
        name: 'workspace2',
        path: 'packages/workspace2',
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

      const result = await workspaceManager.detectChangedWorkspaces([workspace1, workspace2], 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Only workspaces with changes are returned
        expect(result.value.length).toBe(1);
        expect(result.value[0].hasChanges).toBe(true);
        expect(result.value[0].path).toBe('packages/workspace1');
      }
    });
  });

  describe('calculateVersions', () => {
    const mockWorkspace: Workspace = {
      path: 'packages/test',
      type: 'node',
      name: 'test-workspace',
      version: mockVersion,
      hasChanges: true,
      changedFiles: ['packages/test/src/index.ts'],
    };

    it('should calculate versions for changed workspaces', async () => {
      const mockNewVersion: Version = '1.1.0' as Version;
      const mockCommit = {
        sha: 'def456',
        message: 'feat: add new feature',
        author: { name: 'Test', email: 'test@example.com' },
        date: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockGitService.getCommitsSince).mockResolvedValue(ok([mockCommit]));
      vi.mocked(mockVersionService.calculateNewVersion).mockReturnValue(mockNewVersion);

      const result = await workspaceManager.calculateVersions([mockWorkspace], 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].newVersion).toBe(mockNewVersion);
      }

      expect(mockGitService.getCommitsSince).toHaveBeenCalledWith('v1.0.0');
    });

    it('should handle no last tag by using HEAD^', async () => {
      const mockNewVersion: Version = '1.1.0' as Version;
      const mockCommit = {
        sha: 'def456',
        message: 'feat: add new feature',
        author: { name: 'Test', email: 'test@example.com' },
        date: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockGitService.getCommitsSince).mockResolvedValue(ok([mockCommit]));
      vi.mocked(mockVersionService.calculateNewVersion).mockReturnValue(mockNewVersion);

      const result = await workspaceManager.calculateVersions([mockWorkspace], null);

      expect(result.ok).toBe(true);
      expect(mockGitService.getCommitsSince).toHaveBeenCalledWith('HEAD^');
    });

    it('should handle error from getCommitsSince', async () => {
      vi.mocked(mockGitService.getCommitsSince).mockResolvedValue(
        err(new GitOperationError('getCommitsSince', 'Failed to get commits')),
      );

      const result = await workspaceManager.calculateVersions([mockWorkspace], 'v1.0.0');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });

    it('should handle no commits (keep same version)', async () => {
      vi.mocked(mockGitService.getCommitsSince).mockResolvedValue(ok([]));
      vi.mocked(mockVersionService.increaseVersion).mockReturnValue(mockVersion);

      const result = await workspaceManager.calculateVersions([mockWorkspace], 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].newVersion).toBeDefined();
      }
    });
  });

  describe('updateVersionFiles', () => {
    it('should update version files successfully', async () => {
      const workspaceWithVersion = {
        path: 'packages/test',
        type: 'node' as const,
        name: 'test-workspace',
        version: mockVersion,
        hasChanges: true,
        changedFiles: ['packages/test/src/index.ts'],
        newVersion: '1.1.0' as Version,
      };

      const result = await workspaceManager.updateVersionFiles([workspaceWithVersion]);

      expect(result.ok).toBe(true);
    });

    it('should handle empty workspace array', async () => {
      const result = await workspaceManager.updateVersionFiles([]);

      expect(result.ok).toBe(true);
    });
  });

  describe('createVersionCommit', () => {
    it('should use @actions/exec to create and push commit', async () => {
      const mockTree = {
        root: {
          workspace: {
            path: '.',
            type: 'node' as const,
            name: 'root',
            version: mockVersion,
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

      const result = await workspaceManager.createVersionCommit(mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('abc123def456789');
      }
    });
  });

  describe('createVersionPR', () => {
    const mockTree = {
      root: {
        workspace: {
          path: '.',
          type: 'node' as const,
          name: 'root',
          version: mockVersion,
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

    it('should create version PR successfully', async () => {
      vi.mocked(mockPRService.create).mockResolvedValue(
        ok({ number: 123, htmlUrl: 'https://github.com/test/repo/pull/123', state: 'open' }),
      );

      const options: WorkflowOptions = {
        workspaces: [mockWorkspaceConfig],
        createPR: true,
        prOptions: {
          branchPrefix: 'version-bump',
          draft: false,
          autoMerge: false,
        },
        repository: {
          owner: 'test',
          repo: 'test-repo',
        },
      };

      const result = await workspaceManager.createVersionPR(mockTree, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(123);
      }

      expect(mockPRService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'chore: bump version to 2.0.0',
          head: 'version-bump/v2.0.0',
          base: 'main',
          draft: false,
        }),
      );
    });

    it('should create draft PR when specified', async () => {
      vi.mocked(mockPRService.create).mockResolvedValue(
        ok({ number: 123, htmlUrl: 'https://github.com/test/repo/pull/123', state: 'open' }),
      );

      const options: WorkflowOptions = {
        workspaces: [mockWorkspaceConfig],
        createPR: true,
        prOptions: {
          branchPrefix: 'version-bump',
          draft: true,
          autoMerge: false,
        },
        repository: {
          owner: 'test',
          repo: 'test-repo',
        },
      };

      const result = await workspaceManager.createVersionPR(mockTree, options);

      expect(result.ok).toBe(true);
      expect(mockPRService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
        }),
      );
    });
  });

  describe('createVersionTags', () => {
    const mockTree = {
      root: {
        workspace: {
          path: '.',
          type: 'node' as const,
          name: 'root',
          version: mockVersion,
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

    it('should create master version tag', async () => {
      vi.mocked(mockGitService.getRef).mockResolvedValue(ok({ ref: 'refs/heads/main', sha: 'abc123def456' }));
      vi.mocked(mockGitService.createTag).mockResolvedValue(ok(mockGitTag));

      const options: WorkflowOptions = {
        workspaces: [mockWorkspaceConfig],
        createPR: false,
        repository: {
          owner: 'test',
          repo: 'test-repo',
        },
      };

      const result = await workspaceManager.createVersionTags(mockTree, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('v2.0.0');
      }

      expect(mockGitService.getRef).toHaveBeenCalledWith('heads/main');
      expect(mockGitService.createTag).toHaveBeenCalledWith(
        expect.objectContaining({
          tagName: 'v2.0.0',
          message: expect.stringContaining('Release'),
          commitSha: 'abc123def456',
        }),
      );
    });

    it('should handle error from tag creation', async () => {
      vi.mocked(mockGitService.getRef).mockResolvedValue(ok({ ref: 'refs/heads/main', sha: 'abc123def456' }));
      vi.mocked(mockGitService.createTag).mockResolvedValue(
        err(new GitOperationError('createTag', 'Failed to create tag')),
      );

      const options: WorkflowOptions = {
        workspaces: [mockWorkspaceConfig],
        createPR: false,
        repository: {
          owner: 'test',
          repo: 'test-repo',
        },
      };

      const result = await workspaceManager.createVersionTags(mockTree, options);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });
  });
});
