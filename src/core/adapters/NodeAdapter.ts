/**
 * Node.js Workspace Adapter
 *
 * Adapter for Node.js projects using package.json and jsr.json.
 * Supports standard npm/yarn/pnpm projects and JSR (JavaScript Registry) projects.
 *
 * Usage:
 * ```typescript
 * const adapter = new NodeAdapter();
 * const result = await adapter.detect('.');
 * if (isOk(result)) {
 *   console.log(result.value.name);    // Package name
 *   console.log(result.value.version); // Current version
 * }
 *
 * await adapter.update('.', toVersion('1.2.0'));
 * ```
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import { ok, err, isOk } from '../../types/result.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
import { WorkspaceDetectionError as WDError, FileOperationError as FOError } from '../../utils/errors.js';

/**
 * Node.js workspace adapter
 *
 * Handles version detection and updates for Node.js projects.
 * Supports package.json (npm/yarn/pnpm) and jsr.json (JSR registry).
 */
export class NodeAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'node';
  readonly supportedFiles = ['package.json', 'jsr.json'] as const;

  /**
   * Detect project information from Node.js workspace
   *
   * Searches for package.json or jsr.json in priority order.
   * Extracts name and version from the first found file.
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Result with ProjectInfo or WorkspaceDetectionError
   *
   * @example
   * ```typescript
   * const result = await adapter.detect('./packages/my-lib');
   * if (isOk(result)) {
   *   console.log(result.value.name);    // "my-lib"
   *   console.log(result.value.version); // "1.0.0"
   * }
   * ```
   */
  async detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
    try {
      // Try to find first available config file
      const configFile = await this.findConfigFile(workspacePath);

      if (!configFile) {
        return err(
          new WDError(
            workspacePath,
            `No Node.js configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
          ),
        );
      }

      // Parse the configuration file
      const filePath = join(workspacePath, configFile);
      const parseResult = await this.parseFile(filePath, {
        format: 'json',
        versionPath: 'version',
        namePath: 'name',
      });

      if (!isOk(parseResult)) {
        // Convert FileOperationError to WorkspaceDetectionError
        return err(new WDError(workspacePath, `Failed to parse ${configFile}`, parseResult.error));
      }

      return ok(parseResult.value);
    } catch (error) {
      return err(new WDError(workspacePath, 'Failed to detect Node.js workspace', error));
    }
  }

  /**
   * Update version in Node.js workspace configuration files
   *
   * Updates all found configuration files (package.json and jsr.json if both exist).
   * This ensures version consistency across npm and JSR registries.
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New version to set
   * @returns Result indicating success or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('.', toVersion('1.2.0'));
   * if (isOk(result)) {
   *   console.log('Version updated in package.json and/or jsr.json');
   * }
   * ```
   */
  async update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>> {
    try {
      // Find all existing config files
      const existingFiles = await this.findAllConfigFiles(workspacePath);

      if (existingFiles.length === 0) {
        return err(
          new FOError(
            workspacePath,
            'update',
            `No Node.js configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
          ),
        );
      }

      // Update all existing files
      for (const configFile of existingFiles) {
        const filePath = join(workspacePath, configFile);
        const updateResult = await this.updateFile(filePath, newVersion, {
          format: 'json',
          versionPath: 'version',
        });

        if (!isOk(updateResult)) {
          return err(new FOError(workspacePath, 'update', `Failed to update ${configFile}`, updateResult.error));
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(new FOError(workspacePath, 'update', 'Failed to update Node.js workspace', error));
    }
  }

  /**
   * Find the first existing configuration file
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Configuration filename or null if none found
   */
  private async findConfigFile(workspacePath: string): Promise<string | null> {
    for (const fileName of this.supportedFiles) {
      const filePath = join(workspacePath, fileName);
      try {
        await access(filePath);
        return fileName;
      } catch {
        // File doesn't exist, continue
        continue;
      }
    }
    return null;
  }

  /**
   * Find all existing configuration files
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Array of configuration filenames that exist
   */
  private async findAllConfigFiles(workspacePath: string): Promise<string[]> {
    const existingFiles: string[] = [];

    for (const fileName of this.supportedFiles) {
      const filePath = join(workspacePath, fileName);
      try {
        await access(filePath);
        existingFiles.push(fileName);
      } catch {
        // File doesn't exist, skip
        continue;
      }
    }

    return existingFiles;
  }
}
