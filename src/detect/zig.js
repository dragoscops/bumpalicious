/**
 * Zig project version and name detection
 * @module detect/zig
 */

import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';

/**
 * List of potential configuration files to check
 */
const CONFIG_FILES = ['build.zig', 'build.zig.zon'];

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

  return null;
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
    console.error('Error parsing build.zig.zon:', error);
    return null;
  }
};

/**
 * Detect version from a Zig project
 * Looking for build.zig and build.zig.zon files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  // First check build.zig.zon which is more likely to contain version info
  const zonPath = path.join(projectPath, 'build.zig.zon');
  if (await fs.pathExists(zonPath)) {
    const content = await fs.readFile(zonPath, 'utf8');
    const zonData = parseZigZonFile(content);
    if (zonData && zonData.version) {
      return zonData.version;
    }
  }

  // Then check build.zig
  const buildPath = path.join(projectPath, 'build.zig');
  if (await fs.pathExists(buildPath)) {
    const content = await fs.readFile(buildPath, 'utf8');
    const version = extractVersionFromZigContent(content);
    if (version) {
      return version;
    }
  }

  // Try to detect version using zig-version utility if it exists
  try {
    const {stdout} = await execa('zig', ['version'], {cwd: projectPath});
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // Ignore errors if zig command fails
  }

  throw new Error('Could not detect version in Zig project');
};

/**
 * Detect name from a Zig project
 * Looking for build.zig and build.zig.zon files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  // First check build.zig.zon which is more likely to contain name info
  const zonPath = path.join(projectPath, 'build.zig.zon');
  if (await fs.pathExists(zonPath)) {
    const content = await fs.readFile(zonPath, 'utf8');
    const zonData = parseZigZonFile(content);
    if (zonData && zonData.name) {
      return zonData.name;
    }
  }

  // Then check build.zig
  const buildPath = path.join(projectPath, 'build.zig');
  if (await fs.pathExists(buildPath)) {
    const content = await fs.readFile(buildPath, 'utf8');
    const name = extractNameFromZigContent(content);
    if (name) {
      return name;
    }
  }

  // Fall back to directory name
  return path.basename(path.normalize(projectPath));
};
