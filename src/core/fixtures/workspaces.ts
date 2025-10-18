/**
 * Mock workspace fixtures for testing
 *
 * Usage:
 * ```typescript
 * import { mockNodeWorkspace, mockMonorepoWorkspaces } from '@/core/fixtures/workspaces.js';
 *
 * // Use in tests
 * const workspace = mockNodeWorkspace();
 * const workspaces = mockMonorepoWorkspaces();
 * ```
 */

import type {
  WorkspaceConfig,
  Workspace,
  WorkspaceWithVersion,
  WorkspaceNode,
  WorkspaceTree,
} from '../../types/index.js';
import { toVersion } from '../../types/version.js';

/**
 * Mock workspace configuration fixtures
 */
export const mockWorkspaceConfigs = {
  node: (): WorkspaceConfig => ({ path: '.', type: 'node' }),
  python: (): WorkspaceConfig => ({ path: '.', type: 'python' }),
  nodePackage: (): WorkspaceConfig => ({ path: 'packages/api', type: 'node' }),
  pythonPackage: (): WorkspaceConfig => ({ path: 'backend', type: 'python' }),
  denoPackage: (): WorkspaceConfig => ({ path: 'deno-app', type: 'deno' }),
  goPackage: (): WorkspaceConfig => ({ path: 'tools', type: 'go' }),
  rustPackage: (): WorkspaceConfig => ({ path: 'rust-lib', type: 'rust' }),
  zigPackage: (): WorkspaceConfig => ({ path: 'zig-app', type: 'zig' }),
  textPackage: (): WorkspaceConfig => ({ path: 'docs', type: 'text' }),
};

/**
 * Mock enriched workspace fixtures
 */
export const mockWorkspaces = {
  node: (): Workspace => ({
    path: '.',
    type: 'node',
    name: 'my-project',
    version: toVersion('1.0.0'),
    hasChanges: false,
    changedFiles: [],
  }),

  nodeWithChanges: (): Workspace => ({
    path: '.',
    type: 'node',
    name: 'my-project',
    version: toVersion('1.0.0'),
    hasChanges: true,
    changedFiles: ['src/index.ts', 'package.json'],
  }),

  nodePackage: (): Workspace => ({
    path: 'packages/api',
    type: 'node',
    name: '@myorg/api',
    version: toVersion('2.1.0'),
    hasChanges: false,
    changedFiles: [],
  }),

  nodePackageWithChanges: (): Workspace => ({
    path: 'packages/api',
    type: 'node',
    name: '@myorg/api',
    version: toVersion('2.1.0'),
    hasChanges: true,
    changedFiles: ['packages/api/src/api.ts'],
  }),

  python: (): Workspace => ({
    path: '.',
    type: 'python',
    name: 'my-python-app',
    version: toVersion('0.5.2'),
    hasChanges: false,
    changedFiles: [],
  }),

  pythonPackage: (): Workspace => ({
    path: 'backend',
    type: 'python',
    name: 'backend',
    version: toVersion('1.2.3'),
    hasChanges: true,
    changedFiles: ['backend/main.py'],
  }),
};

/**
 * Mock workspace with version fixtures
 */
export const mockWorkspacesWithVersion = {
  node: (): WorkspaceWithVersion => ({
    ...mockWorkspaces.node(),
    newVersion: toVersion('1.1.0'),
  }),

  nodePackage: (): WorkspaceWithVersion => ({
    ...mockWorkspaces.nodePackage(),
    newVersion: toVersion('2.2.0'),
  }),

  nodePackageWithChanges: (): WorkspaceWithVersion => ({
    ...mockWorkspaces.nodePackageWithChanges(),
    newVersion: toVersion('2.2.0'),
  }),
};

/**
 * Mock workspace tree node fixtures
 */
export const mockWorkspaceNodes = {
  root: (): WorkspaceNode => ({
    workspace: mockWorkspacesWithVersion.node(),
    children: [],
    isRoot: true,
  }),

  withChildren: (): WorkspaceNode => ({
    workspace: mockWorkspacesWithVersion.node(),
    children: [
      {
        workspace: mockWorkspacesWithVersion.nodePackage(),
        children: [],
        isRoot: false,
      },
    ],
    isRoot: true,
  }),
};

/**
 * Mock workspace tree fixtures
 */
export const mockWorkspaceTrees = {
  singleWorkspace: (): WorkspaceTree => ({
    root: mockWorkspaceNodes.root(),
    masterVersion: toVersion('1.1.0'),
    allWorkspaces: [mockWorkspacesWithVersion.node()],
  }),

  monorepo: (): WorkspaceTree => ({
    root: mockWorkspaceNodes.withChildren(),
    masterVersion: toVersion('1.1.0'),
    allWorkspaces: [mockWorkspacesWithVersion.node(), mockWorkspacesWithVersion.nodePackage()],
  }),
};

/**
 * Creates a list of mock monorepo workspaces
 */
export function mockMonorepoWorkspaces(): ReadonlyArray<Workspace> {
  return [
    mockWorkspaces.nodeWithChanges(),
    mockWorkspaces.nodePackageWithChanges(),
    {
      path: 'packages/cli',
      type: 'node',
      name: '@myorg/cli',
      version: toVersion('1.5.0'),
      hasChanges: false,
      changedFiles: [],
    },
  ];
}

/**
 * Creates a list of mock multi-language workspaces
 */
export function mockMultiLanguageWorkspaces(): ReadonlyArray<Workspace> {
  return [
    mockWorkspaces.node(),
    mockWorkspaces.pythonPackage(),
    {
      path: 'tools',
      type: 'go',
      name: 'tools',
      version: toVersion('0.1.0'),
      hasChanges: true,
      changedFiles: ['tools/main.go'],
    },
  ];
}
