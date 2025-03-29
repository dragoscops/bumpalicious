/**
 * Deno project version and name detection
 * @module detect/deno
 */

import fs from "fs-extra";
import path from "path";

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async () => {
  // Check for deno.json
  if (await fs.pathExists("deno.json")) {
    const denoConfig = await fs.readJson("deno.json");
    if (denoConfig.version) {
      return denoConfig.version;
    }
  }

  // Check for deno.jsonc (JSON with comments)
  if (await fs.pathExists("deno.jsonc")) {
    try {
      // Read as string first
      const content = await fs.readFile("deno.jsonc", "utf8");
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

  // Check for jsr.json
  if (await fs.pathExists("jsr.json")) {
    const jsr = await fs.readJson("jsr.json");
    if (jsr.version) {
      return jsr.version;
    }
  }

  // Check for package.json (some Deno projects use it too)
  if (await fs.pathExists("package.json")) {
    const pkg = await fs.readJson("package.json");
    if (pkg.version) {
      return pkg.version;
    }
  }

  throw new Error("Could not detect version in Deno project");
};

/**
 * Detect name from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async () => {
  // Check for deno.json
  if (await fs.pathExists("deno.json")) {
    const denoConfig = await fs.readJson("deno.json");
    if (denoConfig.name) {
      return denoConfig.name;
    }
  }

  // Check for deno.jsonc (JSON with comments)
  if (await fs.pathExists("deno.jsonc")) {
    try {
      // Read as string first
      const content = await fs.readFile("deno.jsonc", "utf8");
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

  // Check for jsr.json
  if (await fs.pathExists("jsr.json")) {
    const jsr = await fs.readJson("jsr.json");
    if (jsr.name) {
      return jsr.name;
    }
  }

  // Check for package.json (some Deno projects use it too)
  if (await fs.pathExists("package.json")) {
    const pkg = await fs.readJson("package.json");
    if (pkg.name) {
      return pkg.name;
    }
  }

  // Default to current directory name
  return path.basename(process.cwd());
};
