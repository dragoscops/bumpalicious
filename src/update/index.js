/**
 * Version updating index module
 * @module update/index
 */

import { updateNodeVersion } from './node.js';
import { updateDenoVersion } from './deno.js';
import { updatePythonVersion } from './python.js';
import { updateGoVersion } from './go.js';
import { updateRustVersion } from './rust.js';
import { updateTextVersion } from './text.js';

/**
 * Map of project types to version update functions
 */
const VERSION_UPDATERS = {
  node: updateNodeVersion,
  deno: updateDenoVersion,
  python: updatePythonVersion,
  go: updateGoVersion,
  rust: updateRustVersion,
  text: updateTextVersion,
};

/**
 * Update version for a specific project type
 * 
 * @param {string} type - Project type (node, deno, python, go, rust, text)
 * @param {string} version - New version to set
 * @returns {Promise<void>}
 * @throws {Error} - If project type is unsupported or version update fails
 */
export const updateVersion = async (type, version) => {
  const updater = VERSION_UPDATERS[type.toLowerCase()];
  
  if (!updater) {
    throw new Error(`Unsupported project type for update: ${type}`);
  }
  
  return updater(version);
};