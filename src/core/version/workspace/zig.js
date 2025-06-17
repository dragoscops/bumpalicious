import path from 'path';
import * as d from '../detect.js';
import * as u from '../update.js';

/**
 * @typedef {import('../detect.js').ProjectInfo} ProjectInfo
 */

/**
 * Detect version from a Zig project
 * Looking for build.zig and build.zig.zon files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ProjectInfo>} - Detected version
 */
export const detect = async (projectPath) =>
  d.merge(projectPath, 'zig', [
    d.configParser(path.join(projectPath, 'build.zig'), {
      parser: (data) => data, // pass through raw content
      version: [/const\s+VERSION\s*=\s*"([^"]+)"/i],
      name: [/const\s+NAME\s*=\s*"([^"]+)"/i],
    }),
    d.configParser(path.join(projectPath, 'build.zig.zon'), {
      parser: (data) => data, // pass through raw content
      version: [/\.version\s*=\s*"([^"]+)"/m],
      name: [/\.name\s*=\s*"([^"]+)"/m],
    }),
  ]);

/**
 * Update version in a Zig project
 * Looking for build.zig and build.zig.zon files
 * Updates all files found since Zig projects may have version info in multiple files
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<void>}
 */
export const update = async (projectPath, newVersion) =>
  u.updateAll(projectPath, 'zig', newVersion, [
    u.configUpdater(path.join(projectPath, 'build.zig'), {
      parser: (data) => data,
      serializer: (data) => data,
      version: [[/const\s+VERSION\s*=\s*"([^"]+)"/i, `const VERSION = "${newVersion}"`]],
    }),
    u.configUpdater(path.join(projectPath, 'build.zig.zon'), {
      parser: (data) => data,
      serializer: (data) => data,
      version: [[/\.version\s*=\s*"([^"]+)"/m, `.version = "${newVersion}"`]],
    }),
  ]);
