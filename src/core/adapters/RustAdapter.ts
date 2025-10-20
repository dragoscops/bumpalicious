/**
 * Rust Workspace Adapter
 *
 * Adapter for Rust projects using Cargo.toml.
 * Supports standard Cargo package configuration with semantic versioning.
 *
 * Usage:
 * ```typescript
 * const adapter = new RustAdapter();
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
 * Rust workspace adapter
 *
 * Handles version detection and updates for Rust projects.
 * Parses and updates Cargo.toml [package] section.
 */
export class RustAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'rust';
  readonly supportedFiles = ['Cargo.toml'] as const;

  /**
   * Detect project information from Rust workspace
   *
   * Parses Cargo.toml [package] section to extract name and version.
   *
   * @param workspacePath - Path to the workspace directory
   * @returns Result with ProjectInfo or WorkspaceDetectionError
   *
   * @example
   * ```typescript
   * const result = await adapter.detect('./my-rust-crate');
   * if (isOk(result)) {
   *   console.log(result.value.name);    // "my-rust-crate"
   *   console.log(result.value.version); // "0.1.0"
   * }
   * ```
   */
  async detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
    const filePath = join(workspacePath, 'Cargo.toml');

    try {
      await access(filePath);
    } catch {
      return err(new WDError(workspacePath, 'No Cargo.toml file found. This does not appear to be a Rust workspace.'));
    }

    // Parse Cargo.toml using TOML parser
    const parseResult = await this.parseFile(filePath, {
      format: 'toml',
      versionPath: 'package.version',
      namePath: 'package.name',
    });

    if (!isOk(parseResult)) {
      // Convert FileOperationError to WorkspaceDetectionError
      return err(new WDError(workspacePath, 'Failed to parse Cargo.toml', parseResult.error));
    }

    return ok(parseResult.value);
  }

  /**
   * Update version in Rust workspace
   *
   * Updates the version field in Cargo.toml [package] section.
   * Preserves TOML formatting.
   *
   * @param workspacePath - Path to the workspace directory
   * @param newVersion - New semantic version to set
   * @returns Result with void or FileOperationError
   *
   * @example
   * ```typescript
   * const result = await adapter.update('./my-rust-crate', toVersion('1.0.0'));
   * if (!isOk(result)) {
   *   console.error(result.error);
   * }
   * ```
   */
  async update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>> {
    const filePath = join(workspacePath, 'Cargo.toml');

    try {
      await access(filePath);
    } catch {
      return err(new FOError(filePath, 'update', 'Cargo.toml not found. Cannot update version in non-existent file.'));
    }

    // Update Cargo.toml using TOML updater
    const updateResult = await this.updateFile(filePath, newVersion, {
      format: 'toml',
      versionPath: 'package.version',
    });

    return updateResult;
  }
}
