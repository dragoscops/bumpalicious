/**
 * Text-based project version and name detection
 * @module detect/text
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * List of potential version file names to check
 */
const VERSION_FILES = [
  'version',
  'VERSION',
  'version.txt',
  'VERSION.txt'
];

/**
 * Detect version from a text-based project
 * Looking for version or VERSION files
 * 
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectTextVersion = async () => {
  // Check each possible version file
  for (const versionFile of VERSION_FILES) {
    if (await fs.pathExists(versionFile)) {
      const content = await fs.readFile(versionFile, 'utf8');
      const version = content.trim();
      if (version) {
        return version;
      }
    }
  }
  
  // Try to find version in git tags
  try {
    const { execa } = await import('execa');
    const { stdout } = await execa('git', ['describe', '--tags', '--abbrev=0']);
    if (stdout.trim()) {
      return stdout.trim().replace(/^v/, '');
    }
  } catch (error) {
    // Ignore errors - git tags might not exist
  }
  
  throw new Error('Could not detect version in text project');
};

/**
 * Detect name from a text-based project
 * Using directory name as project name
 * 
 * @returns {Promise<string>} - Detected name (directory name)
 */
export const detectTextName = async () => {
  // For text projects, we use the directory name as the project name
  return path.basename(process.cwd());
};