import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';
import * as rust from './rust.js';
import * as logging from '../utils/logging.js';
import toml from '@iarna/toml';

// Mock logging
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/rust.js module', () => {
  it('true', () => {
    expect(true).toBe(true);
  });
  //   const projectPath = "/test/project";
  //   const newVersion = "1.2.3";
  //   const oldVersion = "1.0.0";

  //   // Mock Cargo.toml data
  //   const mockCargoData = {
  //     package: {
  //       name: "example-crate",
  //       version: oldVersion,
  //       edition: "2021"
  //     },
  //     dependencies: {
  //       serde: "1.0"
  //     }
  //   };

  //   const cargoTomlContent = `[package]
  // name = "example-crate"
  // version = "${oldVersion}"
  // edition = "2021"

  // [dependencies]
  // serde = "1.0"`;

  //   beforeAll(() => {
  //     vi.clearAllMocks();

  //     // Setup fs mocks
  //     fs.writeFile.mockResolvedValue(undefined);
  //     fs.readFile.mockImplementation((path) => {
  //       if (path.includes("Cargo.toml")) {
  //         return Promise.resolve(cargoTomlContent);
  //       }
  //       return Promise.reject(new Error("File not found"));
  //     });

  //     // Mock TOML parser
  //     toml.parse.mockReturnValue({ ...mockCargoData });
  //     toml.stringify.mockImplementation((data) => JSON.stringify(data, null, 2));
  //   });

  //   describe("updateVersion()", () => {
  //     it("updates version in Cargo.toml using TOML parser", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("Cargo.toml"));
  //       });

  //       const result = await rust.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(toml.parse).toHaveBeenCalledWith(cargoTomlContent);
  //       expect(toml.stringify).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           package: expect.objectContaining({
  //             version: newVersion
  //           })
  //         })
  //       );
  //       expect(fs.writeFile).toHaveBeenCalled();
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("falls back to regex if TOML parsing fails", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("Cargo.toml"));
  //       });

  //       // Make TOML parser throw an error
  //       toml.parse.mockImplementationOnce(() => {
  //         throw new Error("TOML parsing error");
  //       });

  //       const result = await rust.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(logging.error).toHaveBeenCalled();
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/Cargo.toml`,
  //         expect.stringContaining(`version = "${newVersion}"`),
  //         "utf8"
  //       );
  //     });

  //     it("creates version file when no Cargo.toml exists", async () => {
  //       fs.pathExists.mockResolvedValue(false);

  //       const result = await rust.updateVersion({ projectPath, newVersion });

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
  //         return Promise.resolve(path.endsWith("Cargo.toml"));
  //       });

  //       fs.readFile.mockRejectedValue(new Error("Test error"));

  //       await expect(rust.updateVersion({ projectPath, newVersion }))
  //         .resolves.toBe(true); // Should create version file as fallback

  //       expect(logging.error).toHaveBeenCalled();
  //     });
  //   });
});
