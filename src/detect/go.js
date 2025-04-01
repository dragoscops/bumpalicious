/**
 * Go project version and name detection
 * @module detect/go
 */

import fs from 'fs-extra';
import path from 'path';
import {GO_VERSION_FILES} from '../core/constants.js';

/**
 * Extract module name from go.mod content
 *
 * @param {string} content - go.mod file content
 * @returns {string|null} - Extracted module name or null if not found
 */
const extractModuleNameFromGoMod = (content) => {
  const moduleMatch = content.match(/^module\s+([\w\d./\-@:]+)/m);
  if (!moduleMatch || !moduleMatch[1]) return null;

  const fullPath = moduleMatch[1];
  const parts = fullPath.split('/');

  // For paths like github.com/username/repo, return the repo name
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }

  return fullPath;
};

/**
 * Extract version from go.mod content
 *
 * @param {string} content - go.mod file content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromGoMod = (content) => {
  const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
  return versionMatch ? versionMatch[1] : null;
};

/**
 * Extract version from Go source file content
 *
 * @param {string} content - Go source file content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromGoSource = (content) => {
  // Check for version constants in different formats
  const patterns = [
    /(const|var)\s+Version\s*=\s*["']([^"']*)["']/,
    /(const|var)\s+version\s*=\s*["']([^"']*)["']/,
    /func\s+Version\(\)\s*string\s*{\s*return\s*["']([^"']*)["']\s*}/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[2] || match[1]; // Return the captured version
    }
  }

  return null;
};

/**
 * Detect version from a Go project
 * Looking for go.mod file and common version files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  // Check for go.mod first
  const goModPath = path.join(projectPath, 'go.mod');
  if (await fs.pathExists(goModPath)) {
    const content = await fs.readFile(goModPath, 'utf8');
    const version = extractVersionFromGoMod(content);
    if (version) {
      return version;
    }
  }

  // Check other version files (version.go in various locations)
  for (const file of GO_VERSION_FILES.slice(1, -1)) {
    // Skip go.mod (already checked) and plain 'version' file
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      const version = extractVersionFromGoSource(content);
      if (version) {
        return version;
      }
    }
  }

  // Check for plain version file as a last resort
  const versionPath = path.join(projectPath, 'version');
  if (await fs.pathExists(versionPath)) {
    const content = await fs.readFile(versionPath, 'utf8');
    const version = content.trim();
    if (version) {
      return version;
    }
  }

  // Default version if we couldn't find anything but don't want to fail
  return '0.0.1';
};

/**
 * Detect name from a Go project
 * Looking for go.mod file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  const configPath = path.join(projectPath, 'go.mod');

  // Check if go.mod file exists
  if (await fs.pathExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf8');
    const moduleName = extractModuleNameFromGoMod(content);
    if (moduleName) {
      return moduleName;
    }
  }

  return path.basename(path.normalize(projectPath));
};
