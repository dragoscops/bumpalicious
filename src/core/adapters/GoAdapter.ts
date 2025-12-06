/**
 * Go Workspace Adapter
 *
 * Adapter for Go projects using go.mod, version.go, and version.txt files.
 * Supports Go module version comments and Go constant/variable declarations.
 *
 * Usage:
 * ```typescript
 * const adapter = new GoAdapter();
 * const result = await adapter.detect('.');
 * if (isOk(result)) {
 *   console.log(result.value.name);    // Module name
 *   console.log(result.value.version); // Current version
 * }
 *
 * await adapter.update('.', toVersion('1.2.0'));
 * ```
 */

import { access, readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { ProjectInfo, Version, WorkspaceType } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import { err, isOk, ok } from '../../types/result.js';
import { isVersion } from '../../types/version.js';
import type { FileOperationError, WorkspaceDetectionError } from '../../utils/errors.js';
import { FileOperationError as FOError, WorkspaceDetectionError as WDError } from '../../utils/errors.js';

/**
 * Configuration for a Go file format
 */
interface GoFileConfig {
  readonly filename: string;
  readonly versionPattern: RegExp;
  readonly versionReplacement: string;
  readonly namePattern?: RegExp;
  readonly defaultName?: string;
}

/**
 * Go workspace adapter
 *
 * Handles version detection and updates for Go projects.
 * Supports go.mod (with version comment), version.go, and version.txt.
 */
export class GoAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'go';
  readonly supportedFiles = ['go.mod', 'version.go', 'VERSION.txt', 'version.txt'] as const;

  /**
   * File configurations in priority order
   */
  private readonly FILE_CONFIGS: ReadonlyArray<GoFileConfig> = [
    {
      filename: 'go.mod',
      versionPattern: /\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m,
      versionReplacement: '// version: $VERSION',
      namePattern: /module\s+([\w\d./@:-]+)/m,
    },
    {
      filename: 'version.go',
      versionPattern: /(?:const|var)\s+[vV]ersion\s*=\s*"([^"]*)"/m,
      versionReplacement: 'const Version = "$VERSION"',
      namePattern: /package\s+(\w+)/m,
    },
    {
      filename: 'VERSION.txt',
      // Support optional 'v' prefix (e.g., v1.0.0 or 1.0.0)
      versionPattern: /^v?(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)$/m,
      versionReplacement: '$VERSION',
      defaultName: '', // No name in plain text file
    },
    {
      filename: 'version.txt',
      // Support optional 'v' prefix (e.g., v1.0.0 or 1.0.0)
      versionPattern: /^v?(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)$/m,
      versionReplacement: '$VERSION',
      defaultName: '', // No name in plain text file
    },
  ];

  /**
   * Detect project information from Go workspace
   *
   * Searches for go.mod, version.go, or version.txt in priority order.
   * Extracts name and version from the first found file.
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Result with ProjectInfo or WorkspaceDetectionError
   *
   * @example
   * ```typescript
   * const result = await adapter.detect('./my-go-project');
   * if (isOk(result)) {
   *   console.log(result.value.name);    // "github.com/user/project"
   *   console.log(result.value.version); // "1.0.0"
   * }
   * ```
   */
  async detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
    try {
      const debug = process.env.ACTIONS_STEP_DEBUG === 'true' || process.env.RUNNER_DEBUG === '1';
      if (debug) {
        console.log(`[GoAdapter] Detecting in workspace: ${workspacePath}`);
        try {
          const files = await readdir(workspacePath);
          console.log(`[GoAdapter] Directory contents: ${files.join(', ')}`);
        } catch (e) {
          console.log(`[GoAdapter] Failed to list directory: ${e}`);
        }
      }

      // Try each config file in priority order
      for (const config of this.FILE_CONFIGS) {
        const filePath = join(workspacePath, config.filename);

        if (debug) {
          console.log(`[GoAdapter] Checking file: ${filePath}`);
        }

        try {
          await access(filePath);
          if (debug) {
            console.log(`[GoAdapter] File exists: ${config.filename}`);
          }
        } catch {
          // File doesn't exist, try next
          if (debug) {
            console.log(`[GoAdapter] File not found: ${config.filename}`);
          }
          continue;
        }

        // Parse the file
        // Special handling for version.txt and VERSION.txt (no name pattern)
        if (config.filename === 'version.txt' || config.filename === 'VERSION.txt') {
          try {
            const content = await readFile(filePath, 'utf-8');
            if (debug) {
              console.log(`[GoAdapter] ${config.filename} content: "${content.trim()}"`);
            }
            const versionMatch = content.match(config.versionPattern);
            if (debug) {
              console.log(`[GoAdapter] ${config.filename} match: ${JSON.stringify(versionMatch)}`);
            }
            if (versionMatch && versionMatch[1] && isVersion(versionMatch[1])) {
              if (debug) {
                console.log(`[GoAdapter] Detected version from ${config.filename}: ${versionMatch[1]}`);
              }
              return ok({ name: basename(workspacePath), version: versionMatch[1] as Version });
            }
            if (debug) {
              console.log(`[GoAdapter] ${config.filename} parse failed, continuing...`);
            }
            continue; // Try next file if parse failed
          } catch (readError) {
            if (debug) {
              console.log(`[GoAdapter] Error reading version.txt: ${readError}`);
            }
            continue;
          }
        }

        // Standard parsing for go.mod and version.go
        if (debug) {
          console.log(`[GoAdapter] Parsing ${config.filename} with regex`);
        }
        const parseResult = await this.parseFile(filePath, {
          format: 'regex',
          versionPattern: config.versionPattern,
          namePattern: config.namePattern,
        });

        if (isOk(parseResult)) {
          if (debug) {
            console.log(`[GoAdapter] Detected from ${config.filename}: ${JSON.stringify(parseResult.value)}`);
          }
          return ok(parseResult.value);
        }

        // If parse failed, continue to next file
        if (debug) {
          console.log(`[GoAdapter] Parse failed for ${config.filename}, trying next...`);
        }
        continue;
      }

      // No valid config file found
      return err(
        new WDError(
          workspacePath,
          `No Go configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
        ),
      );
    } catch (error) {
      return err(new WDError(workspacePath, 'Failed to detect Go workspace', error));
    }
  }

  /**
   * Update version in Go workspace configuration files
   *
   * Updates all found configuration files (go.mod, version.go, version.txt if they exist).
   * This ensures version consistency across different version declaration methods.
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New version to set
   * @returns Result indicating success or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('.', toVersion('1.2.0'));
   * if (isOk(result)) {
   *   console.log('Version updated in all Go config files');
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
            `No Go configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
          ),
        );
      }

      // Update all existing files
      for (const config of existingFiles) {
        const filePath = join(workspacePath, config.filename);
        const updateResult = await this.updateFile(filePath, newVersion, {
          format: 'regex',
          versionPattern: config.versionPattern,
          versionReplacement: config.versionReplacement,
        });

        if (!isOk(updateResult)) {
          return err(new FOError(workspacePath, 'update', `Failed to update ${config.filename}`, updateResult.error));
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(new FOError(workspacePath, 'update', 'Failed to update Go workspace', error));
    }
  }

  /**
   * Find all existing configuration files
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Array of configuration file configs that exist
   */
  private async findAllConfigFiles(workspacePath: string): Promise<GoFileConfig[]> {
    const existingFiles: GoFileConfig[] = [];
    const foundFilenames = new Set<string>();

    for (const config of this.FILE_CONFIGS) {
      const filePath = join(workspacePath, config.filename);
      try {
        await access(filePath);
        // Deduplicate by lowercase filename to handle case-insensitive filesystems
        const normalizedName = config.filename.toLowerCase();
        if (!foundFilenames.has(normalizedName)) {
          foundFilenames.add(normalizedName);
          existingFiles.push(config);
        }
      } catch {
        // File doesn't exist, skip
        continue;
      }
    }

    return existingFiles;
  }
}
