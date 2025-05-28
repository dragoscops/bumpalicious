import fs from 'fs/promises';
import {log as logger} from '../version.js';

export const log = logger.child({module: 'detect'});

// Log message constants
export const warnFailedToRead = 'Failed to read file';
export const warnFailedToParseWithProvidedParser = 'Failed to parse version file';
export const warnNoProvidedParsersToAggregator = 'No parsers provided to aggregator';
export const warnFailedToAggregateVersion = 'Failed to aggregate version';

/**
 * Safely reads a file from the filesystem
 *
 * @param {string} filePath - Path to the file to read
 * @returns {Promise<string|null>} Content of the file or null if the file doesn't exist
 */
export const forMock = {
  readFile: async (filePath) => {
    try {
      await fs.access(filePath);
      return fs.readFile(filePath, 'utf8');
    } catch (error) {
      log.warn({filePath, error}, warnFailedToRead);
    }
  },
};

/**
 * @typedef {(string) => string|null} ValueExtractorFunction
 * @typedef {string|RegExp|ValueExtractorFunction} ValueExtractor
 */

/**
 * @typedef {Object} ConfigMapper
 * @property {function(string): any} parser - Function to parse file content
 * @property {ValueExtractor[]} version - Array of paths or regex to extract version
 * @property {ValueExtractor[]} name - Array of paths or regex to extract name
 */

/**
 * @typedef {Object} ProjectInfo
 * @property {string|null} version - Detected project version
 * @property {string|null} name - Detected project name
 */

/**
 * @typedef {function(): Promise<ProjectInfo>} FileParser
 */

/**
 * Creates a file parser function based on provided mapping configuration
 *
 * @param {string} filePath - Path to the file to parse
 * @param {ConfigMapper} mapper - Configuration for parsing the file
 * @returns {FileParser} - File parser function
 */
export function configParser(
  filePath,
  mapper = {
    parser: JSON.parse,
    version: ['version'],
    name: ['name'],
  },
) {
  /**
   * Helper function to navigate object paths like "project.version"
   *
   * @param {Object} obj - Object to navigate
   * @param {string} path - Dot-notation path
   * @returns {any|null} - Value at the path or null
   */
  const getNestedValue = (obj, path) => {
    const keys = path.split('.');
    return keys.reduce((o, key) => (o?.[key] !== undefined ? o[key] : null), obj);
  };

  /**
   * Processes a single extractor to get a value
   *
   * @param {string} data - Raw file content
   * @param {any} parsedData - Parsed file content
   * @param {ValueExtractor} extractor - A path, regex, or function extractor
   * @returns {string|null} - Extracted value or null
   */
  const processExtractor = (data, parsedData, extractor) => {
    if (typeof extractor === 'string') {
      return getNestedValue(parsedData, extractor);
    }

    if (extractor instanceof RegExp) {
      const match = extractor.exec(data);
      return match?.[1] ?? null;
    }

    if (typeof extractor === 'function') {
      try {
        return extractor(data) ?? null;
      } catch (error) {
        console.debug('Extractor function failed:', error);
      }
    }

    return null;
  };

  /**
   * Extract value using array of ValueExtractors
   *
   * @param {string} data - Raw file content
   * @param {any} parsedData - Parsed file content
   * @param {ValueExtractor[]} extractors - Array of paths, regexes, or functions
   * @returns {string|null} - Extracted value or null
   */
  const extractValue = (data, parsedData, extractors) => {
    const extractorArray = Array.isArray(extractors) ? extractors : [extractors];

    for (const extractor of extractorArray) {
      const value = processExtractor(data, parsedData, extractor);
      if (value) return value;
    }

    return null;
  };

  /**
   * The parser function that processes a file and extracts project info
   *
   * @param {string} filePath - Path to the file to parse
   * @returns {Promise<ProjectInfo|null>} - Project information or null if file can't be read
   */
  return async () => {
    const data = await forMock.readFile(filePath);
    if (!data) {
      return {version: null, name: null}; // Return empty project info instead of null
    }

    let version = null;
    let name = null;
    let parsedData = null;

    try {
      parsedData = mapper.parser(data);
    } catch (error) {
      log.warn({filePath, error}, warnFailedToParseWithProvidedParser);
      return {version, name};
    }

    try {
      // Extract version and name using helper functions
      version = extractValue(data, parsedData, mapper.version);
      name = extractValue(data, parsedData, mapper.name);
    } catch (error) {
      log.warn({filePath, error}, warnFailedToParseWithProvidedParser);
    }

    return {version, name};
  };
}

/**
 * Function to aggregate multiple file parsers; first one to return a valid version and name is used
 *
 * @param {string} folderPath - Path to the project folder
 * @param {string} projectType - Type of the project (e.g., "deno", "rust")
 * @param {FileParser[]} parsers - Array of parser functions
 * @returns {Promise<ProjectInfo>} - Project information
 */
export async function anyOf(folderPath, projectType, parsers = []) {
  if (parsers.length === 0) {
    log.warn({folderPath, projectType, aggregator: 'anyOf'}, warnNoProvidedParsersToAggregator);
    return {version: null, name: null};
  }
  for (const parser of parsers) {
    const projectInfo = await parser();
    if (projectInfo.version && projectInfo.name) {
      return projectInfo;
    }
  }

  log.warn({folderPath, projectType, aggregator: 'anyOf'}, warnFailedToAggregateVersion);
  return {version: null, name: null};
}

/**
 * Function to aggregate multiple file parsers; will merge the results
 *
 * @param {string} folderPath - Path to the project folder
 * @param {string} projectType - Type of the project (e.g., "deno", "rust")
 * @param {FileParser[]} parsers - Array of parser functions
 * @returns {Promise<ProjectInfo>} - Project information
 */
export async function merge(folderPath, projectType, parsers = []) {
  if (parsers.length === 0) {
    log.warn({folderPath, projectType, aggregator: 'merge'}, warnNoProvidedParsersToAggregator);
    return {version: null, name: null};
  }
  const projectInfo = {
    version: null,
    name: null,
  };

  for (const parser of parsers) {
    const parsedInfo = await parser();
    if (parsedInfo.version) {
      projectInfo.version = parsedInfo.version;
    }
    if (parsedInfo.name) {
      projectInfo.name = parsedInfo.name;
    }
  }

  if (projectInfo.version && projectInfo.name) {
    return projectInfo;
  }

  log.warn({folderPath, projectType, aggregator: 'merge'}, warnFailedToAggregateVersion);
  return {version: null, name: null};
}
