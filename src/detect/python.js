/**
 * Python project version and name detection
 * @module detect/python
 */

import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';

/**
 * Extract version from pyproject.toml content
 * 
 * @param {string} content - pyproject.toml file content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromPyprojectToml = (content) => {
  // Try to extract from [tool.poetry] section
  const poetryMatch = content.match(/\[tool\.poetry\][^\[]*version\s*=\s*["']([^"']+)["']/);
  if (poetryMatch && poetryMatch[1]) {
    return poetryMatch[1];
  }
  
  // Try to extract from [project] section (PEP 621)
  const projectMatch = content.match(/\[project\][^\[]*version\s*=\s*["']([^"']+)["']/);
  if (projectMatch && projectMatch[1]) {
    return projectMatch[1];
  }
  
  // Try to extract from [tool.flit.metadata] section
  const flitMatch = content.match(/\[tool\.flit\.metadata\][^\[]*version\s*=\s*["']([^"']+)["']/);
  if (flitMatch && flitMatch[1]) {
    return flitMatch[1];
  }
  
  return null;
};

/**
 * Extract name from pyproject.toml content
 * 
 * @param {string} content - pyproject.toml file content
 * @returns {string|null} - Extracted name or null if not found
 */
const extractNameFromPyprojectToml = (content) => {
  // Try to extract from [tool.poetry] section
  const poetryMatch = content.match(/\[tool\.poetry\][^\[]*name\s*=\s*["']([^"']+)["']/);
  if (poetryMatch && poetryMatch[1]) {
    return poetryMatch[1];
  }
  
  // Try to extract from [project] section (PEP 621)
  const projectMatch = content.match(/\[project\][^\[]*name\s*=\s*["']([^"']+)["']/);
  if (projectMatch && projectMatch[1]) {
    return projectMatch[1];
  }
  
  // Try to extract from [tool.flit.metadata] section
  const flitMatch = content.match(/\[tool\.flit\.metadata\][^\[]*module\s*=\s*["']([^"']+)["']/);
  if (flitMatch && flitMatch[1]) {
    return flitMatch[1];
  }
  
  return null;
};

/**
 * Extract version from setup.py content
 * 
 * @param {string} content - setup.py file content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromSetupPy = (content) => {
  const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
  return versionMatch && versionMatch[1] ? versionMatch[1] : null;
};

/**
 * Extract name from setup.py content
 * 
 * @param {string} content - setup.py file content
 * @returns {string|null} - Extracted name or null if not found
 */
const extractNameFromSetupPy = (content) => {
  const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
  return nameMatch && nameMatch[1] ? nameMatch[1] : null;
};

/**
 * Extract version from setup.cfg content
 * 
 * @param {string} content - setup.cfg file content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromSetupCfg = (content) => {
  const versionMatch = content.match(/version\s*=\s*([^\s;]+)/);
  return versionMatch && versionMatch[1] ? versionMatch[1] : null;
};

/**
 * Extract name from setup.cfg content
 * 
 * @param {string} content - setup.cfg file content
 * @returns {string|null} - Extracted name or null if not found
 */
const extractNameFromSetupCfg = (content) => {
  const nameMatch = content.match(/name\s*=\s*([^\s;]+)/);
  return nameMatch && nameMatch[1] ? nameMatch[1] : null;
};

/**
 * Detect version from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 * 
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectPythonVersion = async () => {
  // Check for pyproject.toml
  if (await fs.pathExists('pyproject.toml')) {
    const content = await fs.readFile('pyproject.toml', 'utf8');
    const version = extractVersionFromPyprojectToml(content);
    if (version) {
      return version;
    }
  }
  
  // Check for setup.py
  if (await fs.pathExists('setup.py')) {
    const content = await fs.readFile('setup.py', 'utf8');
    const version = extractVersionFromSetupPy(content);
    if (version) {
      return version;
    }
  }
  
  // Check for setup.cfg
  if (await fs.pathExists('setup.cfg')) {
    const content = await fs.readFile('setup.cfg', 'utf8');
    const version = extractVersionFromSetupCfg(content);
    if (version) {
      return version;
    }
  }
  
  // Try to use Python to get the version
  try {
    // If a package is installable, we can try to get its version programmatically
    const { stdout } = await execa('python', ['-c', 'import importlib.metadata; print(importlib.metadata.version("."))']);
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch (error) {
    // Ignore errors - package might not be installed
  }
  
  throw new Error('Could not detect version in Python project');
};

/**
 * Detect name from a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg
 * 
 * @returns {Promise<string>} - Detected name
 */
export const detectPythonName = async () => {
  // Check for pyproject.toml
  if (await fs.pathExists('pyproject.toml')) {
    const content = await fs.readFile('pyproject.toml', 'utf8');
    const name = extractNameFromPyprojectToml(content);
    if (name) {
      return name;
    }
  }
  
  // Check for setup.py
  if (await fs.pathExists('setup.py')) {
    const content = await fs.readFile('setup.py', 'utf8');
    const name = extractNameFromSetupPy(content);
    if (name) {
      return name;
    }
  }
  
  // Check for setup.cfg
  if (await fs.pathExists('setup.cfg')) {
    const content = await fs.readFile('setup.cfg', 'utf8');
    const name = extractNameFromSetupCfg(content);
    if (name) {
      return name;
    }
  }
  
  // Default to current directory name
  return path.basename(process.cwd());
};