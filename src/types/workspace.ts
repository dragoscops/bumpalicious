/**
 * Workspace type definitions for multi-language monorepo support
 */

import type {Version} from './version.js';

/**
 * Supported workspace types
 */
export type WorkspaceType = 'node' | 'python' | 'deno' | 'go' | 'rust' | 'zig' | 'text';

/**
 * Workspace configuration from action inputs
 */
export interface WorkspaceConfig {
  readonly path: string;
  readonly type: WorkspaceType;
}

/**
 * Project information extracted from workspace files
 */
export interface ProjectInfo {
  readonly name: string;
  readonly version: Version;
}

/**
 * Enriched workspace with detected metadata
 */
export interface Workspace extends WorkspaceConfig {
  readonly name: string;
  readonly version: Version;
  readonly hasChanges: boolean;
  readonly changedFiles: ReadonlyArray<string>;
}

/**
 * Workspace with calculated new version
 */
export interface WorkspaceWithVersion extends Workspace {
  readonly newVersion: Version;
}

/**
 * Workspace tree node for hierarchical representation
 */
export interface WorkspaceNode {
  readonly workspace: WorkspaceWithVersion;
  readonly children: ReadonlyArray<WorkspaceNode>;
  readonly isRoot: boolean;
}

/**
 * Complete workspace tree structure
 */
export interface WorkspaceTree {
  readonly root: WorkspaceNode;
  readonly masterVersion: Version;
  readonly allWorkspaces: ReadonlyArray<WorkspaceWithVersion>;
}

/**
 * Workspace detection result from adapters
 */
export interface WorkspaceDetectionResult {
  readonly found: boolean;
  readonly info?: ProjectInfo;
  readonly filePath?: string;
}
