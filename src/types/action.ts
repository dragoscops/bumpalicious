/**
 * GitHub Action input/output type definitions
 */

import type { BumpType } from './version.js';
import type { WorkspaceConfig } from './workspace.js';

/**
 * Action-specific bump type including 'none' for no changes
 */
export type ActionBumpType = BumpType | 'none';

/**
 * GitHub Action inputs from action.yml
 */
export interface ActionInputs {
  readonly token: string;
  readonly workspaces: string;
  readonly createPr: boolean;
  readonly autoMerge: boolean;
  readonly prBaseBranch: string;
  readonly prHeadBranch: string;
  readonly prTitle: string;
  readonly prBody: string;
  readonly commitMessage: string;
  readonly tagPrefix: string;
  readonly createShortTags: boolean;
  readonly changelogPreset: string;
  readonly debug: boolean;
}

/**
 * Parsed workspace configurations
 */
export interface ParsedWorkspaces {
  readonly workspaces: ReadonlyArray<WorkspaceConfig>;
}

/**
 * GitHub Action outputs
 */
export interface ActionOutputs {
  /** Primary version tag created (e.g., 'v1.2.3') */
  readonly tag: string;
  /** New version number without prefix (e.g., '1.2.3') */
  readonly version: string;
  /** Pull request number if PR was created (empty string if no PR) */
  readonly pr: string;
  /** Comma-separated list of all tags created (includes monorepo workspace tags) */
  readonly all_tags: string;
  /** JSON array of workspace paths that had version changes */
  readonly changed_workspaces: string;
  /** Type of version bump performed (major, minor, patch, pre-release, or none) */
  readonly bump_type: ActionBumpType;
}

/**
 * Action execution context
 */
export interface ActionContext {
  readonly inputs: ActionInputs;
  readonly repository: {
    readonly owner: string;
    readonly repo: string;
  };
  readonly sha: string;
  readonly ref: string;
}
