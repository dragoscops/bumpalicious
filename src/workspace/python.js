/**
 * Python project version and name detection
 * @module detect/python
 */

import toml from '@iarna/toml';
import {execa} from 'execa';
import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';

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
  const defaultName = path.basename(path.normalize(projectPath));

  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    try {
      return detectJsonc(pyprojectPath, defaultName);
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
    }
  }

  const setupMatches = {
    'setup.py': /version\s*=\s*["']?([^"'\s]+)["']?/,
    'setup.cfg': /version\s*=\s*["']?([^"'\s]+)["']?/,
    '__init__.py': /__version__\s*=\s*["']?([^"'\s]+)["']?/,
  };

  // Check for setup.py and setup.cfg using regex
  for (const file of Object.keys(setupMatches)) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const versionMatch = content.match(setupMatches[file]);
        return {
          name: defaultName,
          version: versionMatch ? versionMatch[1] : undefined,
        }
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
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
      return stdout.trim();
    }
  } catch {
    // Ignore errors
  }

  logging.error(`No version file found in the NodeJS project at ${projectPath}`);
};

/**
 * Detect name and version from a Python toml project file
 * 
 * @param {string} configPath 
 * @param {string} defaultName 
 * @returns {PythonConfig}
 */
const detectJsonc = async (pyprojectPath, defaultName) => {
  const content = await fs.readFile(pyprojectPath, 'utf8');
  const pyprojectData = toml.parse(content);

  if (pyprojectData?.tool?.poetry?.version) {
    return {
      name: pyprojectData.tool.poetry.name || defaultName,
      version: pyprojectData.tool.poetry.version,
    };
  }
  if (pyprojectData?.project?.version) {
    return {
      name: pyprojectData.project.name || defaultName,
      version: pyprojectData.project.version,
    };
  }
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

  const {name: packageName} = detect(projectPath);
  const initPaths = [
    path.join(projectPath, '__init__.py'),
    path.join(projectPath, 'src/__init__.py'),
    path.join(projectPath, `${packageName}/__init__.py`),
    path.join(projectPath, `src/${packageName}/__init__.py`),
  ];

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
