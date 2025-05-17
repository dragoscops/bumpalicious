/**
 * Go project version and name detection
 * @module detect/go
 */

import fs from 'fs-extra';
import path from 'path';
import {glob} from 'tinyglobby';

import * as logging from '../utils/logging.js';
import * as text from './text.js';

/**
 * @typedef {Object} GoConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Go project
 * Looking for go.mod file or various version declaration files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<GoConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  let name = null;
  let version = null;

  // Check for go.mod file to extract module name
  const configMod = path.join(projectPath, 'go.mod');
  try {
    await fs.access(configMod);
    const content = await fs.readFile(configMod, 'utf8');

    // Extract module name
    name = content.match(/module\s+([\w\d.\/\-@:]+)/m)?.[1];
    // Also check for version comment in go.mod
    version = content.match(/\/\/\s*[vV]ersion:?\s*([0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9a-zA-Z.]+)*)/m)?.[1];

    if (!name) {
      logging.error(`No module name detected in go.mod at ${projectPath}`);
    }
  } catch (error) {
    logging.error(`No go.mod found in the Go project at ${projectPath}, using default`);
  }

  logging.debug(`Detected module name: ${name}, version: ${version} from go.mod`);

  if (!version) {
    logging.debug('Version invalid in go.mod, looking for version.go files');

    // Check for version.go files
    const files = await glob(['**/version.go'], {cwd: projectPath});
    for (const file of files) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf8');

      // Check for standard version constant
      version = content.match(/(const|var)\s+[vV]ersion\s*=\s*["']([^"']*)["']/m)?.[2];
      if (version) {
        return {name, version};
      }

      // Limitation: the func Version() string { return "1.0.0" } pattern
      // should be handled as
      // const version = "1.0.0"
      // func Version() string { return version }
    }
  }

  if (!version) {
    const {version: txtVersion} = await text.detect(projectPath);
    version = txtVersion;

    logging.debug(`Detected version: ${version} from text version file`);
  }

  return {name, version};
};

/**
 * Update version in a Go project
 * Looking for go.mod files and common version patterns
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if version was updated successfully
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  // Try updating in go.mod first
  if (await updateGoModVersion(projectPath, newVersion)) {
    return true;
  }

  // Try updating in version.go files
  if (await updateVersionGoFiles(projectPath, newVersion)) {
    return true;
  }

  // Fall back to updating text files (like version.txt)
  try {
    if (await text.updateVersion({projectPath, newVersion})) {
      return true;
    }
  } catch (error) {
    logging.error('Error updating text version file:', error);
  }

  logging.error(`No version file found or could be updated in the Go project at ${projectPath}`);
  return false;
};

/**
 * Updates version in go.mod file
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<boolean>} - True if version was updated
 */
async function updateGoModVersion(projectPath, newVersion) {
  const goModPath = path.join(projectPath, 'go.mod');
  if (!(await fs.pathExists(goModPath))) {
    return false;
  }

  try {
    const content = await fs.readFile(goModPath, 'utf8');

    // Check for version comment in go.mod
    if (content.match(/\/\/\s*[vV]ersion:?\s*([0-9.]+)/m)) {
      const updatedContent = content.replace(/(\/\/\s*[vV]ersion:?\s*)([0-9.]+)/m, `$1${newVersion}`);

      if (updatedContent !== content) {
        await fs.writeFile(goModPath, updatedContent, 'utf8');
        logging.info(`Updated version comment in go.mod to ${newVersion}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    logging.error('Error updating go.mod:', error);
    return false;
  }
}

/**
 * Updates version in version.go files
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<boolean>} - True if version was updated
 */
async function updateVersionGoFiles(projectPath, newVersion) {
  const files = await glob(['**/version.go'], {cwd: projectPath});

  for (const file of files) {
    const filePath = path.join(projectPath, file);
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Check for standard version constant
      if (content.match(/(const|var)\s+[vV]ersion\s*=\s*["']([^"']*)["']/m)) {
        const updatedContent = content.replace(
          /(const|var)\s+([vV]ersion\s*=\s*["'])([^"']*)["']/m,
          `$1$2${newVersion}"`,
        );

        if (updatedContent !== content) {
          await fs.writeFile(filePath, updatedContent, 'utf8');
          logging.info(`Updated version constant in ${file} to ${newVersion}`);
          return true;
        }
      }
    } catch (error) {
      logging.error(`Error updating version in ${file}:`, error);
    }
  }

  return false;
}
