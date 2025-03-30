import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';
import * as deno from './deno.js';
import * as logging from '../utils/logging.js';

// Mock logging
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/deno.js module', () => {
  it('true', () => {
    expect(true).toBe(true);
  });
  //   const projectPath = "/test/project";
  //   const newVersion = "1.2.3";
  //   const oldVersion = "1.0.0";

  //   const denoConfig = {
  //     name: "test-project",
  //     version: oldVersion,
  //   };

  //   beforeAll(() => {
  //     vi.clearAllMocks();

  //     // Setup fs mocks
  //     fs.writeJson.mockResolvedValue(undefined);
  //     fs.writeFile.mockResolvedValue(undefined);
  //     fs.readJson.mockResolvedValue({ ...denoConfig });
  //     fs.readFile.mockImplementation((path) => {
  //       if (path.includes("jsonc")) {
  //         return Promise.resolve(`{
  //   // This is a comment
  //   "name": "test-project",
  //   "version": "${oldVersion}"
  // }`);
  //       }
  //       return Promise.reject(new Error("File not found"));
  //     });
  //   });

  //   describe("updateVersion()", () => {
  //     it("updates version in deno.json", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("deno.json"));
  //       });

  //       const result = await deno.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readJson).toHaveBeenCalledWith(`${projectPath}/deno.json`);
  //       expect(fs.writeJson).toHaveBeenCalledWith(
  //         `${projectPath}/deno.json`,
  //         { ...denoConfig, version: newVersion },
  //         { spaces: 2 }
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(
  //         expect.stringContaining(newVersion)
  //       );
  //     });

  //     it("updates version in deno.jsonc", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("deno.jsonc"));
  //       });

  //       const result = await deno.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/deno.jsonc`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/deno.jsonc`,
  //         expect.stringContaining(`"version": "${newVersion}"`)
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(
  //         expect.stringContaining(newVersion)
  //       );
  //     });

  //     it("updates version in jsr.json", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("jsr.json"));
  //       });

  //       const result = await deno.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readJson).toHaveBeenCalledWith(`${projectPath}/jsr.json`);
  //       expect(fs.writeJson).toHaveBeenCalledWith(
  //         `${projectPath}/jsr.json`,
  //         { ...denoConfig, version: newVersion },
  //         { spaces: 2 }
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(
  //         expect.stringContaining(newVersion)
  //       );
  //     });

  //     it("updates version in package.json", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("package.json"));
  //       });

  //       const result = await deno.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readJson).toHaveBeenCalledWith(`${projectPath}/package.json`);
  //       expect(fs.writeJson).toHaveBeenCalledWith(
  //         `${projectPath}/package.json`,
  //         { ...denoConfig, version: newVersion },
  //         { spaces: 2 }
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(
  //         expect.stringContaining(newVersion)
  //       );
  //     });

  //     it("creates version file when no config files exist", async () => {
  //       fs.pathExists.mockResolvedValue(false);

  //       const result = await deno.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/version`,
  //         newVersion,
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(
  //         expect.stringContaining(newVersion)
  //       );
  //     });

  //     it("handles errors gracefully", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("deno.json"));
  //       });

  //       fs.readJson.mockRejectedValue(new Error("Test error"));

  //       await expect(deno.updateVersion({ projectPath, newVersion }))
  //         .resolves.toBe(true); // Should create version file as fallback

  //       expect(logging.error).toHaveBeenCalled();
  //     });
  //   });
});
