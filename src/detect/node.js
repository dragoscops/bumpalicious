/**
 * Node.js project version and name detection
 * @module detect/node
 */

import fs from "fs-extra";
import path from "path";

/**
 * Detect version from a Node.js project
 * Looking for package.json or jsr.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of ["jsr.json", "package.json"]) {
    const config = path.join(projectPath, file);
    if (await fs.pathExists(config)) {
      const pkg = await fs.readJson(config);
      if (pkg.version) {
        return pkg.version;
      }
    }
  }

  throw new Error("Could not detect version in Node.js project");
};

/**
 * Detect name from a Node.js project
 * Looking for package.json or jsr.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 * @throws {Error} - If name could not be detected
 */
export const detectName = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of ["jsr.json", "package.json"]) {
    if (await fs.pathExists("package.json")) {
      const pkg = await fs.readJson("package.json");
      if (pkg.name) {
        return pkg.name;
      }
    }
  }

  // Default to current directory name
  return path.basename(path.normalize(projectPath));
};
