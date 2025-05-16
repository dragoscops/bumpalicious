/**
 * Python project version and name detection
 * @module detect/python
 */

import toml from '@iarna/toml';
import {execa} from 'execa';
import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';
import {DEFAULT_VERSION} from './constants.js';

/**
 * @typedef {Object} PythonConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<PythonConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  let name = path.basename(path.normalize(projectPath));
  let version = DEFAULT_VERSION;

  const pyprojectTomlPath = path.join(projectPath, 'pyproject.toml');
  try {
    await fs.access(pyprojectTomlPath);
    const pyprojectData = await fs.readFile(pyprojectTomlPath, 'utf8');
    const pyproject = toml.parse(pyprojectData);
    return {
      name,
      version,
      ...(pyproject?.project ?? {}),
    };
  } catch (error) {
    logging.warning(`pyproject.toml not found or invalid in ${projectPath}; moving on...`, error);
  }

  const poetryTomlPath = path.join(projectPath, 'poetry.toml');
  try {
    await fs.access(poetryTomlPath);
    const poetryData = await fs.readFile(poetryTomlPath, 'utf8');
    const pyproject = toml.parse(poetryData);
    return {
      name,
      version,
      ...(pyproject?.tool?.poetry ?? {}),
    };
  } catch (error) {
    logging.warning(`poetry.toml not found or invalid in ${projectPath}; moving on...`, error);
  }

  const setupMatches = {
    'setup.py': /version\s*=\s*["']?([^"'\s]+)["']?/,
    'setup.cfg': /version\s*=\s*["']?([^"'\s]+)["']?/,
    '__init__.py': /__version__\s*=\s*["']?([^"'\s]+)["']?/,
  };

  // Check for setup.py and setup.cfg using regex
  for (const file of Object.keys(setupMatches)) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const versionMatch = content.match(setupMatches[file]);
      return {
        name,
        version: versionMatch ? versionMatch[1] : version,
      };
    } catch (error) {
      logging.warning(`${file} not found or invalid in ${projectPath}; moving on...`, error);
    }
  }

  // Try to detect version using Python's importlib.metadata
  try {
    const {stdout} = await execa(
      'python',
      ['-c', "import importlib.metadata; print(importlib.metadata.version('.'))"],
      {cwd: projectPath},
    );
    if (stdout.trim()) {
      return {
        name,
        version: stdout.trim(),
      };
    }
  } catch {
    logging.warning(`Unable to parse version, using python, in ${projectPath}; moving on...`, error);
  }

  logging.error(`No version file found in the NodeJS project at ${projectPath}`);
};

/**
 * Update version in a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg, and __init__.py files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  const pyProjectTomlPath = path.join(projectPath, 'pyproject.toml');
  try {
    await fs.access(pyProjectTomlPath);
    let pyProject = await fs.readFile(pyProjectTomlPath, 'utf8').then(toml.parse);

    pyProject = {
      ...(pyProject ?? {}),
      project: {
        ...(pyProject.project ?? {}),
        version: newVersion,
      },
    };

    return fs.writeFile(pyProjectTomlPath, toml.stringify(pyProject));
  } catch (error) {
    logging.warning(`pyproject.toml not found or invalid in ${projectPath}; moving on...`, error);
  }

  const poetryTomlPath = path.join(projectPath, 'poetry.toml');
  try {
    await fs.access(poetryTomlPath);
    let poetryProject = fs.readFile(poetryTomlPath, 'utf8').then(toml.parse);

    poetryProject = {
      ...(poetryProject ?? {}),
      tool: {
        ...(poetryProject?.tool ?? {}),
        poetry: {
          ...poetryProject.tool?.poetry,
          version: newVersion,
        },
      },
    };

    return fs.writeFile(poetryTomlPath, toml.stringify(poetryProject));
  } catch (error) {
    logging.warning(`poetry.toml not found or invalid in ${projectPath}; moving on...`, error);
  }

  const setupMatches = {
    'setup.py': /version\s*=\s*["']?([^"'\s]+)["']?/,
    'setup.cfg': /version\s*=\s*["']?([^"'\s]+)["']?/,
    '__init__.py': /__version__\s*=\s*["']?([^"'\s]+)["']?/,
  };

  // Check for setup.py and setup.cfg using regex
  for (const file of Object.keys(setupMatches)) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
      let content = await fs.readFile(filePath, 'utf8');

      if (file === '__init__.py') {
        content = content.replace(setupMatches[file], `__version__ = "${newVersion}"`);
      } else {
        content = content.replace(setupMatches[file], `version = "${newVersion}"`);
      }

      return fs.writeFile(projectPath, content);
    } catch (error) {
      logging.warning(`${file} not found or invalid in ${projectPath}; moving on...`, error);
    }
  }

  logging.error(`No version file found in the Python project at ${projectPath}`);
};
