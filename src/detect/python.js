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
 * Detect version from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 */
export const detectVersion = async (projectPath) => {
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    try {
      const content = await fs.readFile(pyprojectPath, 'utf8');
      const pyprojectData = toml.parse(content);

      if (pyprojectData?.tool?.poetry?.version) {
        return pyprojectData.tool.poetry.version;
      }
      if (pyprojectData?.project?.version) {
        return pyprojectData.project.version;
      }
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
    }
  }

  // Check for setup.py and setup.cfg using regex
  for (const file of ['setup.py', 'setup.cfg']) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const versionMatch = content.match(/version\s*=\s*["']?([^"'\s]+)["']?/);
        if (versionMatch) {
          return versionMatch[1];
        }
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
    }
  }

  const filePath = path.join(projectPath, '__init__.py');
  if (await fs.pathExists(filePath)) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const versionMatch = content.match(/__version__\s*=\s*["']?([^"'\s]+)["']?/);
      if (versionMatch) {
        return versionMatch[1];
      }
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
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
 * Detect name from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    try {
      const content = await fs.readFile(pyprojectPath, 'utf8');
      const pyprojectData = toml.parse(content);

      if (pyprojectData?.tool?.poetry?.name) {
        return pyprojectData.tool.poetry.name;
      }
      if (pyprojectData?.project?.name) {
        return pyprojectData.project.name;
      }
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
    }
  }

  for (const file of ['setup.py', 'setup.cfg']) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const nameMatch = content.match(/name\s*=\s*["']?([^"'\s]+)["']?/);
        if (nameMatch) {
          return nameMatch[1];
        }
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
    }
  }

  const filePath = path.join(projectPath, '__init__.py');
  if (await fs.pathExists(filePath)) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const nameMatch = content.match(/__name__\s*=\s*["']?([^"'\s]+)["']?/);
      if (nameMatch) {
        return nameMatch[1];
      }
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
    }
  }

  return path.basename(path.normalize(projectPath));
};
