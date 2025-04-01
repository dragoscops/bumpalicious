/**
 * Deno project version update functionality
 * @module update/deno
 */

import fs from 'fs-extra';
import path from 'path';
import {DENO_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

const updateVersionJsonc = async ({projectPath, newVersion}) => {
  const denoJsoncPath = path.join(projectPath, 'deno.jsonc');
  let updatedContent = '';
  // Read as string first
  const content = await fs.readFile(denoJsoncPath, 'utf8');
  try {
    // Simple comment stripping - remove lines starting with //
    const noComments = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    // Parse the JSON
    const denoConfig = JSON.parse(noComments);

    // Update the version
    denoConfig.version = newVersion;
    updatedContent = JSON.stringify(denoConfig, null, 2);
  } catch (error) {
    logging.error(`Failed to update Deno project version: ${error.message}`);
  }

  if (!updatedContent) {
    if (content.includes('"version"') || content.includes('"version":')) {
      // Replace the version in the original content
      updatedContent = content.replace(/"version"\s*:\s*"[^"]*"/g, `"version": "${newVersion}"`);
    } else {
      // If version key doesn't exist yet, add it after the first {
      updatedContent = content.replace('{', `{\n  "version": "${newVersion}",`);
    }
  }
  await fs.writeFile(denoJsoncPath, updatedContent);
};

/**
 * Update version in a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  // First check for deno.jsonc (JSON with comments)
  const denoJsoncPath = path.join(projectPath, 'deno.jsonc');
  if (await fs.pathExists(denoJsoncPath)) {
    return updateVersionJsonc({projectPath, newVersion});
  }

  for (const file of DENO_VERSION_FILES) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      try {
        const config = await fs.readJson(filePath);
        config.version = newVersion;
        await fs.writeJson(filePath, config, {spaces: 2});
        return;
      } catch (error) {
        logging.error(`Failed to update Deno project version: ${error.message}`);
      }
    }
  }

  logging.error(`No version file found in the Deno project at ${projectPath}`);
};
