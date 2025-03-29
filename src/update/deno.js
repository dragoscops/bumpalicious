/**
 * Deno project version update functionality
 * @module update/deno
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Update version in a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 * 
 * @param {string} version - New version to set
 * @returns {Promise<void>}
 * @throws {Error} - If version update fails
 */
export const updateDenoVersion = async (version) => {
  let updated = false;

  // Update deno.json if it exists
  if (await fs.pathExists('deno.json')) {
    try {
      const denoConfig = await fs.readJson('deno.json');
      denoConfig.version = version;
      await fs.writeJson('deno.json', denoConfig, { spaces: 2 });
      console.log(`Updated version in deno.json to ${version}`);
      updated = true;
    } catch (error) {
      console.error('Error updating deno.json:', error);
      throw error;
    }
  }
  
  // Update deno.jsonc if it exists
  if (await fs.pathExists('deno.jsonc')) {
    try {
      // Read as string first
      const content = await fs.readFile('deno.jsonc', 'utf8');
      
      // Simple comment stripping - remove lines starting with //
      const noComments = content.split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n');
      
      try {
        // Parse the JSON
        const denoConfig = JSON.parse(noComments);
        denoConfig.version = version;
        
        // Write back with comments preserved if possible
        let updatedContent;
        
        if (content.includes('"version"') || content.includes('"version":')) {
          // Replace the version in the original content
          updatedContent = content.replace(
            /"version"\s*:\s*"[^"]*"/g,
            `"version": "${version}"`
          );
        } else {
          // If version key doesn't exist yet, add it after the first {
          updatedContent = content.replace(
            '{',
            `{\n  "version": "${version}",`
          );
        }
        
        await fs.writeFile('deno.jsonc', updatedContent);
        console.log(`Updated version in deno.jsonc to ${version}`);
        updated = true;
      } catch (parseError) {
        console.error('Error parsing deno.jsonc:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error('Error updating deno.jsonc:', error);
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
  
  // Update package.json if it exists (some Deno projects use it too)
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
  
  if (!updated) {
    throw new Error('No version files found to update in Deno project');
  }
};