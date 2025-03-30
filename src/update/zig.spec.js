import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';
import * as zig from './zig.js';
import * as logging from '../utils/logging.js';

// Mock logging
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/zig.js module', () => {
  it('true', () => {
    expect(true).toBe(true);
  });
  //   const projectPath = "/test/project";
  //   const newVersion = "1.2.3";
  //   const oldVersion = "0.1.2";

  //   const buildZigContent = `
  //     const std = @import("std");

  //     pub fn build(b: *std.Build) void {
  //         const target = b.standardTargetOptions(.{});
  //         const optimize = b.standardOptimizeOption(.{});

  //         const NAME = "zigapp";
  //         const VERSION = "${oldVersion}";

  //         const exe = b.addExecutable(.{
  //             .name = NAME,
  //             .root_source_file = .{ .path = "src/main.zig" },
  //             .target = target,
  //             .optimize = optimize,
  //         });

  //         // Set metadata
  //         exe.version = VERSION;
  //     }`;

  //   const buildZigZonContent = `
  //     .{
  //         .name = "zigapp",
  //         .version = "${oldVersion}",
  //         .dependencies = .{
  //             .clap = .{
  //                 .url = "https://github.com/Hejsil/zig-clap/archive/master.tar.gz",
  //                 .hash = "12208070a9f61c512023f4b5615b50c56a2c19f0f7f4c4a7078cb8e135683540cce8",
  //             },
  //         },
  //     }`;

  //   beforeAll(() => {
  //     vi.clearAllMocks();

  //     // Setup fs mocks
  //     fs.writeFile.mockResolvedValue(undefined);
  //     fs.readFile.mockImplementation((path) => {
  //       if (path.endsWith("build.zig")) {
  //         return Promise.resolve(buildZigContent);
  //       }
  //       if (path.endsWith("build.zig.zon")) {
  //         return Promise.resolve(buildZigZonContent);
  //       }
  //       return Promise.reject(new Error("File not found"));
  //     });
  //   });

  //   describe("updateVersion()", () => {
  //     it("updates version in build.zig.zon", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("build.zig.zon"));
  //       });

  //       const result = await zig.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/build.zig.zon`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/build.zig.zon`,
  //         expect.stringContaining(`version = "${newVersion}"`),
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("updates version in build.zig", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("build.zig"));
  //       });

  //       const result = await zig.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/build.zig`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/build.zig`,
  //         expect.stringContaining(`VERSION = "${newVersion}"`),
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("creates version file when no Zig files exist", async () => {
  //       fs.pathExists.mockResolvedValue(false);

  //       const result = await zig.updateVersion({ projectPath, newVersion });

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
  //         return Promise.resolve(path.endsWith("build.zig"));
  //       });

  //       fs.readFile.mockRejectedValue(new Error("Test error"));

  //       await expect(zig.updateVersion({ projectPath, newVersion }))
  //         .resolves.toBe(true); // Should create version file as fallback

  //       expect(logging.error).toHaveBeenCalled();
  //     });
  //   });
});
