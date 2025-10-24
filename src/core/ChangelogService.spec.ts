/**
 * Tests for ChangelogService
 */

import { promises as fs } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangelogService, type GenerateChangelogOptions, type ChangelogPreset } from './ChangelogService.js';
import type { Version } from '../types/version.js';
import type { WorkspaceWithVersion, WorkspaceNode } from '../types/workspace.js';
import { FileOperationError } from '../utils/errors.js';

// Mock fs module
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  },
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

// Mock conventional-changelog-core
vi.mock('conventional-changelog-core', async () => {
  const { Readable } = await import('node:stream');
  return {
    default: vi.fn(() => {
      const stream = new Readable();
      stream.push(
        '## [1.2.0](https://github.com/test/test/compare/v1.1.0...v1.2.0) (2024-01-15)\n\n### Features\n\n* add new feature ([abc123](https://github.com/test/test/commit/abc123))\n\n',
      );
      stream.push(null);
      return stream;
    }),
  };
});

// Mock preset modules
vi.mock('conventional-changelog-conventionalcommits', () => ({
  default: vi.fn(async () => ({})),
}));

/**
 * Mock repository for tests
 */
const mockRepository = {
  owner: 'test-owner',
  repo: 'test-repo',
};

/**
 * Helper to create mock workspace
 */
function createMockWorkspace(overrides: Partial<WorkspaceWithVersion> = {}): WorkspaceWithVersion {
  return {
    path: '.',
    type: 'node',
    version: '1.1.0' as Version,
    newVersion: '1.2.0' as Version,
    hasChanges: true,
    changedFiles: ['src/index.ts'],
    name: 'test-package',
    ...overrides,
  };
}

