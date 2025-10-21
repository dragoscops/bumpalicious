/**
 * Generic file updater for modifying version numbers in various file formats
 */

import * as fs from 'node:fs/promises';
import * as toml from '@iarna/toml';
import { parseRegexFile } from './FileParser.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { Version } from '../types/version.js';
import { isVersion } from '../types/version.js';
import { FileOperationError } from '../utils/errors.js';

/**
 * Updater configuration for different file formats
 */
export interface UpdaterConfig {
  readonly format: 'json' | 'toml' | 'regex';
  readonly versionPath?: string; // Nested path for JSON/TOML (e.g., "project.version")
  readonly versionPattern?: RegExp; // Regex pattern for version extraction
  readonly versionReplacement?: string; // Replacement template (use $VERSION placeholder)
}

/**
 * Update version in JSON file
 *
 * @param filePath - Absolute path to the JSON file
 * @param newVersion - New version to set
 * @param versionPath - Dot-separated path to version field (e.g., "project.version")
 * @returns Result indicating success or error
 */
export async function updateJsonFile(
  filePath: string,
  newVersion: Version,
  versionPath: string = 'version',
): Promise<Result<void, FileOperationError>> {
  try {
    // Read and parse file first
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Check if the version path exists in the parsed data
    const currentVersion = getNestedValue(data, versionPath);
    if (!currentVersion || typeof currentVersion !== 'string') {
      return err(new FileOperationError(filePath, 'update', `Version field '${versionPath}' not found in file`));
    }

    // Validate current version format
    if (!isVersion(currentVersion)) {
      return err(new FileOperationError(filePath, 'update', `Invalid existing version format: ${currentVersion}`));
    }

    // Update version using nested path
    const updated = setNestedValue(data, versionPath, newVersion);
    if (!updated) {
      return err(new FileOperationError(filePath, 'update', `Failed to set version at path '${versionPath}'`));
    }

    // Write back to file
    const newContent = JSON.stringify(data, null, 2) + '\n';
    await fs.writeFile(filePath, newContent, 'utf-8');

    return ok(undefined);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return err(new FileOperationError(filePath, 'update', 'Invalid JSON syntax', error));
    }
    return err(
      new FileOperationError(filePath, 'update', error instanceof Error ? error.message : String(error), error),
    );
  }
}

/**
 * Update version in TOML file
 *
 * @param filePath - Absolute path to the TOML file
 * @param newVersion - New version to set
 * @param versionPath - Dot-separated path to version field (e.g., "package.version")
 * @returns Result indicating success or error
 */
export async function updateTomlFile(
  filePath: string,
  newVersion: Version,
  versionPath: string = 'version',
): Promise<Result<void, FileOperationError>> {
  try {
    // Read and parse file first
    const content = await fs.readFile(filePath, 'utf-8');
    const data = toml.parse(content);

    // Check if the version path exists in the parsed data
    const currentVersion = getNestedValue(data, versionPath);
    if (!currentVersion || typeof currentVersion !== 'string') {
      return err(new FileOperationError(filePath, 'update', `Version field '${versionPath}' not found in file`));
    }

    // Validate current version format
    if (!isVersion(currentVersion)) {
      return err(new FileOperationError(filePath, 'update', `Invalid existing version format: ${currentVersion}`));
    }

    // Update version using nested path
    const updated = setNestedValue(data, versionPath, newVersion);
    if (!updated) {
      return err(new FileOperationError(filePath, 'update', `Failed to set version at path '${versionPath}'`));
    }

    // Write back to file
    const newContent = toml.stringify(data as toml.JsonMap);
    await fs.writeFile(filePath, newContent, 'utf-8');

    return ok(undefined);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('row') || error.message.includes('Unexpected character'))) {
      return err(new FileOperationError(filePath, 'update', 'Invalid TOML syntax', error));
    }
    return err(
      new FileOperationError(filePath, 'update', error instanceof Error ? error.message : String(error), error),
    );
  }
}

/**
 * Update version in file using regex pattern replacement
 *
 * @param filePath - Absolute path to the file
 * @param newVersion - New version to set
 * @param versionPattern - Regex pattern to match version
 * @param versionReplacement - Replacement string (use $VERSION for version placeholder)
 * @returns Result indicating success or error
 */
export async function updateRegexFile(
  filePath: string,
  newVersion: Version,
  versionPattern: RegExp,
  versionReplacement: string,
): Promise<Result<void, FileOperationError>> {
  try {
    // Verify file exists and has version first
    const parseResult = await parseRegexFile(filePath, versionPattern, undefined, 'unknown');
    if (!parseResult.ok) {
      return err(
        new FileOperationError(
          filePath,
          'update',
          'Cannot update file without valid existing version',
          parseResult.error,
        ),
      );
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Check if pattern matches
    if (!versionPattern.test(content)) {
      return err(new FileOperationError(filePath, 'update', 'Version pattern did not match in file'));
    }

    // Replace version using pattern
    const replacement = versionReplacement.replace(/\$VERSION/g, newVersion);
    const newContent = content.replace(versionPattern, replacement);

    // Verify version was actually changed
    if (newContent === content) {
      return err(new FileOperationError(filePath, 'update', 'File content unchanged after replacement'));
    }

    // Write back to file
    await fs.writeFile(filePath, newContent, 'utf-8');

    return ok(undefined);
  } catch (error) {
    return err(
      new FileOperationError(filePath, 'update', error instanceof Error ? error.message : String(error), error),
    );
  }
}

/**
 * Generic config updater that delegates to format-specific updaters
 *
 * @param filePath - Absolute path to the config file
 * @param newVersion - New version to set
 * @param config - Updater configuration
 * @returns Result indicating success or error
 */
export async function configUpdater(
  filePath: string,
  newVersion: Version,
  config: UpdaterConfig,
): Promise<Result<void, FileOperationError>> {
  switch (config.format) {
    case 'json':
      return updateJsonFile(filePath, newVersion, config.versionPath || 'version');

    case 'toml':
      return updateTomlFile(filePath, newVersion, config.versionPath || 'version');

    case 'regex':
      if (!config.versionPattern || !config.versionReplacement) {
        return err(
          new FileOperationError(
            filePath,
            'update',
            'versionPattern and versionReplacement are required for regex format',
          ),
        );
      }
      return updateRegexFile(filePath, newVersion, config.versionPattern, config.versionReplacement);

    default:
      return err(new FileOperationError(filePath, 'update', `Unsupported format: ${(config as UpdaterConfig).format}`));
  }
}

/**
 * Get nested value from object using dot-separated path
 *
 * @param obj - Object to extract value from
 * @param path - Dot-separated path (e.g., "project.version")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set nested value in object using dot-separated path
 *
 * @param obj - Object to modify
 * @param path - Dot-separated path (e.g., "project.version")
 * @param value - Value to set
 * @returns True if value was set successfully, false otherwise
 */
function setNestedValue(obj: unknown, path: string, value: string): boolean {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }

  const keys = path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) {
    return false;
  }

  // Navigate to parent object
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    const currentObj = current as Record<string, unknown>;
    if (!currentObj[key]) {
      currentObj[key] = {};
    }
    current = currentObj[key];
  }

  if (current === null || current === undefined || typeof current !== 'object') {
    return false;
  }

  // Set the value
  (current as Record<string, unknown>)[lastKey] = value;
  return true;
}
