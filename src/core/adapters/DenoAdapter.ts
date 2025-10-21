/**
 * Deno Workspace Adapter
 *
 * Adapter for Deno projects using deno.json, deno.jsonc, and jsr.json.
 * Supports JSON with comments (JSONC) for Deno configuration files.
 *
 * Usage:
 * ```typescript
 * const adapter = new DenoAdapter();
 * const result = await adapter.detect('.');
 * if (isOk(result)) {
 *   console.log(result.value.name);    // Package name
 *   console.log(result.value.version); // Current version
 * }
 *
 * await adapter.update('.', toVersion('1.2.0'));
 * ```
 */

import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import { ok, err, isOk } from '../../types/result.js';
import { isVersion } from '../../types/version.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
import { WorkspaceDetectionError as WDError, FileOperationError as FOError } from '../../utils/errors.js';

/**
 * Configuration for a Deno file format
 */
interface DenoFileConfig {
  readonly filename: string;
  readonly isJsonc: boolean;
}

/**
 * Deno workspace adapter
 *
 * Handles version detection and updates for Deno projects.
 * Supports deno.json, deno.jsonc (JSON with comments), and jsr.json.
 */
export class DenoAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'deno';
  readonly supportedFiles = ['deno.jsonc', 'deno.json', 'jsr.json'] as const;

  /**
   * File configurations in priority order
   */
  private readonly FILE_CONFIGS: ReadonlyArray<DenoFileConfig> = [
    { filename: 'deno.jsonc', isJsonc: true },
    { filename: 'deno.json', isJsonc: false },
    { filename: 'jsr.json', isJsonc: false },
  ];

  /**
   * Lazy-loaded JSONC parser
   */
  private jsoncParser: { parse: (content: string) => unknown } | null = null;

  /**
   * Get JSONC parser (lazy load)
   */
  private async getJsoncParser(): Promise<{ parse: (content: string) => unknown }> {
    if (!this.jsoncParser) {
      const module = await import('tiny-jsonc');
      this.jsoncParser = module.default as { parse: (content: string) => unknown };
    }
    return this.jsoncParser;
  }

  /**
   * Detect project information from Deno workspace
   *
   * Searches for deno.jsonc, deno.json, or jsr.json in priority order.
   * Extracts name and version from the first found file.
   * Handles JSON with comments (JSONC) for deno.jsonc files.
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Result with ProjectInfo or WorkspaceDetectionError
   *
   * @example
   * ```typescript
   * const result = await adapter.detect('./packages/my-deno-lib');
   * if (isOk(result)) {
   *   console.log(result.value.name);    // "my-deno-lib"
   *   console.log(result.value.version); // "1.0.0"
   * }
   * ```
   */
  async detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
    try {
      // Try each config file in priority order
      for (const config of this.FILE_CONFIGS) {
        const filePath = join(workspacePath, config.filename);

        try {
          await access(filePath);
        } catch {
          // File doesn't exist, try next
          continue;
        }

        // Parse the file
        const parseResult = await this.parseDenoFile(filePath, config.isJsonc);

        if (isOk(parseResult)) {
          return ok(parseResult.value);
        }

        // If parse failed, continue to next file
        continue;
      }

      // No valid config file found
      return err(
        new WDError(
          workspacePath,
          `No Deno configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
        ),
      );
    } catch (error) {
      return err(new WDError(workspacePath, 'Failed to detect Deno workspace', error));
    }
  }

  /**
   * Update version in Deno workspace configuration files
   *
   * Updates all found configuration files (deno.jsonc, deno.json, jsr.json if they exist).
   * This ensures version consistency across Deno runtime and JSR registry.
   * Preserves JSONC comments in deno.jsonc files.
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New version to set
   * @returns Result indicating success or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('.', toVersion('1.2.0'));
   * if (isOk(result)) {
   *   console.log('Version updated in all Deno config files');
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
            `No Deno configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
          ),
        );
      }

      // Update all existing files
      for (const config of existingFiles) {
        const filePath = join(workspacePath, config.filename);
        const updateResult = await this.updateDenoFile(filePath, newVersion, config.isJsonc);

        if (!isOk(updateResult)) {
          return err(new FOError(workspacePath, 'update', `Failed to update ${config.filename}`, updateResult.error));
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(new FOError(workspacePath, 'update', 'Failed to update Deno workspace', error));
    }
  }

  /**
   * Parse a Deno configuration file
   *
   * @param filePath - Path to the config file
   * @param isJsonc - Whether the file is JSONC (JSON with comments)
   * @returns Result with ProjectInfo or FileOperationError
   */
  private async parseDenoFile(filePath: string, isJsonc: boolean): Promise<Result<ProjectInfo, FileOperationError>> {
    try {
      const content = await readFile(filePath, 'utf-8');

      // Parse JSON or JSONC
      let data: unknown;
      try {
        if (isJsonc) {
          const JSONC = await this.getJsoncParser();
          data = JSONC.parse(content);
        } else {
          data = JSON.parse(content);
        }
      } catch (error) {
        return err(new FOError(filePath, 'read', `Malformed ${isJsonc ? 'JSONC' : 'JSON'}`, error));
      }

      // Validate data is an object
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return err(new FOError(filePath, 'read', 'Config file must be a JSON object'));
      }

      const config = data as Record<string, unknown>;

      // Extract name and version
      const name = config['name'];
      const version = config['version'];

      if (typeof name !== 'string' || name.trim() === '') {
        return err(new FOError(filePath, 'read', 'Missing or invalid "name" field in config'));
      }

      if (typeof version !== 'string' || version.trim() === '') {
        return err(new FOError(filePath, 'read', 'Missing or invalid "version" field in config'));
      }

      // Validate version format
      if (!isVersion(version)) {
        return err(new FOError(filePath, 'read', `Invalid version format: ${version}`));
      }

      return ok({ name, version: version as Version });
    } catch (error) {
      return err(new FOError(filePath, 'read', 'Failed to parse Deno config file', error));
    }
  }

  /**
   * Update version in a Deno configuration file
   *
   * @param filePath - Path to the config file
   * @param newVersion - New version to set
   * @param isJsonc - Whether the file is JSONC (JSON with comments)
   * @returns Result indicating success or FileOperationError
   */
  private async updateDenoFile(
    filePath: string,
    newVersion: Version,
    isJsonc: boolean,
  ): Promise<Result<void, FileOperationError>> {
    try {
      const content = await readFile(filePath, 'utf-8');

      // Parse JSON or JSONC
      let data: unknown;
      try {
        if (isJsonc) {
          const JSONC = await this.getJsoncParser();
          data = JSONC.parse(content);
        } else {
          data = JSON.parse(content);
        }
      } catch (error) {
        return err(new FOError(filePath, 'update', `Malformed ${isJsonc ? 'JSONC' : 'JSON'}`, error));
      }

      // Validate data is an object
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return err(new FOError(filePath, 'update', 'Config file must be a JSON object'));
      }

      const config = data as Record<string, unknown>;

      // Validate existing version
      const currentVersion = config['version'];
      if (typeof currentVersion !== 'string' || !isVersion(currentVersion)) {
        return err(new FOError(filePath, 'update', 'Missing or invalid "version" field in config'));
      }

      // Update version
      config['version'] = newVersion;

      // Serialize back to JSON
      const updatedContent = JSON.stringify(config, null, 2) + '\n';
      await writeFile(filePath, updatedContent, 'utf-8');

      return ok(undefined);
    } catch (error) {
      return err(new FOError(filePath, 'update', 'Failed to update Deno config file', error));
    }
  }

  /**
   * Find all existing configuration files
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Array of configuration file configs that exist
   */
  private async findAllConfigFiles(workspacePath: string): Promise<DenoFileConfig[]> {
    const existingFiles: DenoFileConfig[] = [];

    for (const config of this.FILE_CONFIGS) {
      const filePath = join(workspacePath, config.filename);
      try {
        await access(filePath);
        existingFiles.push(config);
      } catch {
        // File doesn't exist, skip
        continue;
      }
    }

    return existingFiles;
  }
}
