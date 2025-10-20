/**
 * Workspace Tree Builder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';
import type { WorkspaceWithVersion } from '../types/workspace.js';
import { toVersion } from '../types/version.js';
import { WorkspaceValidationError } from '../utils/errors.js';

describe('WorkspaceTreeBuilder', () => {
  let builder: WorkspaceTreeBuilder;

  beforeEach(() => {
    builder = new WorkspaceTreeBuilder();
  });

  describe('build()', () => {
    describe('input validation', () => {
      it('should throw error for empty workspace list', () => {
        expect(() => builder.build([])).toThrow(WorkspaceValidationError);
        expect(() => builder.build([])).toThrow('No workspaces provided');
      });

      it('should handle single workspace', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: ['src/index.ts'],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace).toBe(workspaces[0]);
        expect(tree.root.children).toHaveLength(0);
        expect(tree.root.isRoot).toBe(true);
        expect(tree.masterVersion).toBe(toVersion('1.1.0'));
        expect(tree.allWorkspaces).toEqual(workspaces);
      });
    });

    describe('root identification', () => {
      it('should identify root by shortest path (".")', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.path).toBe('.');
        expect(tree.root.workspace.name).toBe('root');
      });

      it('should identify root by shortest path ("./" normalized to ".")', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: './',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.path).toBe('./');
        expect(tree.root.workspace.name).toBe('root');
      });

      it('should identify root in workspace without "." path', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: 'app/services/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'app',
            type: 'node',
            name: 'app',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.path).toBe('app');
        expect(tree.root.workspace.name).toBe('app');
      });
    });

    describe('tree structure', () => {
      it('should build simple parent-child relationship', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.path).toBe('.');
        expect(tree.root.children).toHaveLength(1);
        expect(tree.root.children[0].workspace.path).toBe('packages/api');
        expect(tree.root.children[0].children).toHaveLength(0);
      });

      it('should build multiple children', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/web',
            type: 'node',
            name: 'web',
            version: toVersion('2.0.0'),
            newVersion: toVersion('2.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.children).toHaveLength(2);
        expect(tree.root.children[0].workspace.name).toBe('api');
        expect(tree.root.children[1].workspace.name).toBe('web');
      });

      it('should build multi-level nested structure', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api/models',
            type: 'node',
            name: 'models',
            version: toVersion('0.5.0'),
            newVersion: toVersion('0.6.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.children).toHaveLength(1);
        expect(tree.root.children[0].workspace.name).toBe('api');
        expect(tree.root.children[0].children).toHaveLength(1);
        expect(tree.root.children[0].children[0].workspace.name).toBe('models');
      });

      it('should select closest parent in complex hierarchy', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages',
            type: 'text',
            name: 'packages',
            version: toVersion('0.1.0'),
            newVersion: toVersion('0.1.1'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.path).toBe('.');
        expect(tree.root.children).toHaveLength(1);
        expect(tree.root.children[0].workspace.path).toBe('packages');
        expect(tree.root.children[0].children).toHaveLength(1);
        expect(tree.root.children[0].children[0].workspace.path).toBe('packages/api');
      });
    });

    describe('single root validation', () => {
      it('should throw error for multiple root workspaces', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: 'project1',
            type: 'node',
            name: 'project1',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'project2',
            type: 'python',
            name: 'project2',
            version: toVersion('2.0.0'),
            newVersion: toVersion('2.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        expect(() => builder.build(workspaces)).toThrow(WorkspaceValidationError);
        expect(() => builder.build(workspaces)).toThrow('Multiple root workspaces found');
        expect(() => builder.build(workspaces)).toThrow('project1, project2');
      });

      it('should allow "." as root with child workspaces', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'tools',
            type: 'go',
            name: 'tools',
            version: toVersion('0.5.0'),
            newVersion: toVersion('0.6.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.path).toBe('.');
        expect(tree.root.children).toHaveLength(1);
        expect(tree.root.children[0].workspace.path).toBe('tools');
      });
    });

    describe('change propagation validation', () => {
      it('should pass when root has changes and children have changes', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: ['package.json'],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: ['packages/api/src/api.ts'],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.hasChanges).toBe(true);
        expect(tree.root.children[0].workspace.hasChanges).toBe(true);
      });

      it('should pass when root has changes and children do not', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: ['README.md'],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.hasChanges).toBe(true);
        expect(tree.root.children[0].workspace.hasChanges).toBe(false);
      });

      it('should pass when no workspaces have changes', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.workspace.hasChanges).toBe(false);
        expect(tree.root.children[0].workspace.hasChanges).toBe(false);
      });

      it('should throw error when child has changes but root does not', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: ['packages/api/src/api.ts'],
          },
        ];

        expect(() => builder.build(workspaces)).toThrow(WorkspaceValidationError);
        expect(() => builder.build(workspaces)).toThrow('Child workspaces have changes');
        expect(() => builder.build(workspaces)).toThrow('packages/api');
        expect(() => builder.build(workspaces)).toThrow('root workspace');
      });

      it('should throw error when nested child has changes but root does not', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
          {
            path: 'packages/api/models',
            type: 'node',
            name: 'models',
            version: toVersion('0.5.0'),
            newVersion: toVersion('0.6.0'),
            hasChanges: true,
            changedFiles: ['packages/api/models/user.ts'],
          },
        ];

        expect(() => builder.build(workspaces)).toThrow(WorkspaceValidationError);
        expect(() => builder.build(workspaces)).toThrow('Child workspaces have changes');
        expect(() => builder.build(workspaces)).toThrow('packages/api/models');
      });

      it('should throw error when one of multiple children has changes but root does not', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.0.0'),
            hasChanges: false,
            changedFiles: [],
          },
          {
            path: 'packages/web',
            type: 'node',
            name: 'web',
            version: toVersion('2.0.0'),
            newVersion: toVersion('2.1.0'),
            hasChanges: true,
            changedFiles: ['packages/web/index.html'],
          },
        ];

        expect(() => builder.build(workspaces)).toThrow(WorkspaceValidationError);
        expect(() => builder.build(workspaces)).toThrow('packages/web');
      });
    });

    describe('tree properties', () => {
      it('should set masterVersion to root newVersion', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('2.0.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.masterVersion).toBe(toVersion('2.0.0'));
      });

      it('should include all workspaces in allWorkspaces array', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/web',
            type: 'node',
            name: 'web',
            version: toVersion('2.0.0'),
            newVersion: toVersion('2.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.allWorkspaces).toHaveLength(3);
        expect(tree.allWorkspaces).toEqual(workspaces);
      });

      it('should mark root node with isRoot=true', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.isRoot).toBe(true);
        expect(tree.root.children[0].isRoot).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle trailing slashes in paths', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: './',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'packages/api/',
            type: 'node',
            name: 'api',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.children).toHaveLength(1);
        expect(tree.root.children[0].workspace.path).toBe('packages/api/');
      });

      it('should handle workspaces with similar path prefixes', () => {
        const workspaces: WorkspaceWithVersion[] = [
          {
            path: '.',
            type: 'node',
            name: 'root',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'pkg',
            type: 'node',
            name: 'pkg',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
          {
            path: 'pkgs',
            type: 'node',
            name: 'pkgs',
            version: toVersion('1.0.0'),
            newVersion: toVersion('1.1.0'),
            hasChanges: true,
            changedFiles: [],
          },
        ];

        const tree = builder.build(workspaces);

        expect(tree.root.children).toHaveLength(2);
        // Should not confuse 'pkg' as parent of 'pkgs'
        expect(tree.root.children[0].workspace.name).toBe('pkg');
        expect(tree.root.children[1].workspace.name).toBe('pkgs');
        expect(tree.root.children[0].children).toHaveLength(0);
        expect(tree.root.children[1].children).toHaveLength(0);
      });
    });
  });
});
