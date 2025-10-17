/**
 * GitHub Action input/output type definitions
 */

import type {WorkspaceConfig} from './workspace.js';

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
  readonly tag: string;
  readonly version: string;
  readonly pr?: string;
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
