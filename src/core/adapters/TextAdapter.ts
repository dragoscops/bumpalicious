/**
 * Text Workspace Adapter
 *
 * Simple adapter for text-based version files.
 * Supports: version, version.txt, VERSION, VERSION.txt
 *
 * Usage:
 * ```typescript
 * const result = await detectVersion('.');
 * if (isOk(result)) {
 *   console.log(result.value.version);
 * }
 *
 * await updateVersion('.', toVersion('1.2.0'));
 * ```
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectInfo, WorkspaceType, Version } from '../../types/index.js';
import { ok, err, type Result } from '../../types/result.js';
import { isVersion, toVersion } from '../../types/version.js';
import { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';

/**
 * Workspace type for text adapter
 */
export const WORKSPACE_TYPE: WorkspaceType = 'text';

/**
 * Supported version file names (case-sensitive)
 */
export const SUPPORTED_FILES = ['VERSION', 'VERSION.txt', 'version', 'version.txt'] as const;

/**
 * Find the first existing version file in the workspace
 *
 * @param workspacePath - Path to the workspace directory
 * @returns Path to the version file, or null if not found
 */
async function findVersionFile(workspacePath: string): Promise<string | null> {
  for (const fileName of SUPPORTED_FILES) {
    const filePath = join(workspacePath, fileName);
    try {
      await access(filePath);
      return filePath;
    } catch {
      // File doesn't exist, continue to next
      continue;
    }
  }
  return null;
}

/**
 * Detect project information from text version file
 *
 * @param workspacePath - Path to the workspace directory
 * @returns Result with ProjectInfo or error
 *
 * @example
 * ```typescript
 * const result = await detectVersion('.');
 * if (isOk(result)) {
 *   console.log(result.value.version); // "1.0.0"
 *   console.log(result.value.name);    // undefined (text files don't have name)
 * }
 * ```
 */
export async function detectVersion(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
  try {
    const versionFile = await findVersionFile(workspacePath);

    if (!versionFile) {
      return err(
        new WorkspaceDetectionError(
          workspacePath,
          `No version file found. Supported files: ${SUPPORTED_FILES.join(', ')}`,
        ),
      );
    }

    const content = await readFile(versionFile, 'utf-8');
    const versionString = content.trim();

    if (!versionString) {
      return err(new WorkspaceDetectionError(workspacePath, `Version file is empty: ${versionFile}`));
    }

    if (!isVersion(versionString)) {
      return err(
        new WorkspaceDetectionError(workspacePath, `Invalid version format in ${versionFile}: ${versionString}`),
      );
    }

    return ok({
      name: '',
      version: toVersion(versionString),
    });
  } catch (error) {
    return err(new WorkspaceDetectionError(workspacePath, `Failed to detect version from text file`, error));
  }
}

/**
 * Update version in text version file
 *
 * @param workspacePath - Path to the workspace directory
 * @param newVersion - New version to write
 * @returns Result indicating success or error
 *
 * @example
 * ```typescript
 * const result = await updateVersion('.', toVersion('1.2.0'));
 * if (isOk(result)) {
 *   console.log('Version updated successfully');
 * }
 * ```
 */
export async function updateVersion(
  workspacePath: string,
  newVersion: Version,
): Promise<Result<void, FileOperationError>> {
  try {
    const versionFile = await findVersionFile(workspacePath);

    if (!versionFile) {
      return err(
        new FileOperationError(
          workspacePath,
          'update',
          `No version file found. Supported files: ${SUPPORTED_FILES.join(', ')}`,
        ),
      );
    }

    // Write version with newline for better compatibility
    await writeFile(versionFile, `${newVersion}\n`, 'utf-8');

    return ok(undefined);
  } catch (error) {
    return err(new FileOperationError(workspacePath, 'update', `Failed to update version in text file`, error));
  }
}

/**
 * Check if a workspace contains a text version file
 *
 * @param workspacePath - Path to the workspace directory
 * @returns True if any supported version file exists
 *
 * @example
 * ```typescript
 * if (await hasVersionFile('.')) {
 *   console.log('Text version file detected');
 * }
 * ```
 */
export async function hasVersionFile(workspacePath: string): Promise<boolean> {
  const versionFile = await findVersionFile(workspacePath);
  return versionFile !== null;
}
