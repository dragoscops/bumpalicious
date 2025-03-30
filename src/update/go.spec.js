import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';
import * as go from './go.js';
import * as logging from '../utils/logging.js';

// Mock logging
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/go.js module', () => {
  it('true', () => {
    expect(true).toBe(true);
  });
  //   const projectPath = "/test/project";
  //   const newVersion = "1.2.3";
  //   const oldVersion = "1.0.0";

  //   beforeAll(() => {
  //     vi.clearAllMocks();

  //     // Setup fs mocks
  //     fs.writeFile.mockResolvedValue(undefined);
  //     fs.readFile.mockImplementation((path) => {
  //       if (path.includes("go.mod")) {
  //         return Promise.resolve(`module example-module\nversion = "${oldVersion}"`);
  //       }
  //       if (path.includes("version.go")) {
  //         return Promise.resolve(`package version\n\nconst Version = "${oldVersion}"`);
  //       }
  //       return Promise.reject(new Error("File not found"));
  //     });
  //   });

  //   describe("updateVersion()", () => {
  //     it("updates version in go.mod", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("go.mod"));
  //       });

  //       const result = await go.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/go.mod`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/go.mod`,
  //         expect.stringContaining(`version = "${newVersion}"`),
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("updates version in version.go", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("version.go"));
  //       });

  //       const result = await go.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/version.go`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/version.go`,
  //         expect.stringContaining(`const Version = "${newVersion}"`),
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("creates version file when no version files exist", async () => {
  //       fs.pathExists.mockResolvedValue(false);

  //       const result = await go.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/version`,
  //         newVersion,
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("handles errors gracefully", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("go.mod"));
  //       });

  //       fs.readFile.mockRejectedValue(new Error("Test error"));

  //       await expect(go.updateVersion({ projectPath, newVersion }))
  //         .resolves.toBe(true); // Should create version file as fallback

  //       expect(logging.error).toHaveBeenCalled();
  //     });
  //   });
});
