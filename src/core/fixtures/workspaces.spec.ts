/**
 * Tests for workspace fixtures
 */

import { describe, it, expect } from 'vitest';
import {
  mockWorkspaceConfigs,
  mockWorkspaces,
  mockWorkspacesWithVersion,
  mockWorkspaceNodes,
  mockWorkspaceTrees,
  mockMonorepoWorkspaces,
  mockMultiLanguageWorkspaces,
} from './workspaces.js';

describe('workspace fixtures', () => {
  describe('mockWorkspaceConfigs', () => {
    it('should create valid workspace configurations', () => {
      const config = mockWorkspaceConfigs.node();
      expect(config).toEqual({ path: '.', type: 'node' });
    });

    it('should support all workspace types', () => {
      expect(mockWorkspaceConfigs.node().type).toBe('node');
      expect(mockWorkspaceConfigs.python().type).toBe('python');
      expect(mockWorkspaceConfigs.denoPackage().type).toBe('deno');
      expect(mockWorkspaceConfigs.goPackage().type).toBe('go');
      expect(mockWorkspaceConfigs.rustPackage().type).toBe('rust');
      expect(mockWorkspaceConfigs.zigPackage().type).toBe('zig');
      expect(mockWorkspaceConfigs.textPackage().type).toBe('text');
    });
  });

  describe('mockWorkspaces', () => {
    it('should create workspace without changes', () => {
      const workspace = mockWorkspaces.node();
      expect(workspace.hasChanges).toBe(false);
      expect(workspace.changedFiles).toEqual([]);
    });

    it('should create workspace with changes', () => {
      const workspace = mockWorkspaces.nodeWithChanges();
      expect(workspace.hasChanges).toBe(true);
      expect(workspace.changedFiles.length).toBeGreaterThan(0);
    });

    it('should have valid version', () => {
      const workspace = mockWorkspaces.node();
      expect(workspace.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('mockWorkspacesWithVersion', () => {
    it('should include new version', () => {
      const workspace = mockWorkspacesWithVersion.node();
      expect(workspace.newVersion).toBeDefined();
      expect(workspace.newVersion).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('mockWorkspaceNodes', () => {
    it('should create root node', () => {
      const node = mockWorkspaceNodes.root();
      expect(node.isRoot).toBe(true);
      expect(node.children).toEqual([]);
    });

    it('should create node with children', () => {
      const node = mockWorkspaceNodes.withChildren();
      expect(node.isRoot).toBe(true);
      expect(node.children.length).toBeGreaterThan(0);
      expect(node.children[0].isRoot).toBe(false);
    });
  });

  describe('mockWorkspaceTrees', () => {
    it('should create single workspace tree', () => {
      const tree = mockWorkspaceTrees.singleWorkspace();
      expect(tree.root.isRoot).toBe(true);
      expect(tree.masterVersion).toBeDefined();
      expect(tree.allWorkspaces.length).toBe(1);
    });

    it('should create monorepo tree', () => {
      const tree = mockWorkspaceTrees.monorepo();
      expect(tree.root.isRoot).toBe(true);
      expect(tree.allWorkspaces.length).toBeGreaterThan(1);
    });
  });

  describe('helper functions', () => {
    it('mockMonorepoWorkspaces should return multiple workspaces', () => {
      const workspaces = mockMonorepoWorkspaces();
      expect(workspaces.length).toBeGreaterThanOrEqual(3);
      expect(workspaces.every((ws) => ws.type === 'node')).toBe(true);
    });

    it('mockMultiLanguageWorkspaces should return different types', () => {
      const workspaces = mockMultiLanguageWorkspaces();
      const types = new Set(workspaces.map((ws) => ws.type));
      expect(types.size).toBeGreaterThan(1);
    });
  });
});
