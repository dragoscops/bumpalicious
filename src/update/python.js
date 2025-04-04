/**
 * Python project version update functionality
 * @module update/python
 */

import fs from 'fs-extra';
import path from 'path';
import toml from '@iarna/toml';
import * as logging from '../utils/logging.js';
import {detectName} from '../detect/python.js';

/**
 * Update version in a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg, and __init__.py files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    try {
      return updatePyProjectVersion(pyprojectPath, newVersion);
    } catch (error) {
      logging.error(`Failed to update Python project version: ${error.message}`);
    }
  }

  const setupPyPath = path.join(projectPath, 'setup.py');
  if (await fs.pathExists(setupPyPath)) {
    try {
      return updateSetupPyVersion(setupPyPath, newVersion);
    } catch (error) {
      logging.error(`Failed to update Python project version: ${error.message}`);
    }
  }

  const setupCfgPath = path.join(projectPath, 'setup.cfg');
  if (await fs.pathExists(setupCfgPath)) {
    try {
      return updateSetupCfgVersion(setupCfgPath, newVersion);
    } catch (error) {
      logging.error(`Failed to update Python project version: ${error.message}`);
    }
  }

  // Common places for __init__.py with version
  let packageName = detectName(projectPath);
  const initPaths = [
    path.join(projectPath, '__init__.py'),
    path.join(projectPath, 'src/__init__.py'),
    path.join(projectPath, `${packageName}/__init__.py`),
    path.join(projectPath, `src/${packageName}/__init__.py`),
  ];

  // Try each path
  for (const initPath of initPaths) {
    if (await fs.pathExists(initPath)) {
      try {
        return updateInitPyVersion(initPath, newVersion);
      } catch (error) {
        logging.error(`Failed to update Python project version: ${error.message}`);
      }
    }
  }

  logging.error(`No version file found in the Python project at ${projectPath}`);
};

/**
 *
 * @param {string} pyprojectPath
 * @param {string} newVersion
 */
const updatePyProjectVersion = async (pyprojectPath, newVersion) => {
  const content = await fs.readFile(pyprojectPath, 'utf8');
  const pyprojectData = toml.parse(content);

  if (pyprojectData.tool?.poetry) {
    pyprojectData.tool.poetry.version = newVersion;
  }
  if (pyprojectData.project) {
    pyprojectData.project.version = newVersion;
  }
  if (pyprojectData.tool?.flit?.metadata) {
    pyprojectData.tool.flit.metadata.version = newVersion;
  }

  const updatedContent = toml.stringify(pyprojectData);
  await fs.writeFile(pyprojectPath, updatedContent);
};

/**
 *
 * @param {string} initPath
 * @param {string} newVersion
 */
const updateSetupPyVersion = async (setupPyPath, newVersion) => {
  const content = await fs.readFile(setupPyPath, 'utf8');
  const updatedContent = content.replace(/(version\s*=\s*)["']([^"']*)["']/, `$1"${newVersion}"`);

  await fs.writeFile(setupPyPath, updatedContent);
};

/**
 *
 * @param {string} initPath
 * @param {string} newVersion
 */
const updateSetupCfgVersion = async (setupCfgPath, newVersion) => {
  const content = await fs.readFile(setupCfgPath, 'utf8');
  const updatedContent = content.replace(/(version\s*=\s*)([^\s;]*)/, `$1${newVersion}`);

  await fs.writeFile(setupCfgPath, updatedContent);
};

/**
 *
 * @param {string} initPath
 * @param {string} newVersion
 */
const updateInitPyVersion = async (initPath, newVersion) => {
  const content = await fs.readFile(initPath, 'utf8');
  if (content.includes('version') || content.includes('__version__')) {
    const updatedContent = content.replace(/(__|)version(__|)\s*=\s*["']([^"']*)["']/, `$1version$2 = "${newVersion}"`);

    // Only write if we actually changed something
    if (content !== updatedContent) {
      await fs.writeFile(initPath, updatedContent);
    }
  }
};
