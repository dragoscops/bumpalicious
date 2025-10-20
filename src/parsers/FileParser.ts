/**
 * Generic file parser for extracting version and name from various file formats
 */

import * as fs from 'node:fs/promises';
import * as toml from '@iarna/toml';
import type { ProjectInfo } from '../types/workspace.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import { isVersion, toVersion } from '../types/version.js';
import { FileOperationError } from '../utils/errors.js';

/**
 * Parser configuration for different file formats
 */
export interface ParserConfig {
  readonly format: 'json' | 'toml' | 'regex';
  readonly versionPath?: string; // Nested path for JSON/TOML (e.g., "project.version")
  readonly namePath?: string; // Nested path for name
  readonly versionPattern?: RegExp; // Regex pattern for extraction
  readonly namePattern?: RegExp; // Regex pattern for name extraction
}

/**
 * Parse JSON file and extract project information
 *
 * @param filePath - Absolute path to the JSON file
 * @param versionPath - Dot-separated path to version field (e.g., "project.version")
 * @param namePath - Dot-separated path to name field (defaults to "name")
 * @returns Result with ProjectInfo or FileOperationError
 */
export async function parseJsonFile(
  filePath: string,
  versionPath: string = 'version',
  namePath: string = 'name',
): Promise<Result<ProjectInfo, FileOperationError>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Extract version using nested path
    const version = getNestedValue(data, versionPath);
    if (!version || typeof version !== 'string') {
      return err(new FileOperationError(filePath, 'parse', `Version field '${versionPath}' not found or not a string`));
    }

    if (!isVersion(version)) {
      return err(new FileOperationError(filePath, 'parse', `Invalid version format: ${version}`));
    }

    // Extract name using nested path
    const name = getNestedValue(data, namePath);
    if (!name || typeof name !== 'string') {
      return err(new FileOperationError(filePath, 'parse', `Name field '${namePath}' not found or not a string`));
    }

    return ok({
      name,
      version: toVersion(version),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return err(new FileOperationError(filePath, 'parse', 'Invalid JSON syntax', error));
    }
    return err(new FileOperationError(filePath, 'read', error instanceof Error ? error.message : String(error), error));
  }
}

/**
 * Parse TOML file and extract project information
 *
 * @param filePath - Absolute path to the TOML file
 * @param versionPath - Dot-separated path to version field (e.g., "project.version")
 * @param namePath - Dot-separated path to name field (e.g., "package.name")
 * @returns Result with ProjectInfo or FileOperationError
 */
export async function parseTomlFile(
  filePath: string,
  versionPath: string = 'version',
  namePath: string = 'name',
): Promise<Result<ProjectInfo, FileOperationError>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = toml.parse(content);

    // Extract version using nested path
    const version = getNestedValue(data, versionPath);
    if (!version || typeof version !== 'string') {
      return err(new FileOperationError(filePath, 'parse', `Version field '${versionPath}' not found or not a string`));
    }

    if (!isVersion(version)) {
      return err(new FileOperationError(filePath, 'parse', `Invalid version format: ${version}`));
    }

    // Extract name using nested path
    const name = getNestedValue(data, namePath);
    if (!name || typeof name !== 'string') {
      return err(new FileOperationError(filePath, 'parse', `Name field '${namePath}' not found or not a string`));
    }

    return ok({
      name,
      version: toVersion(version),
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('row') || error.message.includes('Unexpected character'))) {
      return err(new FileOperationError(filePath, 'parse', 'Invalid TOML syntax', error));
    }
    return err(new FileOperationError(filePath, 'read', error instanceof Error ? error.message : String(error), error));
  }
}

/**
 * Parse file using regex patterns to extract version and name
 *
 * @param filePath - Absolute path to the file
 * @param versionPattern - Regex pattern with a capture group for version
 * @param namePattern - Regex pattern with a capture group for name (optional)
 * @param defaultName - Default name if pattern doesn't match
 * @returns Result with ProjectInfo or FileOperationError
 */
export async function parseRegexFile(
  filePath: string,
  versionPattern: RegExp,
  namePattern?: RegExp,
  defaultName?: string,
): Promise<Result<ProjectInfo, FileOperationError>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract version
    const versionMatch = content.match(versionPattern);
    if (!versionMatch || !versionMatch[1]) {
      return err(new FileOperationError(filePath, 'parse', 'Version pattern did not match'));
    }

    const version = versionMatch[1];
    if (!isVersion(version)) {
      return err(new FileOperationError(filePath, 'parse', `Invalid version format: ${version}`));
    }

    // Extract name
    let name = defaultName || '';
    if (namePattern) {
      const nameMatch = content.match(namePattern);
      if (nameMatch && nameMatch[1]) {
        name = nameMatch[1];
      }
    }

    if (!name) {
      return err(new FileOperationError(filePath, 'parse', 'Name pattern did not match and no default provided'));
    }

    return ok({
      name,
      version: toVersion(version),
    });
  } catch (error) {
    return err(new FileOperationError(filePath, 'read', error instanceof Error ? error.message : String(error), error));
  }
}

/**
 * Generic config parser that delegates to format-specific parsers
 *
 * @param filePath - Absolute path to the config file
 * @param config - Parser configuration
 * @returns Result with ProjectInfo or FileOperationError
 */
export async function configParser(
  filePath: string,
  config: ParserConfig,
): Promise<Result<ProjectInfo, FileOperationError>> {
  switch (config.format) {
    case 'json':
      return parseJsonFile(filePath, config.versionPath || 'version', config.namePath || 'name');

    case 'toml':
      return parseTomlFile(filePath, config.versionPath || 'version', config.namePath || 'name');

    case 'regex':
      if (!config.versionPattern) {
        return err(new FileOperationError(filePath, 'parse', 'versionPattern is required for regex format'));
      }
      return parseRegexFile(
        filePath,
        config.versionPattern,
        config.namePattern,
        '', // Default name will be set by caller if needed
      );

    default:
      return err(new FileOperationError(filePath, 'parse', `Unsupported format: ${config.format}`));
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
 * Common regex patterns for version extraction
 */
export const VERSION_PATTERNS = {
  // Python setup.py: version='1.2.3' or version="1.2.3"
  PYTHON_SETUP: /version\s*=\s*['"]([^'"]+)['"]/,

  // Python __init__.py: __version__ = '1.2.3' or __version__ = "1.2.3"
  PYTHON_INIT: /__version__\s*=\s*['"]([^'"]+)['"]/,

  // Python setup.cfg: version = 1.2.3
  PYTHON_SETUP_CFG: /^\s*version\s*=\s*(.+)$/m,

  // Go version comment: // version: 1.2.3
  GO_VERSION_COMMENT: /\/\/\s*version:\s*(.+)$/m,

  // Generic version file: 1.2.3
  GENERIC: /^(.+)$/,
} as const;

/**
 * Common regex patterns for name extraction
 */
export const NAME_PATTERNS = {
  // Python setup.py: name='package-name' or name="package-name"
  PYTHON_SETUP: /name\s*=\s*['"]([^'"]+)['"]/,

  // Python setup.cfg: name = package-name
  PYTHON_SETUP_CFG: /^\s*name\s*=\s*(.+)$/m,
} as const;
