#!/usr/bin/env node
/**
 * Pre-action setup script
 * Installs production dependencies needed for the action
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

const actionPath = path.resolve(__dirname, '..');
console.log(`Installing changelog dependencies in ${actionPath}...`);

const packages = [
  'conventional-changelog-angular',
  'conventional-changelog-atom',
  'conventional-changelog-codemirror',
  'conventional-changelog-conventionalcommits',
  'conventional-changelog-ember',
  'conventional-changelog-eslint',
  'conventional-changelog-express',
  'conventional-changelog-jquery',
  'conventional-changelog-jshint',
  'conventional-changelog-writer',
  'conventional-commits-parser',
];

try {
  execSync(`npm install -S --prefer-offline --no-audit ${packages.join(' ')}`, {
    cwd: actionPath,
    stdio: 'inherit',
  });
  console.log('Changelog dependencies installed successfully');
} catch (error) {
  console.error('Failed to install changelog dependencies:', error.message);
  process.exit(1);
}
