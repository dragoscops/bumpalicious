/**
 * Runtime input validation using Zod schemas
 */

import { z } from 'zod';
import { InvalidConfigurationError } from './errors.js';
import type { ActionInputs, WorkspaceConfig } from '../types/index.js';

/**
 * Zod schema for workspace types
 */
export const WorkspaceTypeSchema = z.enum(['node', 'python', 'deno', 'go', 'rust', 'zig', 'text']);

/**
 * Zod schema for workspace configuration
 */
export const WorkspaceConfigSchema = z.object({
  path: z
    .string()
    .min(1, 'Workspace path cannot be empty')
    .refine((path) => !path.includes('..'), {
      message: 'Workspace path cannot contain ".." for security reasons',
    }),
  type: WorkspaceTypeSchema,
});

/**
 * Zod schema for action inputs
 */
export const ActionInputsSchema = z.object({
  token: z.string().min(1, 'GitHub token is required'),
  workspaces: z.string().min(1, 'At least one workspace must be specified'),
  createPr: z.boolean(),
  autoMerge: z.boolean(),
  prBaseBranch: z.string().min(1, 'PR base branch cannot be empty'),
  prHeadBranch: z.string().min(1, 'PR head branch cannot be empty'),
  prTitle: z.string().min(1, 'PR title cannot be empty'),
  prBody: z.string(),
  commitMessage: z.string().min(1, 'Commit message cannot be empty'),
  tagPrefix: z.string(),
  createShortTags: z.boolean(),
  changelogPreset: z.string().min(1, 'Changelog preset cannot be empty'),
  debug: z.boolean(),
});

/**
 * Validates action inputs against the schema
 * @param inputs - Raw inputs to validate
 * @returns Validated and type-safe ActionInputs
 * @throws InvalidConfigurationError if validation fails
 */
export function validateInputs(inputs: unknown): ActionInputs {
  try {
    return ActionInputsSchema.parse(inputs);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((err: z.ZodIssue) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      throw new InvalidConfigurationError('action inputs', messages.join('; '), error);
    }
    throw new InvalidConfigurationError('action inputs', 'validation failed with unknown error', error);
  }
}

/**
 * Validates workspace configuration against the schema
 * @param config - Raw workspace config to validate
 * @returns Validated and type-safe WorkspaceConfig
 * @throws InvalidConfigurationError if validation fails
 */
export function validateWorkspaceConfig(config: unknown): WorkspaceConfig {
  try {
    return WorkspaceConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((err: z.ZodIssue) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      throw new InvalidConfigurationError('workspace configuration', messages.join('; '), error);
    }
    throw new InvalidConfigurationError('workspace configuration', 'validation failed with unknown error', error);
  }
}

/**
 * Validates an array of workspace configurations
 * @param configs - Array of raw workspace configs to validate
 * @returns Array of validated and type-safe WorkspaceConfig
 * @throws InvalidConfigurationError if validation fails
 */
export function validateWorkspaceConfigs(configs: unknown): ReadonlyArray<WorkspaceConfig> {
  if (!Array.isArray(configs)) {
    throw new InvalidConfigurationError('workspaces', 'must be an array');
  }

  if (configs.length === 0) {
    throw new InvalidConfigurationError('workspaces', 'at least one workspace configuration is required');
  }

  try {
    return configs.map((config, index) => {
      try {
        return validateWorkspaceConfig(config);
      } catch (error) {
        if (error instanceof InvalidConfigurationError) {
          throw new InvalidConfigurationError(`workspaces[${index}]`, error.message, error.cause);
        }
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof InvalidConfigurationError) {
      throw error;
    }
    throw new InvalidConfigurationError('workspaces', 'validation failed with unknown error', error);
  }
}
