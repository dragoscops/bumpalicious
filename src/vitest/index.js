import toml from '@iarna/toml';
import fs from 'fs-extra';

export const folder = 'test-project';
export const name = 'project-name';
export const version = '1.7.3';

const denoOrNodeJsonConfig = `{
  "name": "${name}",
  "version": "${version}"
}`;

const denoJsoncConfig = `{
  // comment
  "name": "${name}",
  "version": "${version}"
}`;

const goModContent = `module ${name}\nversion = \"${version}\"`;

export const pyprojectContent = `[tool.poetry]
name = "${name}"
version = "${version}"`;

const setupPyContent = `setup(
  name="${name}",
  version="${version}"
)`;

const mockPyprojectData = {
  tool: {
    poetry: {
      name,
      version,
    },
  },
};

export const cargoContent = `[package]
name = "${name}"
version = "${version}"`;

export const mockCargoData = {
  package: {
    name,
    version,
  },
};

export const TEXT_VERSION_FILES = ['version', 'version.txt', 'VERSION', 'VERSION.txt'];

const buildZigContent = `
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const NAME = "${name}";
    const VERSION = "${version}";
    
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
    .name = "${name}",
    .version = "${version}",
    .dependencies = .{
        .clap = .{
            .url = "https://github.com/Hejsil/zig-clap/archive/master.tar.gz",
            .hash = "12208070a9f61c512023f4b5615b50c56a2c19f0f7f4c4a7078cb8e135683540cce8",
        },
    },
}`;

export const ZIG_VERSION_FILES = ['build.zig', 'build.zig.zon'];

const configMocks = {
  'Cargo.toml': cargoContent,
  'deno.jsonc': denoJsoncConfig,
  'deno.json': denoOrNodeJsonConfig,
  'jsr.json': denoOrNodeJsonConfig,
  'package.json': denoOrNodeJsonConfig,
  'go.mod': goModContent,
  'pyproject.toml': pyprojectContent,
  'setup.py': setupPyContent,
  'setup.cfg': setupPyContent,
  ...TEXT_VERSION_FILES.reduce((acc, file) => {
    acc[file] = version;
    return acc;
  }, {}),
  'build.zig': buildZigContent,
  'build.zig.zon': buildZigZonContent,
};

export const mockConfigFiles = () => {
  fs.readJson.mockImplementation((path) => {
    for (const [key, value] of Object.entries(configMocks)) {
      if (path.endsWith(key)) {
        return Promise.resolve(JSON.parse(value));
      }
    }
    return Promise.reject(new Error('File not found'));
  });
  fs.readFile.mockImplementation((path) => {
    for (const [key, value] of Object.entries(configMocks)) {
      if (path.endsWith(key)) {
        return Promise.resolve(value);
      }
    }
    return Promise.reject(new Error('File not found'));
  });
};

export const mockConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(console)).forEach((key) => {
    if (typeof console[key] === 'function') {
      console[key] = vi.fn();
    }
  });
};

export const unMockConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(console)).forEach((key) => {
    if (typeof console[key] === 'function' && typeof console[key].mockRestore === 'function') {
      console[key].mockRestore();
    }
  });
};
