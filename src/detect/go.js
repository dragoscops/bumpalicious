/**
 * Go project version and name detection
 * @module detect/go
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Extract module name from go.mod content
 *
 * @param {string} content - go.mod file content
 * @returns {string|null} - Extracted module name or null if not found
 */
const extractModuleNameFromGoMod = (content) => {
  const moduleMatch = content.match(/^module\s+([\w\d./\-@:]+)/m);
  return moduleMatch && moduleMatch[1] ? moduleMatch[1] : null;
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
 * Detect version from a Go project
 * Looking for go.mod file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  const configPath = path.join(projectPath, 'go.mod');

  // Check if go.mod file exists
  if (await fs.pathExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf8');
    const version = extractVersionFromGoMod(content);
    if (version) {
      return version;
    }
  }

  throw new Error('Could not detect version in Go project');
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
  console.log('configPath', configPath, await fs.pathExists(configPath));

  // Check if go.mod file exists
  if (await fs.pathExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf8');
    console.log('content', content);
    const moduleName = extractModuleNameFromGoMod(content);
    if (moduleName) {
      return moduleName.split('/').pop();
    }
  }

  return path.basename(path.normalize(projectPath));
};
