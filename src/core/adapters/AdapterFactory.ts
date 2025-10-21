/**
 * Workspace Adapter Factory
 *
 * Factory for creating workspace adapters based on workspace type.
 * Provides type-safe adapter instantiation with singleton pattern for performance.
 *
 * Usage:
 * ```typescript
 * const adapter = getAdapter('node');
 * const result = await adapter.detect('.');
 *
 * // Error for unknown types
 * try {
 *   getAdapter('unknown' as WorkspaceType);
 * } catch (error) {
 *   console.error(error); // InvalidConfigurationError
 * }
 * ```
 */

import type { BaseWorkspaceAdapter } from './BaseAdapter.js';
import { DenoAdapter } from './DenoAdapter.js';
import { GoAdapter } from './GoAdapter.js';
import { NodeAdapter } from './NodeAdapter.js';
import { PythonAdapter } from './PythonAdapter.js';
import { RustAdapter } from './RustAdapter.js';
import { TextAdapter } from './TextAdapter.js';
import { ZigAdapter } from './ZigAdapter.js';
import type { WorkspaceType } from '../../types/index.js';
import { InvalidConfigurationError } from '../../utils/errors.js';

/**
 * Adapter registry type
 *
 * Maps workspace types to their adapter instances.
 */
type AdapterRegistry = {
  [K in WorkspaceType]: BaseWorkspaceAdapter;
};

/**
 * Singleton adapter instances
 *
 * Lazy-initialized adapter instances for performance.
 * Each adapter is created only once on first request.
 */
const adapterInstances: Partial<AdapterRegistry> = {};

/**
 * Adapter factory functions
 *
 * Maps workspace types to their adapter constructors.
 */
const adapterFactories: Record<WorkspaceType, () => BaseWorkspaceAdapter> = {
  node: () => new NodeAdapter(),
  python: () => new PythonAdapter(),
  deno: () => new DenoAdapter(),
  go: () => new GoAdapter(),
  rust: () => new RustAdapter(),
  zig: () => new ZigAdapter(),
  text: () => new TextAdapter(),
};

/**
 * Get workspace adapter for the specified type
 *
 * Returns a singleton instance of the appropriate adapter.
 * Throws InvalidConfigurationError for unsupported workspace types.
 *
 * @param type - Workspace type ('node', 'python', 'deno', etc.)
 * @returns Workspace adapter instance
 * @throws {InvalidConfigurationError} If workspace type is not supported
 *
 * @example
 * ```typescript
 * // Get Node.js adapter
 * const nodeAdapter = getAdapter('node');
 * const result = await nodeAdapter.detect('.');
 *
 * // Get Python adapter
 * const pythonAdapter = getAdapter('python');
 * await pythonAdapter.update('.', toVersion('1.2.0'));
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const adapter = getAdapter('unsupported' as WorkspaceType);
 * } catch (error) {
 *   if (error instanceof InvalidConfigurationError) {
 *     console.error('Unsupported workspace type:', error.message);
 *   }
 * }
 * ```
 */
export function getAdapter(type: WorkspaceType): BaseWorkspaceAdapter {
  // Return cached instance if available
  if (adapterInstances[type]) {
    return adapterInstances[type]!;
  }

  // Check if adapter factory exists
  const factory = adapterFactories[type];
  if (!factory) {
    throw new InvalidConfigurationError(
      'workspaceType',
      `Unsupported workspace type: ${type}. Supported types: ${Object.keys(adapterFactories).join(', ')}`,
    );
  }

  // Create and cache new instance
  const adapter = factory();
  adapterInstances[type] = adapter;

  return adapter;
}

/**
 * Get all supported workspace types
 *
 * Returns an array of all workspace types that have registered adapters.
 *
 * @returns Array of supported workspace types
 *
 * @example
 * ```typescript
 * const types = getSupportedTypes();
 * console.log(types); // ['node', 'python', 'deno', 'go', 'rust', 'zig', 'text']
 * ```
 */
export function getSupportedTypes(): ReadonlyArray<WorkspaceType> {
  return Object.keys(adapterFactories) as WorkspaceType[];
}

/**
 * Check if a workspace type is supported
 *
 * @param type - Workspace type to check
 * @returns True if the type has a registered adapter
 *
 * @example
 * ```typescript
 * if (isTypeSupported('node')) {
 *   const adapter = getAdapter('node');
 * }
 * ```
 */
export function isTypeSupported(type: string): type is WorkspaceType {
  return type in adapterFactories;
}

/**
 * Clear adapter cache
 *
 * Removes all cached adapter instances.
 * Useful for testing or when you need fresh instances.
 *
 * @internal This is primarily for testing purposes
 */
export function clearAdapterCache(): void {
  for (const key of Object.keys(adapterInstances)) {
    delete adapterInstances[key as WorkspaceType];
  }
}
