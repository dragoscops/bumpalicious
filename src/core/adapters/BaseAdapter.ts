/**
 * Base Workspace Adapter
 *
 * Abstract base class for workspace type adapters.
 * All language-specific adapters should extend this class.
 *
 * Usage:
 * ```typescript
 * class NodeAdapter extends BaseWorkspaceAdapter {
 *   readonly type = 'node';
 *   readonly supportedFiles = ['package.json'];
 *
 *   async detect(path: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
 *     // Implementation
 *   }
 *
 *   async update(path: string, version: Version): Promise<Result<void, FileOperationError>> {
 *     // Implementation
 *   }
 * }
 * ```
 */

import type { ParserConfig } from '../../parsers/FileParser.js';
import { configParser } from '../../parsers/FileParser.js';
import type { UpdaterConfig } from '../../parsers/FileUpdater.js';
import { configUpdater } from '../../parsers/FileUpdater.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';

/**
 * Abstract base class for workspace adapters
 *
 * Provides common functionality for detecting and updating version information
 * in workspace configuration files.
 */
export abstract class BaseWorkspaceAdapter {
  /**
   * Type of workspace this adapter handles
   *
   * @example 'node', 'python', 'deno', 'go', 'rust', 'zig', 'text'
   */
  abstract readonly type: WorkspaceType;

  /**
   * List of configuration files this adapter can parse
   *
   * @example ['package.json', 'jsr.json']
   */
  abstract readonly supportedFiles: ReadonlyArray<string>;

  /**
   * Detect project information from workspace
   *
   * Implementations should:
   * 1. Check for supported files in the workspace
   * 2. Parse the first found file to extract name and version
   * 3. Validate version format
   * 4. Return ProjectInfo or error
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Result with ProjectInfo or WorkspaceDetectionError
   *
   * @example
   * ```typescript
   * const result = await adapter.detect('.');
   * if (isOk(result)) {
   *   console.log(result.value.name);
   *   console.log(result.value.version);
   * }
   * ```
   */
  abstract detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;

  /**
   * Update version in workspace configuration
   *
   * Implementations should:
   * 1. Find the configuration file to update
   * 2. Update version field while preserving other content
   * 3. Write back to file
   * 4. Return success or error
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New version to set
   * @returns Result indicating success or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('.', toVersion('1.2.0'));
   * if (isOk(result)) {
   *   console.log('Version updated successfully');
   * }
   * ```
   */
  abstract update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;

  /**
   * Parse a configuration file using the generic file parser
   *
   * Protected helper method for subclasses to parse files consistently.
   *
   * @param filePath - Absolute path to the configuration file
   * @param config - Parser configuration (format, paths, patterns)
   * @returns Result with ProjectInfo or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await this.parseFile(
   *   join(workspacePath, 'package.json'),
   *   { format: 'json', versionPath: 'version', namePath: 'name' }
   * );
   * ```
   */
  protected async parseFile(filePath: string, config: ParserConfig): Promise<Result<ProjectInfo, FileOperationError>> {
    return configParser(filePath, config);
  }

  /**
   * Update a configuration file using the generic file updater
   *
   * Protected helper method for subclasses to update files consistently.
   *
   * @param filePath - Absolute path to the configuration file
   * @param newVersion - New version to write
   * @param config - Updater configuration (format, paths, patterns)
   * @returns Result indicating success or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await this.updateFile(
   *   join(workspacePath, 'package.json'),
   *   toVersion('1.2.0'),
   *   { format: 'json', versionPath: 'version' }
   * );
   * ```
   */
  protected async updateFile(
    filePath: string,
    newVersion: Version,
    config: UpdaterConfig,
  ): Promise<Result<void, FileOperationError>> {
    return configUpdater(filePath, newVersion, config);
  }
}
