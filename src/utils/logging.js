import core from '@actions/core';

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

export const clabels = {
  debug: 'DEBUG:',
  error: 'ERROR:',
  info: 'INFO:',
  notice: 'NOTICE:',
  warning: 'WARNING:',
};

export const cconsole = {
  debug: console.log,
  error: console.error,
  info: console.info,
  notice: console.info,
  warning: console.warn,
  startGroup: console.log,
};

/**
 * Format text with ANSI color codes (only in non-GitHub Actions environment)
 *
 * @param {string} text - Text to colorize
 * @param {string} color - Color name
 * @returns {string} - Colorized text
 */
const colorize = (text, color) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
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
export const debug = (...args) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
    core.debug(args[0]);
    return args.length > 1 ? cconsole.debug(...args.slice(1)) : null;
  }
  cconsole.debug(colorize(clabels.debug, 'white'), ...args);
};

/**
 * Log an error message
 *
 * @param {string} message - Message to log
 */
export const error = (...args) => {
  const [message, error, ...rest] = args;
  if (process.env.GITHUB_ACTIONS === 'true') {
    core.error(`${message}${error ? ': ' + error.message : ''}`);
    if (args.length > 1) {
      cconsole.error(...(error instanceof Error ? rest : args.slice(1)));
    }
  } else {
    cconsole.error(colorize(clabels.error, 'red'), ...args);
  }
  if (error) {
    if (error.stack) {
      cconsole.error(colorize(error.stack, 'red'));
    } else {
      cconsole.error(colorize(String(error), 'red'));
    }
  }
  while (openedGroups > 0) {
    endGroup();
    openedGroups--;
  }
  process.exit(1);
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 */
export const info = (...args) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
    core.info(args[0]);
    return args.length > 1 ? cconsole.info(...args.slice(1)) : null;
  }
  cconsole.info(colorize(clabels.info, 'green'), ...args);
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 */
export const notice = (...args) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
    core.notice(args[0]);
    return args.length > 1 ? cconsole.notice(...args.slice(1)) : null;
  }
  cconsole.notice(colorize(clabels.notice, 'blue'), ...args);
};

/**
 * Log an informational message
 *
 * @param {string} message - Message to log
 */
export const warning = (...args) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
    core.warning(args[0]);
    return args.length > 1 ? cconsole.warning(...args.slice(1)) : null;
  }
  cconsole.warning(colorize(clabels.warning, 'yellow'), ...args);
};

let openedGroups = 0;

/**
 * Log a section header
 *
 * @param {string} title - Section title
 */
export const startGroup = (title) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
    openedGroups++;
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
  if (process.env.GITHUB_ACTIONS === 'true') {
    openedGroups--;
    return core.endGroup();
  }
};
