/**
 * Zig project version and name detection
 * @module detect/zig
 */

import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';
import * as logging from '../utils/logging.js';
import {ZIG_VERSION_FILES} from '../core/constants.js'; 

/**
 * @typedef {Object} ZigConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Zig project
 * Looking for build.zig and build.zig.zon files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ZigConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  const defaultName = path.basename(path.normalize(projectPath));

  const zonPath = path.join(projectPath, 'build.zig.zon');
  if (await fs.pathExists(zonPath)) {
    const content = await fs.readFile(zonPath, 'utf8');
    const zonData = parseZigZonFile(content);
    return {
      name: zonData?.name || defaultName,
      version: zonData?.version || null,
    }
  }

  const buildPath = path.join(projectPath, 'build.zig');
  if (await fs.pathExists(buildPath)) {
    const content = await fs.readFile(buildPath, 'utf8');
    return {
      name: extractNameFromZigContent(content) || defaultName,
      version: extractVersionFromZigContent(content)
    };
  }

  try {
    const {stdout} = await execa('zig', ['version'], {cwd: projectPath});
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // Ignore errors if zig command fails
  }

  logging.error(`No version file found in the Zig project at ${projectPath}`);
};

/**
 * Extract version from Zig build.zig content
 *
 * @param {string} content - File content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromZigContent = (content) => {
  // Common patterns for version in Zig build files
  const versionPatterns = [
    /version\s*=\s*"([^"]+)"/,
    /\.version\s*=\s*"([^"]+)"/,
    /\.addPackage\(.+?\.version\s*=\s*"([^"]+)"/s,
    /const\s+VERSION\s*=\s*"([^"]+)"/i,
  ];

  for (const pattern of versionPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Extract name from Zig build.zig content
 *
 * @param {string} content - File content
 * @returns {string|null} - Extracted name or null if not found
 */
const extractNameFromZigContent = (content) => {
  // Common patterns for name in Zig build files
  const namePatterns = [
    /name\s*=\s*"([^"]+)"/,
    /\.name\s*=\s*"([^"]+)"/,
    /\.addPackage\(.+?\.name\s*=\s*"([^"]+)"/s,
    /const\s+NAME\s*=\s*"([^"]+)"/i,
    /exe\.setName\("([^"]+)"\)/,
  ];

  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
};

/**
 * Check build.zig.zon for dependencies section that might contain version info
 *
 * @param {string} content - File content
 * @returns {object|null} - Extracted name and version if found
 */
const parseZigZonFile = (content) => {
  try {
    // Very simplified parser for .zon files
    const nameMatch = content.match(/.name\s*=\s*"([^"]+)"/);
    const versionMatch = content.match(/.version\s*=\s*"([^"]+)"/);

    return {
      name: nameMatch ? nameMatch[1] : null,
      version: versionMatch ? versionMatch[1] : null,
    };
  } catch (error) {
    logging.error(`Error parsing build.zig.zon:`, error);
  }
};

/**
 * Updates a Zig project's version
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if the update was successful
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  const patterns = [
    [/version\s*=\s*"([^"]+)"/, `version = "${newVersion}"`],
    [/\.version\s*=\s*"([^"]+)"/, `.version = "${newVersion}"`],
    [/(const\s+VERSION\s*=\s*)"([^"]+)"/i, `$1"${newVersion}"`],
  ];

  for (const configPath of ZIG_VERSION_FILES) {
    const configFile = path.join(projectPath, configPath);
    if (await fs.pathExists(configFile)) {
      try {
        const content = await fs.readFile(configFile, 'utf8');

        for (const [pattern, replacement] of patterns) {
          if (pattern.test(content)) {
            await fs.writeFile(filePath, content.replace(pattern, replacement), 'utf8');
            return;
          }
        }
      } catch (error) {
        logging.error(`Failed to update Zig project version: ${error.message}`);
      }
    }
  }

  logging.error(`No version file found in the Zig project at ${projectPath}`);
};