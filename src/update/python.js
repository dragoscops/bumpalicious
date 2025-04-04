/**
 * Python project version update functionality
 * @module update/python
 */

import fs from 'fs-extra';
import path from 'path';
import toml from '@iarna/toml';
import * as logging from '../utils/logging.js';

/**
 * Update version in a Python project
 * Looking for pyproject.toml, setup.py, setup.cfg, and __init__.py files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  try {
    let updated = false;

    // Update pyproject.toml if it exists using TOML parser
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');
    if (await fs.pathExists(pyprojectPath)) {
      try {
        const content = await fs.readFile(pyprojectPath, 'utf8');

        try {
          // Parse TOML
          const pyprojectData = toml.parse(content);
          let modified = false;

          // Try to update in common locations
          if (pyprojectData.tool?.poetry) {
            pyprojectData.tool.poetry.version = newVersion;
            modified = true;
          }

          if (pyprojectData.project) {
            pyprojectData.project.version = newVersion;
            modified = true;
          }

          if (pyprojectData.tool?.flit?.metadata) {
            pyprojectData.tool.flit.metadata.version = newVersion;
            modified = true;
          }

          if (modified) {
            // Convert back to TOML
            const updatedContent = toml.stringify(pyprojectData);
            await fs.writeFile(pyprojectPath, updatedContent);
            logging.success(`Updated version in pyproject.toml to ${newVersion}`);
            updated = true;
          }
        } catch (parseError) {
          // If TOML parsing fails, try regex-based approach as fallback
          logging.error('Error parsing pyproject.toml:', parseError);

          // Regex-based update as fallback
          let updatedContent = content;

          // Try to update in [tool.poetry] section
          updatedContent = updatedContent.replace(
            /(\[tool\.poetry\][^\[]*version\s*=\s*)["']([^"']*)["']/,
            `$1"${newVersion}"`,
          );

          // Try to update in [project] section (PEP 621)
          updatedContent = updatedContent.replace(
            /(\[project\][^\[]*version\s*=\s*)["']([^"']*)["']/,
            `$1"${newVersion}"`,
          );

          // Try to update in [tool.flit.metadata] section
          updatedContent = updatedContent.replace(
            /(\[tool\.flit\.metadata\][^\[]*version\s*=\s*)["']([^"']*)["']/,
            `$1"${newVersion}"`,
          );

          // Only write if we actually changed something
          if (content !== updatedContent) {
            await fs.writeFile(pyprojectPath, updatedContent);
            logging.success(`Updated version in pyproject.toml to ${newVersion} (using regex)`);
            updated = true;
          }
        }
      } catch (error) {
        logging.error('Error updating pyproject.toml:', error);
      }
    }

    // Update setup.py if it exists
    const setupPyPath = path.join(projectPath, 'setup.py');
    if (await fs.pathExists(setupPyPath)) {
      try {
        const content = await fs.readFile(setupPyPath, 'utf8');
        const updatedContent = content.replace(/(version\s*=\s*)["']([^"']*)["']/, `$1"${newVersion}"`);

        // Only write if we actually changed something
        if (content !== updatedContent) {
          await fs.writeFile(setupPyPath, updatedContent);
          logging.success(`Updated version in setup.py to ${newVersion}`);
          updated = true;
        }
      } catch (error) {
        logging.error('Error updating setup.py:', error);
      }
    }

    // Update setup.cfg if it exists
    const setupCfgPath = path.join(projectPath, 'setup.cfg');
    if (await fs.pathExists(setupCfgPath)) {
      try {
        const content = await fs.readFile(setupCfgPath, 'utf8');
        const updatedContent = content.replace(/(version\s*=\s*)([^\s;]*)/, `$1${newVersion}`);

        // Only write if we actually changed something
        if (content !== updatedContent) {
          await fs.writeFile(setupCfgPath, updatedContent);
          logging.success(`Updated version in setup.cfg to ${newVersion}`);
          updated = true;
        }
      } catch (error) {
        logging.error('Error updating setup.cfg:', error);
      }
    }

    // Try to find and update __init__.py files
    try {
      // Common places for __init__.py with version
      const initPaths = [path.join(projectPath, '__init__.py'), path.join(projectPath, 'src/__init__.py')];

      // Try to find a package name from the setup files if available
      let packageName = null;

      if (await fs.pathExists(setupPyPath)) {
        const content = await fs.readFile(setupPyPath, 'utf8');
        const nameMatch = content.match(/name\s*=\s*["']([^"']*)["']/);
        if (nameMatch && nameMatch[1]) {
          packageName = nameMatch[1];
        }
      }

      if (packageName) {
        // Add paths with the package name
        initPaths.push(path.join(projectPath, `${packageName}/__init__.py`));
        initPaths.push(path.join(projectPath, `src/${packageName}/__init__.py`));
      }

      // Try each path
      for (const initPath of initPaths) {
        if (await fs.pathExists(initPath)) {
          const content = await fs.readFile(initPath, 'utf8');

          // Only update if the file contains version information
          if (content.includes('version') || content.includes('__version__')) {
            const updatedContent = content.replace(
              /(__|)version(__|)\s*=\s*["']([^"']*)["']/,
              `$1version$2 = "${newVersion}"`,
            );

            // Only write if we actually changed something
            if (content !== updatedContent) {
              await fs.writeFile(initPath, updatedContent);
              logging.success(
                `Updated version in ${path.basename(path.dirname(initPath))}/__init__.py to ${newVersion}`,
              );
              updated = true;
            }
          }
        }
      }
    } catch (error) {
      logging.error('Error updating __init__.py:', error);
      // Don't fail for __init__.py errors since it's a best-effort update
    }

    // If no files were updated, create a version file
    if (!updated) {
      const versionPath = path.join(projectPath, 'version');
      await fs.writeFile(versionPath, newVersion, 'utf8');
      logging.success(`Created version file with version ${newVersion}`);
      updated = true;
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update Python project version: ${error.message}`);
    throw error;
  }
};
