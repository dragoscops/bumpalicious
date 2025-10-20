/**
 * End-to-End Multi-Workspace Tests
 *
 * Complete end-to-end workflow tests for multi-workspace (monorepo) scenarios.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceTreeBuilder } from '../../src/core/WorkspaceTreeBuilder.js';
import { VersionService } from '../../src/core/VersionService.js';
import { toVersion } from '../../src/types/version.js';
import type { WorkspaceWithVersion } from '../../src/types/workspace.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe('Multi-Workspace E2E', () => {
  let treeBuilder: WorkspaceTreeBuilder;
  let versionService: VersionService;

  beforeEach(() => {
    treeBuilder = new WorkspaceTreeBuilder();
    versionService = new VersionService();
  });

  describe('Monorepo Complete Workflow', () => {
    it('should handle full version bump workflow for monorepo', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: false,
          changedFiles: [],
          newVersion: toVersion('1.1.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);
      expect(tree.root).toBeDefined();
      expect(tree.masterVersion).toBe('1.1.0');
    });

    it('should propagate version changes from child to root', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: true, // Root MUST have changes when children change
          changedFiles: ['packages/child/src/index.ts'],
          newVersion: toVersion('1.1.0'),
        },
        {
          path: 'packages/child',
          type: 'node',
          name: 'child',
          version: toVersion('0.5.0'),
          hasChanges: true,
          changedFiles: ['src/index.ts'],
          newVersion: toVersion('0.6.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);

      // Root version should change when child changes
      expect(tree.root.workspace.newVersion).toBe('1.1.0');
      expect(tree.root.children[0].workspace.newVersion).toBe('0.6.0');
    });

    it('should handle multiple changed workspaces', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: true, // Root MUST have changes when children change
          changedFiles: ['packages/lib1/index.ts', 'packages/lib2/main.ts'],
          newVersion: toVersion('1.1.0'),
        },
        {
          path: 'packages/lib1',
          type: 'node',
          name: 'lib1',
          version: toVersion('0.5.0'),
          hasChanges: true,
          changedFiles: ['index.ts'],
          newVersion: toVersion('0.6.0'),
        },
        {
          path: 'packages/lib2',
          type: 'node',
          name: 'lib2',
          version: toVersion('0.3.0'),
          hasChanges: true,
          changedFiles: ['main.ts'],
          newVersion: toVersion('0.4.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);

      expect(tree.root.children).toHaveLength(2);
    });
  });

  describe('Pre-release Workflows', () => {
    it('should handle pre-release version bumps', () => {
      const version = versionService.calculateNewVersion(toVersion('1.0.0'), {
        type: 'minor',
        breaking: false,
        preRelease: 'alpha',
        message: 'feat: new feature',
      });

      expect(version).toMatch(/^1\.1\.0-alpha\.\d+$/);
    });

    it('should increment pre-release versions', () => {
      const version = versionService.calculateNewVersion(toVersion('1.0.0-alpha.1'), {
        type: 'patch',
        breaking: false,
        preRelease: 'alpha',
        message: 'fix: bug fix',
      });

      expect(version).toMatch(/^1\.0\.0-alpha\.\d+$/);
    });
  });

  describe('Validation Scenarios', () => {
    it('should validate workspace tree structure', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: true,
          changedFiles: ['package.json'],
          newVersion: toVersion('1.1.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);
      expect(tree.root).toBeDefined();
    });

    it('should handle empty workspace list', () => {
      expect(() => treeBuilder.build([])).toThrow('No workspaces provided');
    });

    it('should build tree with proper hierarchy', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: true, // Root MUST have changes when children change
          changedFiles: ['a/b/index.ts'],
          newVersion: toVersion('1.1.0'),
        },
        {
          path: 'a',
          type: 'node',
          name: 'a',
          version: toVersion('0.1.0'),
          hasChanges: true, // Parent MUST have changes when children change
          changedFiles: ['b/index.ts'],
          newVersion: toVersion('0.2.0'),
        },
        {
          path: 'a/b',
          type: 'node',
          name: 'b',
          version: toVersion('0.0.1'),
          hasChanges: true,
          changedFiles: ['index.ts'],
          newVersion: toVersion('0.0.2'),
        },
      ];

      const tree = treeBuilder.build(workspaces);

      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0].children).toHaveLength(1);
    });
  });
});
