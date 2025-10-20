/**
 * Python Workspace Adapter
 *
 * Adapter for Python projects using various configuration formats.
 * Supports pyproject.toml, poetry.toml, setup.py, setup.cfg, and __init__.py.
 *
 * Detection Priority:
 * 1. pyproject.toml (PEP 518/621)
 * 2. poetry.toml (Poetry dependency management)
 * 3. setup.py (Traditional setuptools)
 * 4. setup.cfg (INI-style setuptools)
 * 5. __init__.py (Package initialization)
 *
 * Update Strategy:
 * Updates ALL found configuration files to maintain version consistency
 * across different Python tooling formats.
 *
 * Usage:
 * ```typescript
 * const adapter = new PythonAdapter();
 * const result = await adapter.detect('./packages/my-lib');
 * if (isOk(result)) {
 *   console.log(result.value.name);    // Package name
 *   console.log(result.value.version); // Current version
 * }
 *
 * await adapter.update('./packages/my-lib', toVersion('1.2.0'));
 * ```
 */

import { access, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { ProjectInfo, Version, WorkspaceType } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import { err, isOk, ok } from '../../types/result.js';
import { isVersion } from '../../types/version.js';
import type { FileOperationError, WorkspaceDetectionError } from '../../utils/errors.js';
import { FileOperationError as FOError, WorkspaceDetectionError as WDError } from '../../utils/errors.js';

/**
 * Configuration for a Python file format
 * Defines how to detect and parse each supported file type
 */
interface PythonFileConfig {
  /** Filename to detect */
  readonly filename: string;
  /** Parser format (toml for TOML files, regex for Python source files) */
  readonly format: 'toml' | 'regex';
  /** Dot-separated path to version field (for TOML files) */
  readonly versionPath?: string;
  /** Dot-separated path to name field (for TOML files) */
  readonly namePath?: string;
  /** Regex pattern to extract version (for Python source files) */
  readonly versionPattern?: RegExp;
  /** Regex pattern to extract name (for Python source files) */
  readonly namePattern?: RegExp;
  /** Replacement template for version updates (use $VERSION placeholder) */
  readonly versionReplacement?: string;
}

/**
 * Python workspace adapter
 *
 * Handles version detection and updates for Python projects.
 * Supports multiple configuration formats used in the Python ecosystem.
 */
export class PythonAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'python';

  readonly supportedFiles = ['pyproject.toml', 'poetry.toml', 'setup.py', 'setup.cfg', '__init__.py'] as const;

  /**
   * Python file format configurations in priority order.
   * First found file will be used for detection.
   */
  private static readonly FILE_CONFIGS: ReadonlyArray<PythonFileConfig> = [
    // pyproject.toml - Modern Python packaging (PEP 518/621)
    {
      filename: 'pyproject.toml',
      format: 'toml',
      versionPath: 'project.version',
      namePath: 'project.name',
    },
    // poetry.toml - Poetry dependency management
    {
      filename: 'poetry.toml',
      format: 'toml',
      versionPath: 'tool.poetry.version',
      namePath: 'tool.poetry.name',
    },
    // setup.py - Traditional setuptools with Python code
    {
      filename: 'setup.py',
      format: 'regex',
      versionPattern: /version\s*=\s*["']([^"']+)["']/m,
      namePattern: /name\s*=\s*["']([^"']+)["']/m,
      versionReplacement: 'version="$VERSION"',
    },
    // setup.cfg - INI-style setuptools configuration
    {
      filename: 'setup.cfg',
      format: 'regex',
      versionPattern: /version\s*=\s*([^\s]+)/m,
      namePattern: /name\s*=\s*([^\s]+)/m,
      versionReplacement: 'version = $VERSION',
    },
    // __init__.py - Package initialization with __version__
    {
      filename: '__init__.py',
      format: 'regex',
      versionPattern: /__version__\s*=\s*["']([^"']+)["']/m,
      namePattern: /__name__\s*=\s*["']([^"']+)["']/m,
      versionReplacement: '__version__ = "$VERSION"',
    },
  ];

  /**
   * Detect project information from Python workspace
   *
   * Searches for Python configuration files in priority order.
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
      // Try each file format in priority order
      for (const config of PythonAdapter.FILE_CONFIGS) {
        const filePath = join(workspacePath, config.filename);

        // Check if file exists
        try {
          await access(filePath);
        } catch {
          // File doesn't exist, try next
          continue;
        }

        // Parse based on format type
        let parseResult: Result<ProjectInfo, FileOperationError>;

        if (config.format === 'toml' && config.versionPath && config.namePath) {
          parseResult = await this.parseFile(filePath, {
            format: 'toml',
            versionPath: config.versionPath,
            namePath: config.namePath,
          });
        } else if (config.format === 'regex' && config.versionPattern) {
          parseResult = await this.parseFile(filePath, {
            format: 'regex',
            versionPattern: config.versionPattern,
            namePattern: config.namePattern,
          });

          // For __init__.py, name is optional - fallback to directory name
          if (!isOk(parseResult) && config.filename === '__init__.py') {
            // Try parsing again without name requirement by using a custom parser
            // that only requires version
            try {
              const content = await readFile(filePath, 'utf-8');
              const versionMatch = content.match(config.versionPattern);
              if (versionMatch && versionMatch[1] && isVersion(versionMatch[1])) {
                return ok({
                  name: basename(workspacePath),
                  version: versionMatch[1] as Version,
                });
              }
            } catch {
              // Failed to parse, continue to next file
              continue;
            }
          }
        } else {
          // Invalid config, skip
          continue;
        }

        if (isOk(parseResult)) {
          // If name is not found (optional for some files), use directory name
          return ok({
            name: parseResult.value.name || basename(workspacePath),
            version: parseResult.value.version,
          });
        }

        // Parse failed, try next file
      }

      // No valid file found
      return err(
        new WDError(
          workspacePath,
          `No valid Python configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
        ),
      );
    } catch (error) {
      return err(new WDError(workspacePath, 'Failed to detect Python workspace', error));
    }
  }

  /**
   * Update version in Python workspace configuration files
   *
   * Updates ALL found configuration files to maintain version consistency.
   * This is important because Python projects may have multiple config formats
   * (e.g., both pyproject.toml and setup.py).
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New version to set
   * @returns Result indicating success or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('.', toVersion('1.2.0'));
   * if (isOk(result)) {
   *   console.log('Version updated in all Python configuration files');
   * }
   * ```
   */
  async update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>> {
    try {
      // Find all existing config files
      const existingConfigs = await this.findAllConfigFiles(workspacePath);

      if (existingConfigs.length === 0) {
        return err(
          new FOError(
            workspacePath,
            'update',
            `No Python configuration file found. Expected one of: ${this.supportedFiles.join(', ')}`,
          ),
        );
      }

      // Update all existing files
      for (const config of existingConfigs) {
        const filePath = join(workspacePath, config.filename);
        let updateResult: Result<void, FileOperationError>;

        if (config.format === 'toml' && config.versionPath) {
          updateResult = await this.updateFile(filePath, newVersion, {
            format: 'toml',
            versionPath: config.versionPath,
          });
        } else if (config.format === 'regex' && config.versionPattern && config.versionReplacement) {
          updateResult = await this.updateFile(filePath, newVersion, {
            format: 'regex',
            versionPattern: config.versionPattern,
            versionReplacement: config.versionReplacement,
          });
        } else {
          // Invalid config, skip
          continue;
        }

        if (!isOk(updateResult)) {
          return err(new FOError(workspacePath, 'update', `Failed to update ${config.filename}`, updateResult.error));
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(new FOError(workspacePath, 'update', 'Failed to update Python workspace', error));
    }
  }

  /**
   * Find all existing Python configuration files in the workspace
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Array of configurations for files that exist
   */
  private async findAllConfigFiles(workspacePath: string): Promise<PythonFileConfig[]> {
    const existingConfigs: PythonFileConfig[] = [];

    for (const config of PythonAdapter.FILE_CONFIGS) {
      const filePath = join(workspacePath, config.filename);
      try {
        await access(filePath);
        existingConfigs.push(config);
      } catch {
        // File doesn't exist, skip
        continue;
      }
    }

    return existingConfigs;
  }
}
