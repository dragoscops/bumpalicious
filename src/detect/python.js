/**
 * Python project version and name detection
 * @module detect/python
 */

import toml from '@iarna/toml';
import {execa} from 'execa';
import fs from 'fs-extra';
import path from 'path';

/**
 * Detect version from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  // Check for pyproject.toml first (using TOML parser)
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    try {
      const content = await fs.readFile(pyprojectPath, 'utf8');
      const pyprojectData = toml.parse(content);

      // Check different locations for version in pyproject.toml
      if (pyprojectData?.tool?.poetry?.version) {
        return pyprojectData.tool.poetry.version;
      }

      if (pyprojectData?.project?.version) {
        return pyprojectData.project.version;
      }
    } catch (error) {
      console.error('Error parsing pyproject.toml:', error);
    }
  }

  // Check for setup.py and setup.cfg using regex
  for (const file of ['setup.py', 'setup.cfg']) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      const versionMatch = content.match(/version\s*=\s*["']?([^"'\s]+)["']?/);
      if (versionMatch) {
        return versionMatch[1];
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

  throw new Error('Could not detect version in Python project');
};

/**
 * Detect name from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  // Check for pyproject.toml first (using TOML parser)
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    try {
      const content = await fs.readFile(pyprojectPath, 'utf8');
      const pyprojectData = toml.parse(content);

      // Check different locations for name in pyproject.toml
      if (pyprojectData?.tool?.poetry?.name) {
        return pyprojectData.tool.poetry.name;
      }

      if (pyprojectData?.project?.name) {
        return pyprojectData.project.name;
      }
    } catch (error) {
      console.error('Error parsing pyproject.toml:', error);
    }
  }

  // Check for setup.py and setup.cfg using regex
  for (const file of ['setup.py', 'setup.cfg']) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      const nameMatch = content.match(/name\s*=\s*["']?([^"'\s]+)["']?/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }
  }

  return path.basename(path.normalize(projectPath));
};
