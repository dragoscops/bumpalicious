/**
 * Python project version update functionality
 * @module update/python
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Update version in pyproject.toml
 * 
 * @param {string} content - Current file content
 * @param {string} version - New version to set
 * @returns {string} - Updated file content
 */
const updateVersionInPyprojectToml = (content, version) => {
  // Try to update in [tool.poetry] section
  let updated = content.replace(
    /(\[tool\.poetry\][^\[]*version\s*=\s*)["']([^"']*)["']/,
    `$1"${version}"`
  );
  
  // Try to update in [project] section (PEP 621)
  updated = updated.replace(
    /(\[project\][^\[]*version\s*=\s*)["']([^"']*)["']/,
    `$1"${version}"`
  );
  
  // Try to update in [tool.flit.metadata] section
  updated = updated.replace(
    /(\[tool\.flit\.metadata\][^\[]*version\s*=\s*)["']([^"']*)["']/,
    `$1"${version}"`
  );
  
  return updated;
};

/**
 * Update version in setup.py
 * 
 * @param {string} content - Current file content
 * @param {string} version - New version to set
 * @returns {string} - Updated file content
 */
const updateVersionInSetupPy = (content, version) => {
  return content.replace(
    /(version\s*=\s*)["']([^"']*)["']/,
    `$1"${version}"`
  );
};

/**
 * Update version in setup.cfg
 * 
 * @param {string} content - Current file content
 * @param {string} version - New version to set
 * @returns {string} - Updated file content
 */
const updateVersionInSetupCfg = (content, version) => {
  return content.replace(
    /(version\s*=\s*)([^\s;]*)/,
    `$1${version}`
  );
};

/**
 * Update version in __init__.py
 * 
 * @param {string} content - Current file content
 * @param {string} version - New version to set
 * @returns {string} - Updated file content
 */
const updateVersionInInitPy = (content, version) => {
  return content.replace(
    /(__|)version(__|)\s*=\s*["']([^"']*)["']/,
    `$1version$2 = "${version}"`
  );
};

/**
 * Update version in a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg, and __init__.py files
 * 
 * @param {string} version - New version to set
 * @returns {Promise<void>}
 * @throws {Error} - If version update fails
 */
export const updatePythonVersion = async (version) => {
  let updated = false;

  // Update pyproject.toml if it exists
  if (await fs.pathExists('pyproject.toml')) {
    try {
      const content = await fs.readFile('pyproject.toml', 'utf8');
      const updatedContent = updateVersionInPyprojectToml(content, version);
      
      // Only write if we actually changed something
      if (content !== updatedContent) {
        await fs.writeFile('pyproject.toml', updatedContent);
        console.log(`Updated version in pyproject.toml to ${version}`);
        updated = true;
      }
    } catch (error) {
      console.error('Error updating pyproject.toml:', error);
      throw error;
    }
  }
  
  // Update setup.py if it exists
  if (await fs.pathExists('setup.py')) {
    try {
      const content = await fs.readFile('setup.py', 'utf8');
      const updatedContent = updateVersionInSetupPy(content, version);
      
      // Only write if we actually changed something
      if (content !== updatedContent) {
        await fs.writeFile('setup.py', updatedContent);
        console.log(`Updated version in setup.py to ${version}`);
        updated = true;
      }
    } catch (error) {
      console.error('Error updating setup.py:', error);
      throw error;
    }
  }
  
  // Update setup.cfg if it exists
  if (await fs.pathExists('setup.cfg')) {
    try {
      const content = await fs.readFile('setup.cfg', 'utf8');
      const updatedContent = updateVersionInSetupCfg(content, version);
      
      // Only write if we actually changed something
      if (content !== updatedContent) {
        await fs.writeFile('setup.cfg', updatedContent);
        console.log(`Updated version in setup.cfg to ${version}`);
        updated = true;
      }
    } catch (error) {
      console.error('Error updating setup.cfg:', error);
      throw error;
    }
  }
  
  // Try to find and update __init__.py files
  try {
    // Common places for __init__.py with version
    const initPaths = [
      '__init__.py',                      // Current directory
      'src/__init__.py',                  // src directory
    ];
    
    // Try to find a package name from the setup files if available
    let packageName = null;
    
    if (await fs.pathExists('setup.py')) {
      const content = await fs.readFile('setup.py', 'utf8');
      const nameMatch = content.match(/name\s*=\s*["']([^"']*)["']/);
      if (nameMatch && nameMatch[1]) {
        packageName = nameMatch[1];
      }
    }
    
    if (packageName) {
      // Add paths with the package name
      initPaths.push(`${packageName}/__init__.py`);
      initPaths.push(`src/${packageName}/__init__.py`);
    }
    
    // Look for directories directly in the current directory
    const dirs = await fs.readdir('.', { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory() && !['node_modules', 'venv', 'env', '.env', '.git', 'build', 'dist'].includes(dir.name)) {
        const initPath = `${dir.name}/__init__.py`;
        if (await fs.pathExists(initPath)) {
          initPaths.push(initPath);
        }
      }
    }
    
    // Try each path
    for (const initPath of initPaths) {
      if (await fs.pathExists(initPath)) {
        const content = await fs.readFile(initPath, 'utf8');
        
        // Only update if the file contains version information
        if (content.includes('version') || content.includes('__version__')) {
          const updatedContent = updateVersionInInitPy(content, version);
          
          // Only write if we actually changed something
          if (content !== updatedContent) {
            await fs.writeFile(initPath, updatedContent);
            console.log(`Updated version in ${initPath} to ${version}`);
            updated = true;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating __init__.py:', error);
    // Don't fail for __init__.py errors since it's a best-effort update
  }
  
  if (!updated) {
    throw new Error('No version files found to update in Python project');
  }
};