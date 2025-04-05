import fs from 'fs-extra';
import {expect} from 'vitest';
import {TEXT_VERSION_FILES} from '../core/constants.js';

export const folder = 'test-project';
export const projectNameValue = 'project'; // Renamed from name to projectName
export const oldVersion = '1.7.3';
export const projectPath = '/test/project';
export const newVersion = '2.0.0';

const configMocks = {
  'Cargo.toml': ['[package]', `name = "${projectNameValue}"`, `version = "${oldVersion}"`].join('\n'),
  'deno.jsonc':
    '//comment \n' +
    JSON.stringify({
      name: projectNameValue,
      version: oldVersion,
    }),
  'deno.json': JSON.stringify({
    name: projectNameValue,
    version: oldVersion,
  }),
  'jsr.json': JSON.stringify({
    name: projectNameValue,
    version: oldVersion,
  }),
  'package.json': JSON.stringify({
    name: projectNameValue,
    version: oldVersion,
  }),
  'go.mod': [`module github.com/${projectNameValue}`, `go 1.16`, `version = "${oldVersion}"`].join('\n'),
  'version.go': [
    'package version',
    `const Version = "${oldVersion}"`,
    'func GetVersion() string {',
    '  return Version',
    '}',
  ].join('\n'),
  'pyproject.toml': ['[project]', `name = "${projectNameValue}"`, `version = "${oldVersion}"`].join('\n'),
  // 'poetry.toml': ['[tool.poetry]', `name = "${projectNameValue}"`, `version = "${oldVersion}"`].join('\n'),
  'setup.py': ['setup(', `name="${projectNameValue}",`, `version="${oldVersion}"`, `)`].join('\n'),
  'setup.cfg': [`[metadata]`, `name = ${projectNameValue}`, `version = ${oldVersion}`].join('\n'),
  '__init__.py': [
    '"""Package initialization."""',
    `__version__ = "${oldVersion}"`,
    `__name__ = "${projectNameValue}"`,
  ].join('\n'),
  ...TEXT_VERSION_FILES.reduce((acc, file) => {
    acc[file] = oldVersion;
    return acc;
  }, {}),
  'build.zig': [
    'const std = @import("std");',
    '',
    'pub fn build(b: *std.Build) void {',
    '  const target = b.standardTargetOptions(.{});',
    '  const optimize = b.standardOptimizeOption(.{});',
    '',
    ` const NAME = "${projectNameValue}";`,
    ` const VERSION = "${oldVersion}";`,
    '',
    ,
    '  const exe = b.addExecutable(.{',
    '    .name = NAME,',
    '    .root_source_file = .{ .path = "src/main.zig" },',
    '    .target = target,',
    '    .optimize = optimize,',
    '  });',
    '',
    '  // Set metadata',
    '  exe.version = VERSION;',
    '}',
  ].join('\n'),
  'build.zig.zon': [
    '.{',
    `  .name = "${projectNameValue}",`,
    `  .version = "${oldVersion}",`,
    '  .dependencies = .{',
    '    .clap = .{',
    '      .url = "https://github.com/Hejsil/zig-clap/archive/master.tar.gz",',
    '      .hash = "12208070a9f61c512023f4b5615b50c56a2c19f0f7f4c4a7078cb8e135683540cce8",',
    '    },',
    '  },',
    '}',
  ].join('\n'),
};
// console.log(configMocks)

export const mockConfigFiles = () => {
  fs.readJson.mockImplementation((path) => {
    for (const [key, value] of Object.entries(configMocks)) {
      if (path.endsWith(key)) {
        try {
          return Promise.resolve(JSON.parse(value));
        } catch {
          // Non-JSON files will return the raw content
          return Promise.resolve(value);
        }
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

/**
 * Set Up Tests for Detecting Version when Version Files Exist
 *
 * @param {Object} options - Update options
 * @param {string} options.detectVersion - Path to the project
 * @param {string|string[]} options.configFile - New version to set
 */
export const setupDetectTest = ({detect, configFile, projectName = projectNameValue}) => {
  describe(`when ${configFile} config file exists`, () => {
    it(`will call fs.read* with correct arguments and return a version`, async () => {
      fs.existingFile = configFile;

      const config = await detect(projectPath);

      if (configFile.endsWith('json')) {
        expect(fs.readJson).toHaveBeenCalledWith(`${projectPath}/${configFile}`);
      } else {
        expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/${configFile}`, 'utf8');
      }
      expect(config.name).toEqual(projectName);
      expect(config.version).toEqual(oldVersion);
    });
  });
};

export const setupDetectTestNoConfig = ({detect}) => {
  describe('when no config file exists', () => {
    it('ends with error message', async () => {
      fs.existingFile = 'unknown';

      try {
        mockConsole(['error']);
        await detect(projectPath);
        expect(console.error).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No version file found'));
      } finally {
        unMockConsole(['error']);
      }
    });
  });
};

export const setupUpdateVersionTest = ({configFile, updateVersion}) => {
  describe(`when ${configFile} config file exists`, () => {
    // Skip deno.jsonc which is tested separately
    it(`will call fs.read* and fs.write* with correct arguments`, async () => {
      fs.existingFile = configFile;
      mockConsole(['error']);

      try {
        await updateVersion({projectPath, newVersion});

        if (configFile.endsWith('json')) {
          expect(fs.readJson).toHaveBeenCalledWith(`${projectPath}/${configFile}`);
          expect(fs.writeJson).toHaveBeenCalledWith(
            `${projectPath}/${configFile}`,
            expect.objectContaining({version: newVersion}),
            {spaces: 2},
          );
          return;
        }

        expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/${configFile}`, 'utf8');

        switch (true) {
          case /\.(toml|zig|zon)$/gi.testconfigFile:
            expect(fs.writeFile).toHaveBeenCalledWith(
              `${projectPath}/${configFile}`,
              expect.stringContaining(`version = "${newVersion}"`),
              'utf8',
            );
            break;
          case configFile.endsWith('jsonc'):
            expect(fs.writeFile).toHaveBeenCalledWith(
              `${projectPath}/${configFile}`,
              expect.stringContaining(`"version": "${newVersion}"`),
            );
            break;
        }
      } finally {
        unMockConsole(['error']);
      }
    });
  });
};

export const setupUpdateVersionTestNoConfig = ({updateVersion}) => {
  describe('when no config file exists', () => {
    it('ends with error message', async () => {
      fs.existingFile = 'unknown';

      try {
        mockConsole(['error']);
        await updateVersion({projectPath, newVersion});
        expect(console.error).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No version file found'));
      } finally {
        unMockConsole(['error']);
      }
    });
  });
};
