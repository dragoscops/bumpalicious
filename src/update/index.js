/**
 * Project version updaters
 * @module update
 */

import {updateVersion as denoUpdater} from './deno.js';
import {updateVersion as goUpdater} from './go.js';
import {updateVersion as nodeUpdater} from './node.js';
import {updateVersion as pythonUpdater} from './python.js';
import {updateVersion as rustUpdater} from './rust.js';
import {updateVersion as textUpdater} from './text.js';
import {updateVersion as zigUpdater} from './zig.js';

/**
 * Update a project's version
 *
 * @param {Object} options - Update options
 * @param {string} options.type - Project type ('node', 'python', 'go', etc.)
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if the update was successful
 * @throws {Error} - If the project type is not supported
 */
export const updateVersion = async ({type, projectPath, newVersion}) => {
  switch (type.toLowerCase()) {
    case 'deno':
      return denoUpdater({projectPath, newVersion});
    case 'go':
      return goUpdater({projectPath, newVersion});
    case 'node':
      return nodeUpdater({projectPath, newVersion});
    case 'python':
      return pythonUpdater({projectPath, newVersion});
    case 'rust':
      return rustUpdater({projectPath, newVersion});
    case 'text':
      return textUpdater({projectPath, newVersion});
    case 'zig':
      return zigUpdater({projectPath, newVersion});
    default:
      throw new Error(`Unsupported project type: ${type}`);
  }
};

export {denoUpdater, goUpdater, nodeUpdater, pythonUpdater, rustUpdater, textUpdater, zigUpdater};

export default {
  updateVersion,
  deno: denoUpdater,
  go: goUpdater,
  node: nodeUpdater,
  python: pythonUpdater,
  rust: rustUpdater,
  text: textUpdater,
  zig: zigUpdater,
};
