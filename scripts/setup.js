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
  execSync(`npm install --no-save --prefer-offline --no-audit ${packages.join(' ')}`, {
    cwd: actionPath,
    stdio: 'inherit',
  });

  // Set NODE_PATH so the action can find the modules
  const nodeModulesPath = path.join(actionPath, 'node_modules');
  const currentNodePath = process.env.NODE_PATH || '';
  const newNodePath = currentNodePath ? `${nodeModulesPath}:${currentNodePath}` : nodeModulesPath;

  // Write to GITHUB_ENV so subsequent steps can use it
  const fs = require('node:fs');
  const githubEnv = process.env.GITHUB_ENV;
  if (githubEnv) {
    fs.appendFileSync(githubEnv, `NODE_PATH=${newNodePath}\n`);
    console.log(`Set NODE_PATH=${newNodePath}`);
  }

  console.log('Changelog dependencies installed successfully');
} catch (error) {
  console.error('Failed to install changelog dependencies:', error.message);
  process.exit(1);
}
