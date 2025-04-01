import fs from 'fs-extra';
import path from 'path';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as zig from './zig.js';
import * as logging from '../utils/logging.js';
import {
  projectPath,
  newVersion,
  oldVersion,
  projectName,
  ZIG_VERSION_FILES,
} from '../vitest/setup.detect-update.tests.js';

// Mock the dependencies
vi.mock('fs-extra');
vi.mock('path', () => {
  return {
    default: {
      join: vi.fn((dir, file) => `${dir}/${file}`),
      basename: vi.fn((p) => p.split('/').pop()),
      normalize: vi.fn((p) => p),
    },
    join: vi.fn((dir, file) => `${dir}/${file}`),
    basename: vi.fn((p) => p.split('/').pop()),
    normalize: vi.fn((p) => p),
  };
});
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

// Define test content for build.zig and build.zig.zon files
const buildZigContent = `
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const NAME = "${projectName}";
    const VERSION = "${oldVersion}";
    
    const exe = b.addExecutable(.{
        .name = NAME,
        .root_source_file = .{ .path = "src/main.zig" },
        .target = target,
        .optimize = optimize,
    });

    // Set metadata
    exe.version = VERSION;
}`;

const buildZigZonContent = `
.{
    .name = "${projectName}",
    .version = "${oldVersion}",
    .dependencies = .{
        .clap = .{
            .url = "https://github.com/Hejsil/zig-clap/archive/master.tar.gz",
            .hash = "12208070a9f61c512023f4b5615b50c56a2c19f0f7f4c4a7078cb8e135683540cce8",
        },
    },
}`;

describe('update/zig.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    it('updates version in build.zig.zon file', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('build.zig.zon'));
      });

      fs.readFile.mockResolvedValue(buildZigZonContent);

      const result = await zig.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        `${projectPath}/build.zig.zon`,
        expect.stringContaining(newVersion),
        'utf8',
      );
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    it('updates version in build.zig file when build.zig.zon does not exist', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test - first file doesn't exist, second does
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('build.zig.zon') && path.endsWith('build.zig'));
      });

      fs.readFile.mockResolvedValue(buildZigContent);

      const result = await zig.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        `${projectPath}/build.zig`,
        expect.stringContaining(newVersion),
        'utf8',
      );
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    it('creates version file when no Zig files exist', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test - no files exist
      fs.pathExists.mockResolvedValue(false);

      const result = await zig.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/version`, newVersion, 'utf8');
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('Created version file'));
    });

    it('handles errors gracefully', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockRejectedValue(new Error('Test error'));

      await expect(zig.updateVersion({projectPath, newVersion})).rejects.toThrow();
      expect(logging.error).toHaveBeenCalled();
    });
  });
});
