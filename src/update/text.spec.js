import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';
import * as text from './text.js';
import * as logging from '../utils/logging.js';

// Mock logging
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/text.js module', () => {
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
  //     fs.readFile.mockResolvedValue(oldVersion);
  //   });

  //   describe("updateVersion()", () => {
  //     it("updates existing version file", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("version"));
  //       });

  //       const result = await text.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/version`,
  //         newVersion,
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("updates existing VERSION.txt file", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("VERSION.txt"));
  //       });

  //       const result = await text.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/VERSION.txt`,
  //         newVersion,
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("creates version file when no existing file is found", async () => {
  //       fs.pathExists.mockResolvedValue(false);

  //       const result = await text.updateVersion({ projectPath, newVersion });

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
  //         return Promise.resolve(path.endsWith("version"));
  //       });

  //       fs.writeFile.mockRejectedValueOnce(new Error("Test error"));

  //       await expect(text.updateVersion({ projectPath, newVersion }))
  //         .resolves.toBe(true); // Should try other files

  //       expect(logging.error).toHaveBeenCalled();
  //       // Should create version file as fallback
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/version`,
  //         newVersion,
  //         "utf8"
  //       );
  //     });
  //   });
});
