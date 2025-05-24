/**
 * Text-based project version and name detection
 * @module detect/text
 */

import path from 'path';
import * as d from '../core/version/detect.js';

/**
 * Detect version from a text-based project
 * Looking for version or VERSION files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<TextConfig>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'text', [
    d.configParser(path.join(projectPath, 'version'), {
      parser: (data) => data.trim(), // pass through raw content and trim
      version: [(content) => content],
      name: [() => path.basename(path.normalize(projectPath))],
    }),
    d.configParser(path.join(projectPath, 'version.txt'), {
      parser: (data) => data.trim(),
      version: [(content) => content],
      name: [() => path.basename(path.normalize(projectPath))],
    }),
    d.configParser(path.join(projectPath, 'VERSION'), {
      parser: (data) => data.trim(),
      version: [(content) => content],
      name: [() => path.basename(path.normalize(projectPath))],
    }),
    d.configParser(path.join(projectPath, 'VERSION.txt'), {
      parser: (data) => data.trim(),
      version: [(content) => content],
      name: [() => path.basename(path.normalize(projectPath))],
    }),
  ]);


