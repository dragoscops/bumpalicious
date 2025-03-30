/**
 * Deno project version update functionality
 * @module update/deno
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';

/**
 * Update version in a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if the update was successful
 * @throws {Error} - If version update fails
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  try {
    let updated = false;

    // Update deno.json if it exists
    const denoJsonPath = path.join(projectPath, 'deno.json');
    if (await fs.pathExists(denoJsonPath)) {
      try {
        const denoConfig = await fs.readJson(denoJsonPath);
        denoConfig.version = newVersion;
        await fs.writeJson(denoJsonPath, denoConfig, {spaces: 2});
        logging.success(`Updated version in deno.json to ${newVersion}`);
        updated = true;
      } catch (error) {
        logging.error('Error updating deno.json:', error);
      }
    }

    // Update deno.jsonc if it exists
    const denoJsoncPath = path.join(projectPath, 'deno.jsonc');
    if (await fs.pathExists(denoJsoncPath)) {
      try {
        // Read as string first
        const content = await fs.readFile(denoJsoncPath, 'utf8');

        // Simple comment stripping - remove lines starting with //
        const noComments = content
          .split('\n')
          .filter((line) => !line.trim().startsWith('//'))
          .join('\n');

        try {
          // Parse the JSON
          const denoConfig = JSON.parse(noComments);
          denoConfig.version = newVersion;

          // Write back with comments preserved if possible
          let updatedContent;

          if (content.includes('"version"') || content.includes('"version":')) {
            // Replace the version in the original content
            updatedContent = content.replace(/"version"\s*:\s*"[^"]*"/g, `"version": "${newVersion}"`);
          } else {
            // If version key doesn't exist yet, add it after the first {
            updatedContent = content.replace('{', `{\n  "version": "${newVersion}",`);
          }

          await fs.writeFile(denoJsoncPath, updatedContent);
          logging.success(`Updated version in deno.jsonc to ${newVersion}`);
          updated = true;
        } catch (parseError) {
          logging.error('Error parsing deno.jsonc:', parseError);
        }
      } catch (error) {
        logging.error('Error updating deno.jsonc:', error);
      }
    }

    // Update jsr.json if it exists
    const jsrJsonPath = path.join(projectPath, 'jsr.json');
    if (await fs.pathExists(jsrJsonPath)) {
      try {
        const jsr = await fs.readJson(jsrJsonPath);
        jsr.version = newVersion;
        await fs.writeJson(jsrJsonPath, jsr, {spaces: 2});
        logging.success(`Updated version in jsr.json to ${newVersion}`);
        updated = true;
      } catch (error) {
        logging.error('Error updating jsr.json:', error);
      }
    }

    // Update package.json if it exists (some Deno projects use it too)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const pkg = await fs.readJson(packageJsonPath);
        pkg.version = newVersion;
        await fs.writeJson(packageJsonPath, pkg, {spaces: 2});
        logging.success(`Updated version in package.json to ${newVersion}`);
        updated = true;
      } catch (error) {
        logging.error('Error updating package.json:', error);
      }
    }

    if (!updated) {
      // If no files were updated, create a version file
      const versionFilePath = path.join(projectPath, 'version');
      await fs.writeFile(versionFilePath, newVersion, 'utf8');
      logging.success(`Created version file with version ${newVersion}`);
      updated = true;
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update Deno project version: ${error.message}`);
    throw error;
  }
};
