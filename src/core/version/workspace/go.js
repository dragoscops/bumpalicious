import path from 'path';
import * as d from '../detect.js';
import * as u from '../update.js';

/**
 * @typedef {import('../detect.js').ProjectInfo} ProjectInfo
 */

/**
 * Detect version from a Go project
 * Looking for go.mod file or various version declaration files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ProjectInfo>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'go', [
    d.configParser(path.join(projectPath, 'go.mod'), {
      parser: (data) => data, // pass through raw content
      version: [/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m],
      name: [/module\s+([\w\d./@:-]+)/m],
    }),
    d.configParser(path.join(projectPath, 'version.go'), {
      parser: (data) => data, // pass through raw content
      version: [/(?:const|var)\s+[vV]ersion\s*=\s*"([^"]*)"/m],
      name: [
        (content) => {
          // Extract package name or use a default approach
          const packageMatch = content.match(/package\s+(\w+)/m);
          return packageMatch ? packageMatch[1] : null;
        },
      ],
    }),
  ]);

/**
 * Update version in a Go project
 * Looking for go.mod file or various version declaration files
 * Updates all files found since Go projects may have version info in multiple files
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<boolean>} - True if at least one file was updated successfully
 */
export const update = async (projectPath, newVersion) =>
  u.updateAll(projectPath, 'go', newVersion, [
    u.configUpdater(path.join(projectPath, 'go.mod'), {
      parser: (data) => data, // pass through raw content
      serializer: (data) => data,
      version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
    }),
    u.configUpdater(path.join(projectPath, 'version.go'), {
      parser: (data) => data, // pass through raw content
      serializer: (data) => data,
      version: [[/(?:const|var)\s+[vV]ersion\s*=\s*"([^"]*)"/m, 'const Version = "$VERSION"']],
    }),
  ]);
