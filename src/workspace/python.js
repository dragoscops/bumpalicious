/**
 * Python project version and name detection
 * @module detect/python
 */

import toml from '@iarna/toml';
import path from 'path';
import * as d from '../core/version/detect.js';

/**
 * Detect version from a Python project
 * Looking for pyproject.toml, poetry.toml, setup.py, setup.cfg, and __init__.py
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<PythonConfig>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'python', [
    d.configParser(path.join(projectPath, 'pyproject.toml'), {
      parser: toml.parse,
      version: ['project.version'],
      name: ['project.name'],
    }),
    d.configParser(path.join(projectPath, 'poetry.toml'), {
      parser: toml.parse,
      version: ['tool.poetry.version'],
      name: ['tool.poetry.name'],
    }),
    d.configParser(path.join(projectPath, 'setup.py'), {
      parser: (data) => data, // pass through raw content
      version: [/version\s*=\s*["']([^"']+)["']/m],
      name: [/name\s*=\s*["']([^"']+)["']/m],
    }),
    d.configParser(path.join(projectPath, 'setup.cfg'), {
      parser: (data) => data, // pass through raw content
      version: [/version\s*=\s*([^\s]+)/m],
      name: [/name\s*=\s*([^\s]+)/m],
    }),
    d.configParser(path.join(projectPath, '__init__.py'), {
      parser: (data) => data, // pass through raw content
      version: [/__version__\s*=\s*["']([^"']+)["']/m],
      name: [/__name__\s*=\s*["']([^"']+)["']/m],
    }),
  ]);
