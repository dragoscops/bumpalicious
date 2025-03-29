/**
 * Go project version update functionality
 * @module update/go
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Update version in a Go project
 * Since Go doesn't have a standard version file like other languages,
 * we create a version.txt file in the root of the project.
 * 
 * @param {string} version - New version to set
 * @returns {Promise<void>}
 */
export const updateGoVersion = async (version) => {
  try {
    // Create or update version.txt
    await fs.writeFile('version.txt', version);
    console.log(`Updated version in version.txt to ${version}`);
    
    // If we have a constants file with version information, update it too
    const potentialFiles = [
      'version.go',
      'pkg/version/version.go',
      'internal/version/version.go',
      'cmd/version.go',
    ];
    
    for (const file of potentialFiles) {
      if (await fs.pathExists(file)) {
        const content = await fs.readFile(file, 'utf8');
        
        // Look for version constants
        if (content.includes('Version') || content.includes('version')) {
          let updatedContent = content;
          
          // Various patterns for defining version constants in Go
          updatedContent = updatedContent.replace(
            /(const|var)\s+Version\s*=\s*["']([^"']*)["']/g,
            `$1 Version = "${version}"`
          );
          
          updatedContent = updatedContent.replace(
            /(const|var)\s+version\s*=\s*["']([^"']*)["']/g,
            `$1 version = "${version}"`
          );
          
          // Version function that returns a string constant
          updatedContent = updatedContent.replace(
            /func\s+Version\(\)\s*string\s*{\s*return\s*["']([^"']*)["']\s*}/g,
            `func Version() string { return "${version}" }`
          );
          
          if (updatedContent !== content) {
            await fs.writeFile(file, updatedContent);
            console.log(`Updated version in ${file} to ${version}`);
          }
        }
      }
    }
    
    return;
  } catch (error) {
    console.error('Error updating Go version:', error);
    throw error;
  }
};