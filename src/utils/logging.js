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
console.log('isGitHubActions:', isGitHubActions);

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
 */
export const info = (message, ...args) => {
  if (isGitHubActions) {
    console.log(`::debug::${message}`, ...args);
    return;
  }
  console.log(`${colorize('INFO:', 'blue')} ${message}`, ...args);
};

/**
 * Log a success message
 *
 * @param {string} message - Message to log
 */
export const success = (message, ...args) => {
  console.log(`${colorize('SUCCESS:', 'green')} ${message}`);

  if (isGitHubActions) {
    // Use GitHub Actions logging commands for better integration
    console.log(`::notice::${message}`, ...args);
  }
};

/**
 * Log a warning message
 *
 * @param {string} message - Message to log
 */
export const warning = (message, ...args) => {
  console.log(`${colorize('WARNING:', 'yellow')} ${message}`);

  if (isGitHubActions) {
    // Use GitHub Actions logging commands for better integration
    console.log(`::warning::${message}`, ...args);
  }
};

/**
 * Log an error message
 *
 * @param {string} message - Message to log
 * @param {Error} [error] - Optional error object
 */
export const error = (message, ...args) => {
  const [error, ...rest] = args;
  console.error(`${colorize('ERROR:', 'red')} ${message}`, ...(error instanceof Error ? rest : args));

  if (error) {
    if (error.stack) {
      console.error(colorize(error.stack, 'red'));
    } else {
      console.error(colorize(String(error), 'red'));
    }
  }

  if (isGitHubActions) {
    // Use GitHub Actions logging commands for better integration
    console.error(`::error::${message}${error ? ': ' + error.message : ''}`);
  }

  process.exit(1);
};

/**
 * Log a section header
 *
 * @param {string} title - Section title
 */
export const section = (title) => {
  const line = '='.repeat(title.length + 8);
  console.log('\n' + colorize(line, 'magenta'));
  console.log(colorize(`=== ${title} ===`, 'magenta'));
  console.log(colorize(line, 'magenta') + '\n');

  if (isGitHubActions) {
    // Use GitHub Actions group commands for better organization
    console.log(`::group::${title}`);
  }
};

/**
 * End a section (only relevant for GitHub Actions)
 */
export const sectionEnd = () => {
  if (isGitHubActions) {
    console.log('::endgroup::');
  }
};
