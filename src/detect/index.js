/**
 * Version and name detection index module
 * @module detect/index
 */

import { detectNodeVersion, detectNodeName } from './node.js';
import { detectDenoVersion, detectDenoName } from './deno.js';
import { detectPythonVersion, detectPythonName } from './python.js';
import { detectGoVersion, detectGoName } from './go.js';
import { detectRustVersion, detectRustName } from './rust.js';
import { detectTextVersion, detectTextName } from './text.js';

/**
 * Map of project types to version detection functions
 */
const VERSION_DETECTORS = {
  node: detectNodeVersion,
  deno: detectDenoVersion,
  python: detectPythonVersion,
  go: detectGoVersion,
  rust: detectRustVersion,
  text: detectTextVersion,
};

/**
 * Map of project types to name detection functions
 */
const NAME_DETECTORS = {
  node: detectNodeName,
  deno: detectDenoName,
  python: detectPythonName,
  go: detectGoName,
  rust: detectRustName,
  text: detectTextName,
};

/**
 * Detect version for a specific project type
 * 
 * @param {string} type - Project type (node, deno, python, go, rust, text)
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If project type is unsupported or version detection fails
 */
export const detectVersion = async (type) => {
  const detector = VERSION_DETECTORS[type.toLowerCase()];
  
  if (!detector) {
    throw new Error(`Unsupported project type: ${type}`);
  }
  
  return detector();
};

/**
 * Detect name for a specific project type
 * 
 * @param {string} type - Project type (node, deno, python, go, rust, text)
 * @returns {Promise<string>} - Detected name
 * @throws {Error} - If project type is unsupported or name detection fails
 */
export const detectName = async (type) => {
  const detector = NAME_DETECTORS[type.toLowerCase()];
  
  if (!detector) {
    throw new Error(`Unsupported project type: ${type}`);
  }
  
  return detector();
};