/**
 * Rust project version and name detection
 * @module detect/rust
 */

import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';

/**
 * Extract version from Cargo.toml content
 * 
 * @param {string} content - Cargo.toml file content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromCargoToml = (content) => {
  // Version is typically in the package section
  const versionMatch = content.match(/^\[package\][^\[]*version\s*=\s*["']([^"']+)["']/ms);
  return versionMatch && versionMatch[1] ? versionMatch[1] : null;
};

/**
 * Extract name from Cargo.toml content
 * 
 * @param {string} content - Cargo.toml file content
 * @returns {string|null} - Extracted name or null if not found
 */
const extractNameFromCargoToml = (content) => {
  // Name is typically in the package section
  const nameMatch = content.match(/^\[package\][^\[]*name\s*=\s*["']([^"']+)["']/ms);
  return nameMatch && nameMatch[1] ? nameMatch[1] : null;
};

/**
 * Detect version from a Rust project
 * Looking for Cargo.toml file
 * 
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectRustVersion = async () => {
  // Check for Cargo.toml
  if (await fs.pathExists('Cargo.toml')) {
    const content = await fs.readFile('Cargo.toml', 'utf8');
    const version = extractVersionFromCargoToml(content);
    if (version) {
      return version;
    }
  }
  
  // Try to get version from cargo if available
  try {
    const { stdout } = await execa('cargo', ['pkgid']);
    if (stdout) {
      // The output is like 'package-id = "package-name version-number"'
      const versionMatch = stdout.match(/#([^:]+):([^@]+)@(.+)$/);
      if (versionMatch && versionMatch[3]) {
        return versionMatch[3];
      }
    }
  } catch (error) {
    // Ignore errors - cargo might not be available
  }
  
  throw new Error('Could not detect version in Rust project');
};

/**
 * Detect name from a Rust project
 * Looking for Cargo.toml file
 * 
 * @returns {Promise<string>} - Detected name
 */
export const detectRustName = async () => {
  // Check for Cargo.toml
  if (await fs.pathExists('Cargo.toml')) {
    const content = await fs.readFile('Cargo.toml', 'utf8');
    const name = extractNameFromCargoToml(content);
    if (name) {
      return name;
    }
  }
  
  // Try to get name from cargo if available
  try {
    const { stdout } = await execa('cargo', ['pkgid']);
    if (stdout) {
      // The output is like 'package-id = "package-name version-number"'
      const nameMatch = stdout.match(/#([^:]+):([^@]+)@/);
      if (nameMatch && nameMatch[2]) {
        return nameMatch[2];
      }
    }
  } catch (error) {
    // Ignore errors - cargo might not be available
  }
  
  // Default to current directory name
  return path.basename(process.cwd());
};