/**
 * Zig project version and name detection
 * @module detect/zig
 */

import path from 'path';
import * as d from '../core/version/detect.js';

/**
 * Detect version from a Zig project
 * Looking for build.zig and build.zig.zon files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ZigConfig>} - Detected version
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


