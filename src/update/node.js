/**
 * Node.js project version update functionality
 * @module update/node
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Update version in a Node.js project
 * Looking for package.json or jsr.json files
 * 
 * @param {string} version - New version to set
 * @returns {Promise<void>}
 * @throws {Error} - If version update fails
 */
export const updateNodeVersion = async (version) => {
  let updated = false;

  // Update package.json if it exists
  if (await fs.pathExists('package.json')) {
    try {
      const pkg = await fs.readJson('package.json');
      pkg.version = version;
      await fs.writeJson('package.json', pkg, { spaces: 2 });
      console.log(`Updated version in package.json to ${version}`);
      updated = true;
    } catch (error) {
      console.error('Error updating package.json:', error);
      throw error;
    }
  }
  
  // Update jsr.json if it exists
  if (await fs.pathExists('jsr.json')) {
    try {
      const jsr = await fs.readJson('jsr.json');
      jsr.version = version;
      await fs.writeJson('jsr.json', jsr, { spaces: 2 });
      console.log(`Updated version in jsr.json to ${version}`);
      updated = true;
    } catch (error) {
      console.error('Error updating jsr.json:', error);
      throw error;
    }
  }
  
  if (!updated) {
    throw new Error('No version files found to update in Node.js project');
  }
};