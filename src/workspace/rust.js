/**
 * Rust project version and name detection
 * @module detect/rust
 */

import toml from '@iarna/toml';
import path from 'path';
import * as d from '../core/version/detect.js';

/**
 * Detect version from a Rust project
 * Looking for Cargo.toml file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<RustConfig>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'rust', [
    d.configParser(path.join(projectPath, 'Cargo.toml'), {
      parser: toml.parse,
      version: ['package.version'],
      name: ['package.name'],
    }),
  ]);
