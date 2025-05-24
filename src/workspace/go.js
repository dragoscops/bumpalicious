/**
 * Go project version and name detection
 * @module detect/go
 */

import path from 'path';
import * as d from '../core/version/detect.js';

/**
 * Detect version from a Go project
 * Looking for go.mod file or various version declaration files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<GoConfig>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'go', [
    d.configParser(path.join(projectPath, 'go.mod'), {
      parser: (data) => data, // pass through raw content
      version: [/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m],
      name: [/module\s+([\w\d./\-@:]+)/m],
    }),
    d.configParser(path.join(projectPath, 'version.go'), {
      parser: (data) => data, // pass through raw content
      version: [/(?:const|var)\s+[vV]ersion\s*=\s*"([^"]*)"/m],
      name: [(content) => {
        // Extract package name or use a default approach
        const packageMatch = content.match(/package\s+(\w+)/m);
        return packageMatch ? packageMatch[1] : null;
      }],
    }),
  ]);