describe('ChangelogService', () => {
  let service: ChangelogService;
  let mockWorkspace: WorkspaceWithVersion;

  beforeEach(() => {
    service = new ChangelogService();
    mockWorkspace = createMockWorkspace();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateForWorkspace', () => {
    it('should generate changelog for new file', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.readFile).mockResolvedValue('');
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.created).toBe(true);
      expect(result.path).toBe('/test/CHANGELOG.md');
      expect(result.content).toContain('# Changelog');
      expect(result.content).toContain('## 1.2.0');
      expect(fs.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should prepend to existing changelog', async () => {
      // Arrange
      const existingChangelog = `# Changelog

## [1.1.0] - 2024-01-01

### Features

* old feature
`;

      // Import actual fs for reading template files
      const { promises: actualFs } = await vi.importActual<typeof import('node:fs')>('node:fs');

      vi.mocked(fs.access).mockResolvedValue();

      // Mock fs.readFile to return different content based on the file path
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('CHANGELOG')) {
          return existingChangelog;
        }
        // For template files, read them from the actual filesystem
        return actualFs.readFile(path, 'utf-8');
      });

      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const mockCommits = [
        {
          message: 'feat: add new feature',
          sha: 'abc123',
          author: 'Test Author',
          date: '2024-01-15T10:00:00Z',
        },
      ];

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        preset: 'conventionalcommits',
        commits: mockCommits,
        repository: {
          owner: 'test-owner',
          repo: 'test-repo',
        },
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.created).toBe(false);
      expect(result.content).toContain('# Changelog');
      expect(result.content).toContain('## 1.2.0'); // Preset generates without brackets
      expect(result.content).toContain('## [1.1.0]');
      expect(result.content).toContain('add new feature');
      expect(result.content).toContain('old feature');
    });

    it('should handle monorepo workspace with path prefix', async () => {
      // Arrange
      const workspaceWithPath = createMockWorkspace({
        path: 'packages/core',
      });

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: workspaceWithPath,
        changelogPath: '/test/packages/core/CHANGELOG.md',
        preset: 'conventionalcommits',
        repository: mockRepository,
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.created).toBe(true);
      expect(result.content).toContain('## 1.2.0');
    });

    it('should append child workspace summary for root workspace', async () => {
      // Arrange
      const childWorkspace1 = createMockWorkspace({
        path: 'packages/core',
        version: '1.0.0' as Version,
        newVersion: '1.1.0' as Version,
        hasChanges: true,
        changedFiles: ['src/core.ts'],
        name: 'core',
      });

      const childWorkspace2 = createMockWorkspace({
        path: 'packages/utils',
        version: '2.0.0' as Version,
        newVersion: '2.0.0' as Version,
        hasChanges: false,
        changedFiles: [],
        name: 'utils',
      });

      const childNodes: WorkspaceNode[] = [
        {
          workspace: childWorkspace1,
          children: [],
          isRoot: false,
        },
        {
          workspace: childWorkspace2,
          children: [],
          isRoot: false,
        },
      ];

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
        childWorkspaces: childNodes,
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.content).toContain('### Child Workspaces');
      expect(result.content).toContain('packages/core');
      expect(result.content).toContain('v1.1.0');
      expect(result.content).toContain('packages/utils');
      expect(result.content).toContain('v2.0.0');
      expect(result.content).toContain('🔄'); // Changed indicator
      expect(result.content).toContain('✓'); // Unchanged indicator
    });

    it('should support nested child workspaces', async () => {
      // Arrange
      const grandChildWorkspace = createMockWorkspace({
        path: 'packages/core/sub',
        version: '0.1.0' as Version,
        newVersion: '0.2.0' as Version,
        hasChanges: true,
        changedFiles: ['src/sub.ts'],
        name: 'sub',
      });

      const childWorkspace = createMockWorkspace({
        path: 'packages/core',
        version: '1.0.0' as Version,
        newVersion: '1.1.0' as Version,
        hasChanges: true,
        changedFiles: ['src/core.ts'],
        name: 'core',
      });

      const childNodes: WorkspaceNode[] = [
        {
          workspace: childWorkspace,
          children: [
            {
              workspace: grandChildWorkspace,
              children: [],
              isRoot: false,
            },
          ],
          isRoot: false,
        },
      ];

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
        childWorkspaces: childNodes,
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.content).toContain('packages/core');
      expect(result.content).toContain('packages/core/sub');
      expect(result.content).toContain('v1.1.0');
      expect(result.content).toContain('v0.2.0');
    });

    it('should support different preset formats', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const presets: ChangelogPreset[] = ['conventionalcommits', 'angular', 'atom'];

      for (const preset of presets) {
        vi.clearAllMocks();

        const options: GenerateChangelogOptions = {
          workspace: mockWorkspace,
          changelogPath: '/test/CHANGELOG.md',
          repository: mockRepository,
          preset,
        };

        // Act
        const result = await service.generateForWorkspace(options);

        // Assert
        expect(result.content).toContain('# 1.2.0'); // Angular uses single #
      }
    });

    it('should include repository context in changelog', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        preset: 'conventionalcommits',
        repository: {
          owner: 'test-owner',
          repo: 'test-repo',
        },
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.content).toContain('## 1.2.0');
    });

    it('should throw FileOperationError on write failure', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
      };

      // Act & Assert
      await expect(service.generateForWorkspace(options)).rejects.toThrow(FileOperationError);
    });

    it('should create directory if it does not exist', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/nested/dir/CHANGELOG.md',
        preset: 'conventionalcommits',
        repository: mockRepository,
      };

      // Act
      await service.generateForWorkspace(options);

      // Assert
      expect(fs.mkdir).toHaveBeenCalledWith('/test/nested/dir', { recursive: true });
    });

    it('should preserve existing changelog header', async () => {
      // Arrange
      const existingChangelog = `# CHANGELOG

All notable changes to this project will be documented in this file.

## [1.1.0] - 2024-01-01

### Features

* old feature
`;

      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue(existingChangelog);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.content).toContain('All notable changes to this project');
      expect(result.content).toContain('## 1.2.0');
      expect(result.content).toContain('## [1.1.0]');
    });

    it('should handle empty changelog file', async () => {
      // Arrange
      vi.mocked(fs.access).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue('');
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      expect(result.created).toBe(false);
      expect(result.content).toContain('# Changelog');
      expect(result.content).toContain('## 1.2.0');
    });

    it('should default to conventionalcommits preset', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: Omit<GenerateChangelogOptions, 'preset'> = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
      };

      // Act
      const result = await service.generateForWorkspace(options as GenerateChangelogOptions);

      // Assert
      expect(result.content).toContain('## 1.2.0');
    });
  });

  describe('Child workspace summary formatting', () => {
    it('should sort child workspaces by path', async () => {
      // Arrange
      const childWorkspace1 = createMockWorkspace({
        path: 'packages/z-last',
        version: '1.0.0' as Version,
        newVersion: '1.1.0' as Version,
        hasChanges: true,
        changedFiles: ['src/index.ts'],
        name: 'z-last',
      });

      const childWorkspace2 = createMockWorkspace({
        path: 'packages/a-first',
        version: '2.0.0' as Version,
        newVersion: '2.1.0' as Version,
        hasChanges: true,
        changedFiles: ['src/index.ts'],
        name: 'a-first',
      });

      const childNodes: WorkspaceNode[] = [
        {
          workspace: childWorkspace1,
          children: [],
          isRoot: false,
        },
        {
          workspace: childWorkspace2,
          children: [],
          isRoot: false,
        },
      ];

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
        childWorkspaces: childNodes,
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      const aFirstIndex = result.content.indexOf('packages/a-first');
      const zLastIndex = result.content.indexOf('packages/z-last');
      expect(aFirstIndex).toBeLessThan(zLastIndex);
    });

    it('should indicate changed vs unchanged workspaces', async () => {
      // Arrange
      const changedWorkspace = createMockWorkspace({
        path: 'packages/changed',
        version: '1.0.0' as Version,
        newVersion: '1.1.0' as Version,
        hasChanges: true,
        changedFiles: ['src/index.ts'],
        name: 'changed',
      });

      const unchangedWorkspace = createMockWorkspace({
        path: 'packages/unchanged',
        version: '2.0.0' as Version,
        newVersion: '2.0.0' as Version,
        hasChanges: false,
        changedFiles: [],
        name: 'unchanged',
      });

      const childNodes: WorkspaceNode[] = [
        {
          workspace: changedWorkspace,
          children: [],
          isRoot: false,
        },
        {
          workspace: unchangedWorkspace,
          children: [],
          isRoot: false,
        },
      ];

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
        childWorkspaces: childNodes,
      };

      // Act
      const result = await service.generateForWorkspace(options);

      // Assert
      const lines = result.content.split('\n');
      const changedLine = lines.find((line) => line.includes('packages/changed'));
      const unchangedLine = lines.find((line) => line.includes('packages/unchanged'));

      expect(changedLine).toContain('🔄');
      expect(unchangedLine).toContain('✓');
    });
  });

  describe('Error handling', () => {
    it('should handle preset loading failure gracefully', async () => {
      // Arrange
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'invalid-preset' as ChangelogPreset,
      };

      // Act & Assert - should throw FileOperationError for invalid preset
      await expect(service.generateForWorkspace(options)).rejects.toThrow(FileOperationError);
      await expect(service.generateForWorkspace(options)).rejects.toThrow('Unknown preset');
    });

    it('should throw FileOperationError with correct parameters', async () => {
      // Arrange
      const writeError = new Error('Disk full');
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockRejectedValue(writeError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const options: GenerateChangelogOptions = {
        workspace: mockWorkspace,
        changelogPath: '/test/CHANGELOG.md',
        repository: mockRepository,
        preset: 'conventionalcommits',
      };

      // Act & Assert
      try {
        await service.generateForWorkspace(options);
        expect.fail('Should have thrown FileOperationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileOperationError);
        if (error instanceof FileOperationError) {
          expect(error.message).toContain('generate');
          expect(error.message).toContain('/test/CHANGELOG.md');
        }
      }
    });
  });
});
