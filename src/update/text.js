const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Update version in a plain text file
 * @param {string} filePath - Path to the file
 * @param {string} newVersion - New version to set
 * @returns {boolean} - Success status
 */
async function updateTextVersion(filePath, newVersion) {
  try {
    logger.info(`Updating text version file: ${filePath}`);
    
    // Simply write the new version to the file
    fs.writeFileSync(filePath, newVersion, 'utf8');
    
    logger.success(`Successfully updated ${path.basename(filePath)} to version ${newVersion}`);
    return true;
  } catch (error) {
    logger.error(`Failed to update text file ${filePath}: ${error.message}`);
    return false;
  }
}

module.exports = {
  updateTextVersion
};