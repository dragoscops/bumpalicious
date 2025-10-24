/**
 * Template Loader for Bundled Templates
 *
 * Loads Handlebars templates from the dist/templates directory
 * when running in bundled mode (for GitHub Actions).
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ChangelogPreset } from './ChangelogService.js';

/**
 * Get the base directory for templates
 * In bundled code, templates are in dist/templates/
 * In development, templates don't exist (packages use their own)
 */
function getTemplatesBasePath(): string {
  // In CommonJS bundled code, __dirname will be 'dist'
  // We need to check if we're in dist/ or src/
  if (__dirname.endsWith('dist')) {
    return join(__dirname, 'templates');
  }
  // In development (src/), return dist/templates for testing
  // This assumes dist exists from a previous build
  return join(__dirname, '..', '..', 'dist', 'templates');
}

/**
 * Load template files for a preset
 *
 * @param preset - The conventional-changelog preset name
 * @returns Template strings for main, header, commit, and footer
 */
export async function loadTemplates(preset: ChangelogPreset): Promise<{
  template: string;
  header: string;
  commit: string;
  footer?: string;
}> {
  const basePath = getTemplatesBasePath();
  const presetPath = join(basePath, preset);

  const [template, header, commit, footer] = await Promise.all([
    fs.readFile(join(presetPath, 'template.hbs'), 'utf-8'),
    fs.readFile(join(presetPath, 'header.hbs'), 'utf-8'),
    fs.readFile(join(presetPath, 'commit.hbs'), 'utf-8'),
    fs.readFile(join(presetPath, 'footer.hbs'), 'utf-8').catch(() => ''), // footer is optional
  ]);

  return { template, header, commit, footer: footer || undefined };
}

/**
 * Check if we're running in bundled mode
 * Returns true if dist/templates exists relative to current location
 */
export async function isBundledMode(): Promise<boolean> {
  try {
    const templatesPath = getTemplatesBasePath();
    await fs.access(templatesPath);
    return true;
  } catch {
    return false;
  }
}
