/**
 * Zig project version and name detection
 * @module detect/zig
 */

import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';
import * as logging from '../utils/logging.js';
import {DEFAULT_VERSION, ZIG_VERSION_FILES} from './constants.js';

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
  // Initialize with default values
  const defaultName = path.basename(projectPath);
  let buildName = null;
  let buildVersion = null;
  let zonName = null;
  let zonVersion = null;
  let buildExists = false;
  let zonExists = false;

  // Check build.zig file
  const buildPath = path.join(projectPath, 'build.zig');
  try {
    await fs.access(buildPath);
    buildExists = true;
    const content = await fs.readFile(buildPath, 'utf8');
    buildName = extractNameFromZigContent(content);
    buildVersion = extractVersionFromZigContent(content);
    logging.debug(`Found build.zig with name: ${buildName}, version: ${buildVersion}`);
  } catch (error) {
    logging.warning(`Unable to find or parse build.zig:`, error);
  }

  // Check build.zig.zon file
  const zonPath = path.join(projectPath, 'build.zig.zon');
  try {
    await fs.access(zonPath);
    zonExists = true;
    const content = await fs.readFile(zonPath, 'utf8');
    const zonData = parseZigZonFile(content);
    zonName = zonData?.name;
    zonVersion = zonData?.version;
    logging.debug(`Found build.zig.zon with name: ${zonName}, version: ${zonVersion}`);
  } catch (error) {
    logging.warning(`Unable to find or parse build.zig.zon:`, error);
  }

  // Determine final values with explicit precedence rules
  // For project name: prefer .zon name, then build.zig name, then directory name
  // For version: prefer .zon version, then build.zig version, then default
  const name = isValidString(zonName) ? zonName : isValidString(buildName) ? buildName : defaultName;

  const version = isValidString(zonVersion) ? zonVersion : isValidString(buildVersion) ? buildVersion : DEFAULT_VERSION;

  // Log useful debug info about which values were selected
  if (buildExists || zonExists) {
    logging.debug(`Selected Zig project name: ${name}, version: ${version}`);
    if (buildExists && zonExists && buildName !== zonName) {
      logging.warning(`Different names in build.zig (${buildName}) and build.zig.zon (${zonName})`);
    }
    if (buildExists && zonExists && buildVersion !== zonVersion) {
      logging.warning(`Different versions in build.zig (${buildVersion}) and build.zig.zon (${zonVersion})`);
    }
  }

  return {
    name,
    version,
  };
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
/**
 * Helper function to check if a string is valid (not null, undefined, or empty)
 *
 * @param {string|null|undefined} str - String to check
 * @returns {boolean} - True if the string is valid
 */
const isValidString = (str) => {
  return str !== null && str !== undefined && str !== '';
};

export const updateVersion = async ({projectPath, newVersion}) => {
  const patterns = [
    [/version\s*=\s*"([^"]+)"/, `version = "${newVersion}"`],
    [/\.version\s*=\s*"([^"]+)"/, `.version = "${newVersion}"`],
    [/(const\s+VERSION\s*=\s*)"([^"]+)"/i, `$1"${newVersion}"`],
  ];

  let updateSuccessful = false;
  const updatedFiles = [];

  // Update build.zig.zon if it exists
  const zonPath = path.join(projectPath, 'build.zig.zon');
  if (await fs.pathExists(zonPath)) {
    try {
      const content = await fs.readFile(zonPath, 'utf8');
      let updatedContent = content;

      for (const [pattern, replacement] of patterns) {
        if (pattern.test(content)) {
          updatedContent = content.replace(pattern, replacement);
          await fs.writeFile(zonPath, updatedContent, 'utf8');
          updateSuccessful = true;
          updatedFiles.push('build.zig.zon');
          logging.debug(`Updated version in build.zig.zon to ${newVersion}`);
          break;
        }
      }

      if (content === updatedContent) {
        logging.warning(`Could not find version pattern to update in build.zig.zon`);
      }
    } catch (error) {
      logging.error(`Failed to update version in build.zig.zon: ${error.message}`);
    }
  }

  // Update build.zig if it exists
  const buildPath = path.join(projectPath, 'build.zig');
  if (await fs.pathExists(buildPath)) {
    try {
      const content = await fs.readFile(buildPath, 'utf8');
      let updatedContent = content;

      for (const [pattern, replacement] of patterns) {
        if (pattern.test(content)) {
          updatedContent = content.replace(pattern, replacement);
          await fs.writeFile(buildPath, updatedContent, 'utf8');
          updateSuccessful = true;
          updatedFiles.push('build.zig');
          logging.debug(`Updated version in build.zig to ${newVersion}`);
          break;
        }
      }

      if (content === updatedContent) {
        logging.warning(`Could not find version pattern to update in build.zig`);
      }
    } catch (error) {
      logging.error(`Failed to update version in build.zig: ${error.message}`);
    }
  }

  if (updateSuccessful) {
    logging.info(`Updated Zig project version to ${newVersion} in: ${updatedFiles.join(', ')}`);
    return true;
  } else {
    logging.error(`No version file found or could not update version in the Zig project at ${projectPath}`);
    return false;
  }
};
