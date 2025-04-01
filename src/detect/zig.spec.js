import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as zig from './zig.js';
import {projectPath, oldVersion, projectName, ZIG_VERSION_FILES} from '../vitest/setup.detect-update.tests.js';

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
vi.mock('execa');

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

describe('detect/zig.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    it('detects version from build.zig.zon file', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('build.zig.zon'));
      });
      fs.readFile.mockResolvedValue(buildZigZonContent);

      await expect(zig.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/build.zig.zon`, 'utf8');
    });

    it('detects version from build.zig file when build.zig.zon does not exist', async () => {
      // First call for zon file returns false, second for build.zig returns true
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('build.zig.zon') && path.endsWith('build.zig'));
      });
      fs.readFile.mockResolvedValue(buildZigContent);

      await expect(zig.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/build.zig`, 'utf8');
    });

    it('falls back to zig command when files do not contain version', async () => {
      // Files exist but don't have version
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('// No version here');

      execa.mockResolvedValue({
        stdout: oldVersion,
      });

      await expect(zig.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(execa).toHaveBeenCalledWith('zig', ['version'], {cwd: projectPath});
    });

    it('throws error when no version could be found', async () => {
      fs.pathExists.mockResolvedValue(false);
      execa.mockRejectedValue(new Error('Command not found'));

      await expect(zig.detectVersion(projectPath)).rejects.toThrow('Could not detect version in Zig project');
    });
  });

  describe('detectName()', () => {
    it('detects name from build.zig.zon file', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('build.zig.zon'));
      });
      fs.readFile.mockResolvedValue(buildZigZonContent);

      await expect(zig.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/build.zig.zon`, 'utf8');
    });

    it('detects name from build.zig file when build.zig.zon does not exist', async () => {
      // First call for zon file returns false, second for build.zig returns true
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('build.zig.zon') && path.endsWith('build.zig'));
      });
      fs.readFile.mockResolvedValue(buildZigContent);

      await expect(zig.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/build.zig`, 'utf8');
    });

    it('returns directory name when no name could be found', async () => {
      fs.pathExists.mockResolvedValue(false);

      await expect(zig.detectName(projectPath)).resolves.toEqual(projectPath.split('/').pop());
    });
  });
});
