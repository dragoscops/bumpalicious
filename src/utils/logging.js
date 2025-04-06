import * as core from '@actions/core';

/**
 * Logging utilities for consistent output formatting
 * @module utils/logging
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

// Determine if running in GitHub Actions environment
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

/**
 * Format text with ANSI color codes (only in non-GitHub Actions environment)
 *
 * @param {string} text - Text to colorize
 * @param {string} color - Color name
 * @returns {string} - Colorized text
 */
const colorize = (text, color) => {
  if (isGitHubActions) {
    return text;
  }
  return `${colors[color] || ''}${text}${colors.reset}`;
};

/**
 * Format workspace info as a string
 *
 * @param {Object} workspace - Workspace information
 * @returns {string} - Formatted workspace string
 */
export const formatWorkspace = (workspace) => {
  const name = colorize(workspace.name, 'bold');
  const version = colorize(workspace.version, 'green');
  const type = colorize(workspace.type, 'cyan');
  return `${name} [${type}] @ ${version}`;
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 * @param {any[]} args - Additional arguments to log
 */
export const debug = (message, ...args) => {
  if (isGitHubActions) {
    core.debug(message,);
    return console.log(...args);
  }
  console.log(`${colorize('DEBUG:', 'blue')} ${message}`, ...args);
};

/**
 * Log an error message
 *
 * @param {string} message - Message to log
 */
export const error = (message, ...args) => {
  const [error, ...rest] = args;
  if (isGitHubActions) {
    core.error(`${message}${error ? ': ' + error.message : ''}`);
    console.log(...(error instanceof Error ? rest : args));
  } else {
    console.error(`${colorize('ERROR:', 'red')} ${message}`, ...(error instanceof Error ? rest : args));
  }
  if (error) {
    if (error.stack) {
      console.error(colorize(error.stack, 'red'));
    } else {
      console.error(colorize(String(error), 'red'));
    }
  }
  process.exit(1);
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 */
export const info = (message, ...args) => {
  if (isGitHubActions) {
    core.info(message);
    return console.log(...args);
  }
  console.log(`${colorize('INFO:', 'blue')} ${message}`, ...args);
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 */
export const notice = (message, ...args) => {
  if (isGitHubActions) {
    core.notice(message);
    return console.log(...args);
  }
  console.log(`${colorize('NOTICE:', 'blue')} ${message}`, ...args);
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 */
export const warning = (message, ...args) => {
  if (isGitHubActions) {
    core.warning(message);
    return console.log(...args);
  }
  console.log(`${colorize('WARNING:', 'blue')} ${message}`, ...args);
};


/**
 * Log a section header
 *
 * @param {string} title - Section title
 */
export const startGroup = (title) => {
  if (isGitHubActions) {
    return core.startGroup(title);
  }

  const line = '='.repeat(title.length + 8);
  console.log('\n' + colorize(line, 'magenta'));
  console.log(colorize(`=== ${title} ===`, 'magenta'));
  console.log(colorize(line, 'magenta') + '\n');
};

/**
 * End a section (only relevant for GitHub Actions)
 */
export const endGroup = () => {
  if (isGitHubActions) {
    return core.endGroup();
  }
};
