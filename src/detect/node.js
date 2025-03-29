/**
 * Node.js project version and name detection
 * @module detect/node
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Detect version from a Node.js project
 * Looking for package.json or jsr.json files
 * 
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectNodeVersion = async () => {
  // Check for package.json
  if (await fs.pathExists('package.json')) {
    const pkg = await fs.readJson('package.json');
    if (pkg.version) {
      return pkg.version;
    }
  }
  
  // Check for jsr.json
  if (await fs.pathExists('jsr.json')) {
    const jsr = await fs.readJson('jsr.json');
    if (jsr.version) {
      return jsr.version;
    }
  }
  
  throw new Error('Could not detect version in Node.js project');
};

/**
 * Detect name from a Node.js project
 * Looking for package.json or jsr.json files
 * 
 * @returns {Promise<string>} - Detected name
 * @throws {Error} - If name could not be detected
 */
export const detectNodeName = async () => {
  // Check for package.json
  if (await fs.pathExists('package.json')) {
    const pkg = await fs.readJson('package.json');
    if (pkg.name) {
      return pkg.name;
    }
  }
  
  // Check for jsr.json
  if (await fs.pathExists('jsr.json')) {
    const jsr = await fs.readJson('jsr.json');
    if (jsr.name) {
      return jsr.name;
    }
  }
  
  // Default to current directory name
  return path.basename(process.cwd());
};