/**
 * Zig Workspace Adapter
 *
 * Adapter for Zig projects using build.zig and build.zig.zon.
 * Supports Zig's package management and build configuration with semantic versioning.
 *
 * Usage:
 * ```typescript
 * const adapter = new ZigAdapter();
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
 * Configuration for a Zig file format
 */
interface ZigFileConfig {
  /** Filename (build.zig or build.zig.zon) */
  filename: string;
  /** Regex pattern to extract version */
  versionPattern: RegExp;
  /** Regex pattern to extract name */
  namePattern: RegExp;
  /** Template for version replacement (uses $VERSION placeholder) */
  versionReplacement: string;
}

/**
 * Zig workspace adapter
 *
 * Handles version detection and updates for Zig projects.
 * Supports both build.zig.zon (package manager format) and build.zig (build script format).
 * Priority: build.zig.zon > build.zig (per Zig ecosystem conventions).
 */
export class ZigAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'zig';
  readonly supportedFiles = ['build.zig.zon', 'build.zig'] as const;

  /**
   * File configurations in priority order
   * build.zig.zon is checked first (Zig package manager standard)
   */
  private readonly FILE_CONFIGS: readonly ZigFileConfig[] = [
    {
      filename: 'build.zig.zon',
      versionPattern: /\.version\s*=\s*"([^"]+)"/m,
      namePattern: /\.name\s*=\s*"([^"]+)"/m,
      versionReplacement: '.version = "$VERSION"',
    },
    {
      filename: 'build.zig',
      versionPattern: /const\s+VERSION\s*=\s*"([^"]+)"/i,
      namePattern: /const\s+NAME\s*=\s*"([^"]+)"/i,
      versionReplacement: 'const VERSION = "$VERSION"',
    },
  ];

  /**
   * Detect project information from Zig workspace
   *
   * Searches for build.zig.zon or build.zig in priority order.
   * Extracts name and version using regex patterns.
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Result with ProjectInfo or WorkspaceDetectionError
   *
   * @example
   * ```typescript
   * const result = await adapter.detect('./my-zig-project');
   * if (isOk(result)) {
   *   console.log(result.value.name);    // "my-zig-project"
   *   console.log(result.value.version); // "0.1.0"
   * }
   * ```
   */
  async detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
    // Try each config file in priority order
    for (const config of this.FILE_CONFIGS) {
      const filePath = join(workspacePath, config.filename);

      try {
        await access(filePath);
      } catch {
        // File doesn't exist, try next
        continue;
      }

      // Parse using regex
      const parseResult = await this.parseFile(filePath, {
        format: 'regex',
        versionPattern: config.versionPattern,
        namePattern: config.namePattern,
      });

      if (isOk(parseResult)) {
        return ok(parseResult.value);
      }

      // If parsing failed, try next file
      continue;
    }

    // No valid config file found
    return err(
      new WDError(workspacePath, `No Zig configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`),
    );
  }

  /**
   * Update version in Zig workspace
   *
   * Updates version in ALL existing Zig configuration files.
   * This ensures version consistency across build.zig.zon and build.zig.
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New semantic version to set
   * @returns Result with void or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('./my-zig-project', toVersion('1.0.0'));
   * if (!isOk(result)) {
   *   console.error(result.error);
   * }
   * ```
   */
  async update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>> {
    const filesToUpdate: string[] = [];

    // Find all existing config files
    for (const config of this.FILE_CONFIGS) {
      const filePath = join(workspacePath, config.filename);

      try {
        await access(filePath);
        filesToUpdate.push(config.filename);
      } catch {
        // File doesn't exist, skip
        continue;
      }
    }

    if (filesToUpdate.length === 0) {
      return err(
        new FOError(
          workspacePath,
          'update',
          'No Zig configuration files found. Cannot update version in non-existent files.',
        ),
      );
    }

    // Update all found files
    for (const filename of filesToUpdate) {
      const config = this.FILE_CONFIGS.find((c) => c.filename === filename)!;
      const filePath = join(workspacePath, filename);

      const updateResult = await this.updateFile(filePath, newVersion, {
        format: 'regex',
        versionPattern: config.versionPattern,
        versionReplacement: config.versionReplacement,
      });

      if (!isOk(updateResult)) {
        return updateResult;
      }
    }

    return ok(undefined);
  }
}
