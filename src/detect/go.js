/**
 * Go project version and name detection
 * @module detect/go
 */

import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';

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
 * @returns {string} - Extracted version or default version
 */
const extractVersionFromGoMod = (content) => {
  // Go modules don't have an embedded version in go.mod
  // We use a default version of 0.0.1 if not found
  return '0.0.1';
};

/**
 * Detect version from a Go project
 * Looking for go.mod file
 * 
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectGoVersion = async () => {
  // Check for go.mod
  if (await fs.pathExists('go.mod')) {
    const content = await fs.readFile('go.mod', 'utf8');
    return extractVersionFromGoMod(content);
  }
  
  // Alternatively, try to get version from git tags if it's a Go project
  try {
    if (await fs.pathExists('main.go') || await fs.pathExists('cmd')) {
      const { stdout } = await execa('git', ['describe', '--tags', '--abbrev=0']);
      if (stdout.trim()) {
        // Remove 'v' prefix if present
        return stdout.trim().replace(/^v/, '');
      }
    }
  } catch (error) {
    // Ignore errors - git tags might not exist
  }
  
  // If we have Go files but no go.mod, use a default version
  const files = await fs.readdir('.');
  if (files.some(file => file.endsWith('.go'))) {
    return '0.0.1';
  }
  
  throw new Error('Could not detect version in Go project');
};

/**
 * Detect name from a Go project
 * Looking for go.mod file
 * 
 * @returns {Promise<string>} - Detected name
 */
export const detectGoName = async () => {
  // Check for go.mod
  if (await fs.pathExists('go.mod')) {
    const content = await fs.readFile('go.mod', 'utf8');
    const moduleName = extractModuleNameFromGoMod(content);
    if (moduleName) {
      // For Go modules, use the last part of the module path as the name
      const parts = moduleName.split('/');
      return parts[parts.length - 1];
    }
  }
  
  // Default to current directory name
  return path.basename(process.cwd());
};