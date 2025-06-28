import { describe, it, expect } from 'vitest';

import * as workspace from './workspace.js';

describe('utils/workspace.js module', () => {
  describe('stringToWorkspace', () => {
    it('will parse path and type', async () => {
      const result = workspace.stringToWorkspace('.:text');

      expect(result).toEqual({ path: '.', type: 'text' });
    });

    it('will parse all 4 params', async () => {
      const result = workspace.stringToWorkspace('.:text:project:1.0.0');

      expect(result).toEqual({
        name: 'project',
        path: '.',
        type: 'text',
        version: '1.0.0',
      });
    });

    it('will handle empty string', () => {
      const result = workspace.stringToWorkspace('');

      expect(result).toEqual({
        path: '',
      });
    });

    it('will handle only path', () => {
      const result = workspace.stringToWorkspace('/path/to/workspace');

      expect(result).toEqual({ path: '/path/to/workspace' });
    });
  });

  describe('buildWorkspaceTree(string[])', () => {
    it('returns empty array for empty input', () => {
      expect(workspace.buildUpdatedWorkspacesTrees([])).toEqual([]);
      expect(workspace.buildUpdatedWorkspacesTrees(null)).toEqual([]);
      expect(workspace.buildUpdatedWorkspacesTrees(undefined)).toEqual([]);
    });

    it('creates a single node tree for a single workspace', () => {
      const workspaceObject = { path: '/root/project', name: 'project', type: 'node', version: '1.0.0' };
      const result = workspace.buildUpdatedWorkspacesTrees([workspaceObject]);

      expect(result).toEqual([
        {
          workspace: workspaceObject,
          children: [],
          parent: null,
        },
      ]);
    });

    it('creates a tree with parent-child relationships based on paths', () => {
      const workspaceObjects = [
        { path: '/root/project', name: 'project', type: 'node', version: '1.0.0' },
        { path: '/root/project/service1', name: 'service1', type: 'node', version: '0.5.0' },
        { path: '/root/project/service2', name: 'service2', type: 'python', version: '0.2.0' },
      ];

      const result = workspace.buildUpdatedWorkspacesTrees(workspaceObjects);

      // Expect only one root node
      expect(result.length).toBe(1);

      // Verify root
      expect(result[0].workspace).toEqual(workspaceObjects[0]);
      expect(result[0].parent).toBeNull();

      // Verify children
      expect(result[0].children.length).toBe(2);

      // Check first child
      expect(result[0].children[0].workspace).toEqual(workspaceObjects[1]);
      expect(result[0].children[0].parent).toBe(result[0]);
      expect(result[0].children[0].children).toEqual([]);

      // Check second child
      expect(result[0].children[1].workspace).toEqual(workspaceObjects[2]);
      expect(result[0].children[1].parent).toBe(result[0]);
      expect(result[0].children[1].children).toEqual([]);
    });

    it('creates a tree with multiple levels of nesting', () => {
      const workspaceObjects = [
        { path: '/root/project', name: 'project', type: 'node', version: '1.0.0' },
        { path: '/root/project/service1', name: 'service1', type: 'node', version: '0.5.0' },
        { path: '/root/project/service1/submodule', name: 'submodule', type: 'node', version: '0.1.0' },
      ];

      const result = workspace.buildUpdatedWorkspacesTrees(workspaceObjects);

      // Should only have one root
      expect(result.length).toBe(1);

      // Check root
      expect(result[0].workspace).toEqual(workspaceObjects[0]);

      // Check first level child
      const serviceNode = result[0].children[0];
      expect(serviceNode.workspace).toEqual(workspaceObjects[1]);
      expect(serviceNode.parent).toBe(result[0]);

      // Check second level child
      const submoduleNode = serviceNode.children[0];
      expect(submoduleNode.workspace).toEqual(workspaceObjects[2]);
      expect(submoduleNode.parent).toBe(serviceNode);
    });

    it('returns multiple roots for unrelated workspaces', () => {
      const workspaceObjects = [
        { path: '/projects/project1', name: 'project1', type: 'node', version: '1.0.0' },
        { path: '/apps/app1', name: 'app1', type: 'python', version: '0.5.0' },
      ];

      const result = workspace.buildUpdatedWorkspacesTrees(workspaceObjects);

      // Should have two root nodes
      expect(result.length).toBe(2);

      // Check roots
      expect(result[0].workspace).toEqual(workspaceObjects[0]);
      expect(result[1].workspace).toEqual(workspaceObjects[1]);

      // Each should be a root (no parent)
      expect(result[0].parent).toBeNull();
      expect(result[1].parent).toBeNull();

      // No children
      expect(result[0].children).toEqual([]);
      expect(result[1].children).toEqual([]);
    });

    it('correctly identifies the closest parent in complex scenarios', () => {
      const workspaceObjects = [
        { path: '/root/project', name: 'project', type: 'node', version: '1.0.0' },
        { path: '/root', name: 'root', type: 'text', version: '0.1.0' },
        { path: '/root/project/service1', name: 'service1', type: 'node', version: '0.5.0' },
      ];

      const result = workspace.buildUpdatedWorkspacesTrees(workspaceObjects);

      // Should only have one root: '/root'
      expect(result.length).toBe(1);
      expect(result[0].workspace).toEqual(workspaceObjects[1]);

      // Project should be child of root
      const projectNode = result[0].children[0];
      expect(projectNode.workspace).toEqual(workspaceObjects[0]);
      expect(projectNode.parent).toBe(result[0]);

      // Service should be child of project
      const serviceNode = projectNode.children[0];
      expect(serviceNode.workspace).toEqual(workspaceObjects[2]);
      expect(serviceNode.parent).toBe(projectNode);
    });

    it('handles multiple trees in the same workspace array', () => {
      const workspaceObjects = [
        { path: '/project1/main', name: 'main1', type: 'node', version: '1.0.0' },
        { path: '/project1/main/service', name: 'service1', type: 'node', version: '0.5.0' },
        { path: '/project2/main', name: 'main2', type: 'python', version: '0.2.0' },
        { path: '/project2/main/service', name: 'service2', type: 'python', version: '0.1.0' },
      ];

      const result = workspace.buildUpdatedWorkspacesTrees(workspaceObjects);

      // Should have two root nodes
      expect(result.length).toBe(2);

      // Check first tree
      expect(result[0].workspace).toEqual(workspaceObjects[0]);
      expect(result[0].parent).toBeNull();
      expect(result[0].children.length).toBe(1);
      expect(result[0].children[0].workspace).toEqual(workspaceObjects[1]);

      // Check second tree
      expect(result[1].workspace).toEqual(workspaceObjects[2]);
      expect(result[1].parent).toBeNull();
      expect(result[1].children.length).toBe(1);
      expect(result[1].children[0].workspace).toEqual(workspaceObjects[3]);
    });
  });
});
