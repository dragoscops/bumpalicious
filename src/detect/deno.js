/**
 * Deno project version and name detection
 * @module detect/deno
 */

import fs from "fs-extra";
import path from "path";

/**
 * List of potential version file names to check
 */
const VERSION_FILES = ["deno.json", "jsr.json", "package.json"];

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  let configPath = path.join(projectPath, "deno.jsonc");

  // Check for deno.jsonc (JSON with comments)
  if (await fs.pathExists(configPath)) {
    try {
      // Read as string first
      const content = await fs.readFile(configPath, "utf8");
      // Simple comment stripping - remove lines starting with //
      const noComments = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");

      const denoConfig = JSON.parse(noComments);
      if (denoConfig.version) {
        return denoConfig.version;
      }
    } catch (error) {
      console.error("Error parsing deno.jsonc:", error);
    }
  }

  // Check for deno.json, jsr.json, package.json
  for (const file of VERSION_FILES) {
    configPath = path.join(projectPath, file);

    if (await fs.pathExists(configPath)) {
      const denoConfig = await fs.readJson(configPath);
      if (denoConfig.version) {
        return denoConfig.version;
      }
    }
  }

  throw new Error("Could not detect version in Deno project");
};

/**
 * Detect name from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  let configPath = path.join(projectPath, "deno.jsonc");

  // Check for deno.jsonc (JSON with comments)
  if (await fs.pathExists(configPath)) {
    try {
      // Read as string first
      const content = await fs.readFile(configPath, "utf8");
      // Simple comment stripping - remove lines starting with //
      const noComments = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");

      const denoConfig = JSON.parse(noComments);
      if (denoConfig.name) {
        return denoConfig.name;
      }
    } catch (error) {
      console.error("Error parsing deno.jsonc:", error);
    }
  }

  // Check for deno.json, jsr.json, package.json
  for (const file of VERSION_FILES) {
    configPath = path.join(projectPath, file);
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      if (config.name) {
        return config.name;
      }
    }
  }

  // Default to current directory name
  return path.basename(path.normalize(projectPath));
};
