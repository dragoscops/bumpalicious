import fs from 'fs/promises';
import * as logging from '../../utils/logging.js';
import * as detect from './detect.js';

/**
 * Safely writes content to a file
 *
 * @param {string} filePath - Path to the file to write
 * @param {string} content - Content to write to the file
 */
export const forMock = {
  writeFile: async (filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      logging.error(`Failed to write ${filePath}:`, error);
    }
  },
  readFile: detect.forMock.readFile,
};

/**
 * @typedef {(string, string) => string|null} ValueUpdaterFunction
 * @typedef {[RegExp, string]|ValueUpdaterFunction} ValueUpdater
 */

/**
 * @typedef {Object} UpdateMapper
 * @property {function(string): any} parser - Function to parse file content
 * @property {function(any): string} serializer - Function to serialize data back to string
 * @property {ValueUpdater[]} version - Array of regex patterns or functions to update version
 * @property {ValueUpdater[]} [name] - Array of regex patterns or functions to update name (optional)
 */

/**
 * @typedef {Object} UpdateResult
 * @property {boolean} success - Whether the update was successful
 * @property {string} filePath - Path to the file that was updated
 * @property {string} [error] - Error message if update failed
 */

/**
 * @typedef {function(string): Promise<UpdateResult>} FileUpdater
 */

/**
 * Creates a file updater function based on provided mapping configuration
 *
 * @param {string} filePath - Path to the file to update
 * @param {UpdateMapper} mapper - Configuration for updating the file
 * @returns {FileUpdater} - File updater function
 */
export function configUpdater(
  filePath,
  mapper = {
    parser: JSON.parse,
    serializer: (data) => JSON.stringify(data, null, 2),
    version: [],
    name: [],
  },
) {
  /**
   * Helper function to set nested object values like "project.version"
   *
   * @param {Object} obj - Object to modify
   * @param {string} path - Dot-notation path
   * @param {string} value - New value to set
   * @returns {boolean} - True if value was set successfully
   */
  const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((o, key) => {
      if (!o[key]) o[key] = {};
      return o[key];
    }, obj);

    if (target && lastKey) {
      target[lastKey] = value;
      return true;
    }
    return false;
  };

  /**
   * Processes a single updater to modify content
   *
   * @param {string} data - Raw file content
   * @param {any} parsedData - Parsed file content
   * @param {ValueUpdater} updater - A regex pattern or function updater
   * @param {string} newValue - New value to set
   * @returns {Object} - {success: boolean, newData?: string, newParsedData?: any}
   */
  const processUpdater = (data, parsedData, updater, newValue) => {
    if (Array.isArray(updater) && updater.length === 2) {
      // Handle [RegExp, replacement] pattern
      const [pattern, replacement] = updater;
      if (pattern instanceof RegExp) {
        const newData = data.replace(pattern, replacement.replace('$VERSION', newValue));
        return {success: pattern.test(data), newData};
      }
    }

    if (typeof updater === 'string') {
      // Handle object path like "version" or "project.version"
      if (parsedData && typeof parsedData === 'object') {
        const newParsedData = JSON.parse(JSON.stringify(parsedData)); // Deep clone
        const success = setNestedValue(newParsedData, updater, newValue);
        return {success, newParsedData};
      }
    }

    if (typeof updater === 'function') {
      try {
        const result = updater(data, newValue);
        return {success: result !== null && result !== undefined, newData: result};
      } catch (error) {
        logging.warning('Updater function failed:', error);
      }
    }

    return {success: false};
  };

  /**
   * Update value using array of ValueUpdaters
   *
   * @param {string} data - Raw file content
   * @param {any} parsedData - Parsed file content
   * @param {ValueUpdater[]} updaters - Array of regex patterns or functions
   * @param {string} newValue - New value to set
   * @returns {Object} - {success: boolean, newData?: string, newParsedData?: any}
   */
  const updateValue = (data, parsedData, updaters, newValue) => {
    const updaterArray = Array.isArray(updaters) ? updaters : [updaters];

    for (const updater of updaterArray) {
      const result = processUpdater(data, parsedData, updater, newValue);
      if (result.success) {
        return result;
      }
    }

    return {success: false};
  };

  /**
   * The updater function that processes a file and updates the version
   *
   * @param {string} newVersion - New version to set
   * @returns {Promise<UpdateResult>} - Update result
   */
  return async (newVersion) => {
    const data = await forMock.readFile(filePath);
    if (!data) {
      return {
        success: false,
        filePath,
        error: 'File not found or could not be read',
      };
    }

    let parsedData = null;
    let newData = data;

    try {
      parsedData = mapper.parser(data);
    } catch (e) {
      logging.warning(`Failed to parse ${filePath} with provided parser:`, e);
      // Continue with raw data for regex-based updates
    }

    try {
      // Try to update version
      const versionResult = updateValue(data, parsedData, mapper.version, newVersion);

      if (versionResult.success) {
        if (versionResult.newData) {
          newData = versionResult.newData;
        } else if (versionResult.newParsedData) {
          newData = mapper.serializer(versionResult.newParsedData);
        }

        const writeSuccess = await forMock.writeFile(filePath, newData);
        if (writeSuccess) {
          logging.info(`Updated version to ${newVersion} in ${filePath}`);
          return {
            success: true,
            filePath,
          };
        } else {
          return {
            success: false,
            filePath,
            error: 'Failed to write updated content to file',
          };
        }
      } else {
        return {
          success: false,
          filePath,
          error: 'No matching version pattern found to update',
        };
      }
    } catch (error) {
      logging.error(`Failed to update ${filePath}:`, error);
      return {
        success: false,
        filePath,
        error: error.message,
      };
    }
  };
}

/**
 * Function to update version in multiple files; updates all files that have matching patterns
 *
 * @param {string} folderPath - Path to the project folder
 * @param {string} projectType - Type of the project (e.g., "deno", "rust")
 * @param {string} newVersion - New version to set
 * @param {FileUpdater[]} updaters - Array of updater functions
 * @returns {Promise<UpdateResult[]>} - Array of update results
 */
export async function updateAll(folderPath, projectType, newVersion, updaters = []) {
  if (updaters.length === 0) {
    logging.error(`No updaters provided to updateAll for ${projectType} project in ${folderPath}`);
    return [];
  }

  const results = [];
  let successCount = 0;

  for (const updater of updaters) {
    const result = await updater(newVersion);
    results.push(result);
    if (result.success) {
      successCount++;
    }
  }

  if (successCount > 0) {
    logging.info(
      `Updated version to ${newVersion} in ${successCount}/${results.length} files for ${projectType} project`,
    );
  } else {
    logging.error(`Failed to update version in any files for ${projectType} project in ${folderPath}`);
  }

  return results;
}

/**
 * Function to update version in the first file that has a matching pattern
 *
 * @param {string} folderPath - Path to the project folder
 * @param {string} projectType - Type of the project (e.g., "deno", "rust")
 * @param {string} newVersion - New version to set
 * @param {FileUpdater[]} updaters - Array of updater functions
 * @returns {Promise<UpdateResult|null>} - Update result or null if no files were updated
 */
export async function updateFirst(folderPath, projectType, newVersion, updaters = []) {
  if (updaters.length === 0) {
    logging.error(`No updaters provided to updateFirst for ${projectType} project in ${folderPath}`);
    return null;
  }

  for (const updater of updaters) {
    const result = await updater(newVersion);
    if (result.success) {
      logging.info(`Updated version to ${newVersion} for ${projectType} project in ${result.filePath}`);
      return result;
    }
  }

  logging.error(`Failed to update version for ${projectType} project in ${folderPath}`);
  return null;
}
