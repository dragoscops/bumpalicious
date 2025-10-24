#!/usr/bin/env node
/**
 * Pre-action setup script
 * Installs production dependencies needed for the action
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

const actionPath = path.resolve(__dirname, '..');
console.log(`Installing dependencies in ${actionPath}...`);

try {
  execSync('npm ci --omit=dev --prefer-offline --no-audit', {
    cwd: actionPath,
    stdio: 'inherit',
  });
  console.log('Dependencies installed successfully');
} catch (error) {
  console.error('Failed to install dependencies:', error.message);
  process.exit(1);
}
