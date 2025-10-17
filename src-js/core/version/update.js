import { log as logger } from '../version.js';
import * as detect from './detect.js';
import * as fileUtils from '../../utils/fs.js';
import { pinoErrorPrettier } from '../../utils/logging.js';

export const log = logger.child({ module: 'update' });

// Log message constants
export const warnNoVersionDetected = 'No version detected in file, skipping update';
export const warnFileNotFoundOrCouldNotBeRead = 'File not found or could not be read';
export const warnFailedToParseWithProvidedParser = 'Failed to parse file with provided parser';
export const warnNoMatchingVersionPatternFound = 'No matching version pattern found to update in file';
export const warnFailedToUpdate = 'Failed to update file';
export const warnNoUpdatersProvidedToUpdateAll = 'No updaters provided to updateAll';
export const warnNoFilesUpdated = 'No files updated';
export const warnNoUpdatersProvidedToUpdateFirst = 'No updaters provided to updateFirst';
export const warnFailedToUpdateVersion = 'Failed to update version';
export const warnUpdaterFunctionFailed = 'Updater function failed';
export const infoUpdatedVersion = 'Updated version in file';
export const infoUpdatedVersionInFiles = 'Updated version in files';
export const infoUpdatedVersionForProject = 'Updated version for project';

/**
 * @typedef {(string, string) => string|null} ValueUpdaterFunction
 * @typedef {[RegExp, string]|ValueUpdaterFunction} ValueUpdater
 */

/**
 * @typedef {Object} UpdateMapper
 * @property {function(string): any} parser - Function to parse file content
 * @property {function(any): string} serializer - Function to serialize data back to string
 * @property {ValueUpdater[]} version - Array of regex patterns or functions to update version
 */

/**
 * @typedef {Object} UpdateResult
 * @property {boolean} success - Whether the update was successful
 * @property {string} filePath - Path to the file that was updated
 * @property {string} [error] - Error message if update failed
 */

/**
 * @typedef {function(string): Promise<boolean>} FileUpdater
 */

/**
 * Converts ValueUpdater[] to ValueExtractor[] for use with configParser
 *
 * @param {ValueUpdater[]} updaters - Array of updaters
 * @returns {import('./detect.js').ValueExtractor[]} - Array of extractors
 */
function convertUpdatersToExtractors(updaters) {
  if (!Array.isArray(updaters)) {
    return [];
  }

  return updaters.map((updater) => {
    if (typeof updater === 'string') {
      // String path - same for both
      return updater;
    }
    if (Array.isArray(updater) && updater.length === 2) {
      // [RegExp, replacement] -> RegExp for extraction
      return updater[0];
    }
    if (typeof updater === 'function') {
      // Function updater -> function extractor (simplified)
      return (data) => {
        // Try to extract existing version using a simple regex
        const versionMatch = data.match(/["']?(\d+\.\d+\.\d+[^"'\s]*)["']?/);
        return versionMatch ? versionMatch[1] : null;
      };
    }
    // Fallback: return the updater as-is (should handle most cases)
    return updater;
  });
}

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
        return { success: pattern.test(data), newData };
      }
    }

    if (typeof updater === 'string') {
      // Handle object path like "version" or "project.version"
      if (parsedData && typeof parsedData === 'object') {
        const newParsedData = JSON.parse(JSON.stringify(parsedData)); // Deep clone
        const success = setNestedValue(newParsedData, updater, newValue);
        return { success, newParsedData };
      }
    }

    if (typeof updater === 'function') {
      try {
        const result = updater(data, newValue);
        return { success: result !== null && result !== undefined, newData: result };
      } catch (error) {
        log.warn({ ...pinoErrorPrettier(error) }, warnUpdaterFunctionFailed);
      }
    }

    return { success: false };
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

    return { success: false };
  };

  /**
   * The updater function that processes a file and updates the version
   *
   * @param {string} newVersion - New version to set
   * @returns {Promise<boolean>} - True if update was successful, false otherwise
   */
  return async (newVersion) => {
    // First, try to detect if the file has a version using converted mapper configuration
    const detector = detect.configParser(filePath, {
      parser: mapper.parser,
      version: convertUpdatersToExtractors(mapper.version),
      name: [], // We don't need name for update validation
    });

    const detectedInfo = await detector();
    if (!detectedInfo.version) {
      log.warn({ filePath }, warnNoVersionDetected);
      return false;
    }

    const data = await fileUtils.readFile(filePath);
    if (!data) {
      log.warn({ filePath }, warnFileNotFoundOrCouldNotBeRead);
      return false;
    }

    let parsedData = null;
    let newData = data;

    try {
      parsedData = mapper.parser(data);
    } catch (error) {
      log.warn({ filePath, ...pinoErrorPrettier(error) }, warnFailedToParseWithProvidedParser);
      return false;
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

        await fileUtils.writeFile(filePath, newData);
        log.info({ filePath, newVersion }, infoUpdatedVersion);
        return true;
      } else {
        log.warn({ filePath }, warnNoMatchingVersionPatternFound);
        return false;
      }
    } catch (error) {
      log.warn({ filePath, ...pinoErrorPrettier(error) }, warnFailedToUpdate);
      return false;
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
 * @returns {Promise<boolean>} - True if at least one file was updated successfully
 */
export async function updateAll(folderPath, projectType, newVersion, updaters = []) {
  if (updaters.length === 0) {
    log.warn({ folderPath, projectType }, warnNoUpdatersProvidedToUpdateAll);
    return false;
  }

  let successCount = 0;
  for (const updater of updaters) {
    const success = await updater(newVersion);
    if (success) {
      successCount++;
    }
  }

  if (successCount === 0) {
    log.warn({ folderPath, projectType }, warnNoFilesUpdated);
    return false;
  }

  log.info({ newVersion, successCount, totalFiles: updaters.length, projectType }, infoUpdatedVersionInFiles);
  return true;
}

/**
 * Function to update version in the first file that has a matching pattern
 *
 * @param {string} folderPath - Path to the project folder
 * @param {string} projectType - Type of the project (e.g., "deno", "rust")
 * @param {string} newVersion - New version to set
 * @param {FileUpdater[]} updaters - Array of updater functions
 * @returns {Promise<boolean>} - True if the first file was updated successfully
 */
export async function updateFirst(folderPath, projectType, newVersion, updaters = []) {
  if (updaters.length === 0) {
    log.warn({ folderPath, projectType }, warnNoUpdatersProvidedToUpdateFirst);
    return false;
  }

  const success = await updaters[0](newVersion);
  if (success) {
    log.info({ newVersion, projectType }, infoUpdatedVersionForProject);
  } else {
    log.warn({ projectType }, warnFailedToUpdateVersion);
  }
  return success;
}
