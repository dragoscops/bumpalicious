/**
 * Monorepo Workflow Integration Tests
 *
 * Tests monorepo scenarios with workspace tree building and validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceTreeBuilder } from '../../src/core/WorkspaceTreeBuilder.js';
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

describe('Monorepo Workflow Integration', () => {
  let treeBuilder: WorkspaceTreeBuilder;

  beforeEach(() => {
    treeBuilder = new WorkspaceTreeBuilder();
  });

  describe('Workspace Tree Building', () => {
    it('should build tree for single workspace', () => {
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
      expect(tree.root.workspace.name).toBe('root');
      expect(tree.masterVersion).toBe('1.1.0');
    });

    it('should build tree with parent-child relationships', () => {
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

      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0].workspace.name).toBe('child');
    });

    it('should build nested workspace hierarchies', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: true, // Root MUST have changes when children change
          changedFiles: ['packages/lib/utils/utils.ts'],
          newVersion: toVersion('1.1.0'),
        },
        {
          path: 'packages/lib',
          type: 'node',
          name: 'lib',
          version: toVersion('0.5.0'),
          hasChanges: true, // Parent MUST have changes when children change
          changedFiles: ['utils/utils.ts'],
          newVersion: toVersion('0.6.0'),
        },
        {
          path: 'packages/lib/utils',
          type: 'node',
          name: 'utils',
          version: toVersion('0.1.0'),
          hasChanges: true,
          changedFiles: ['utils.ts'],
          newVersion: toVersion('0.2.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);

      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0].children).toHaveLength(1);
    });
  });

  describe('Workspace Tree Validation', () => {
    it('should throw error for empty workspace list', () => {
      expect(() => treeBuilder.build([])).toThrow('No workspaces provided');
    });

    it('should validate workspace path relationships', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: 'a',
          type: 'node',
          name: 'parent',
          version: toVersion('1.0.0'),
          hasChanges: true, // Parent MUST have changes when children change
          changedFiles: ['b/index.ts'],
          newVersion: toVersion('1.1.0'),
        },
        {
          path: 'a/b',
          type: 'node',
          name: 'child',
          version: toVersion('1.0.0'),
          hasChanges: true,
          changedFiles: ['index.ts'],
          newVersion: toVersion('1.1.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);

      expect(tree.root.workspace.name).toBe('parent');
      expect(tree.root.children).toHaveLength(1);
    });
  });

  describe('Multi-Language Monorepo', () => {
    it('should handle workspaces with different types', () => {
      const workspaces: WorkspaceWithVersion[] = [
        {
          path: '.',
          type: 'node',
          name: 'root',
          version: toVersion('1.0.0'),
          hasChanges: true, // Root MUST have changes when children change
          changedFiles: ['python-service/setup.py', 'go-service/main.go'],
          newVersion: toVersion('1.1.0'),
        },
        {
          path: 'python-service',
          type: 'python',
          name: 'python-service',
          version: toVersion('0.1.0'),
          hasChanges: true,
          changedFiles: ['setup.py'],
          newVersion: toVersion('0.2.0'),
        },
        {
          path: 'go-service',
          type: 'go',
          name: 'go-service',
          version: toVersion('1.2.0'),
          hasChanges: true,
          changedFiles: ['main.go'],
          newVersion: toVersion('1.3.0'),
        },
      ];

      const tree = treeBuilder.build(workspaces);

      expect(tree.root.children).toHaveLength(2);
      const types = tree.root.children.map((c) => c.workspace.type);
      expect(types).toContain('python');
      expect(types).toContain('go');
    });
  });
});
