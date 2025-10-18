/**
 * Workspace input parser for action.yml workspace configuration
 */

import { InvalidConfigurationError } from './errors.js';
import { validateWorkspaceConfigs } from './validators.js';
import type { WorkspaceConfig } from '../types/index.js';

/**
 * Parses workspace input string into validated workspace configurations
 *
 * @param input - Workspace input string (e.g., ".:node;packages/api:python")
 * @returns Array of validated workspace configurations
 * @throws InvalidConfigurationError if input is malformed or validation fails
 *
 * @example
 * ```typescript
 * parseWorkspacesInput(".:node;packages/api:python")
 * // Returns: [{path: ".", type: "node"}, {path: "packages/api", type: "python"}]
 *
 * parseWorkspacesInput(".:node,tools:go")
 * // Returns: [{path: ".", type: "node"}, {path: "tools", type: "go"}]
 * ```
 */
export function parseWorkspacesInput(input: string): ReadonlyArray<WorkspaceConfig> {
  // Validate input is not empty
  if (!input || input.trim() === '') {
    throw new InvalidConfigurationError('workspaces', 'input cannot be empty');
  }

  // Split by both ; and , separators
  const segments = input
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) {
    throw new InvalidConfigurationError('workspaces', 'no valid workspace definitions found');
  }

  // Parse each segment
  const configs = segments.map((segment, index) => {
    const parts = segment.split(':');

    if (parts.length !== 2) {
      throw new InvalidConfigurationError(
        `workspaces[${index}]`,
        `invalid format "${segment}". Expected format: "path:type"`,
      );
    }

    const [rawPath, type] = parts;
    const path = normalizePath(rawPath.trim());
    const trimmedType = type.trim();

    if (path === '') {
      throw new InvalidConfigurationError(`workspaces[${index}]`, 'path cannot be empty');
    }

    if (trimmedType === '') {
      throw new InvalidConfigurationError(`workspaces[${index}]`, 'type cannot be empty');
    }

    return { path, type: trimmedType };
  });

  // Validate all configs using existing validator
  return validateWorkspaceConfigs(configs);
}

/**
 * Normalizes workspace path for consistent representation
 * - Converts "./" to "."
 * - Removes trailing slashes
 * - Trims whitespace
 *
 * @param path - Raw path string
 * @returns Normalized path string
 */
function normalizePath(path: string): string {
  let normalized = path.trim();

  // Convert "./" to "."
  if (normalized === './') {
    normalized = '.';
  }

  // Remove leading "./" if present
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  // Remove trailing slashes (except for root ".")
  if (normalized !== '.' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}
