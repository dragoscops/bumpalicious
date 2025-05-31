import * as update from '../core/version/update.js';
import * as changelog from '../utils/changelog.js';
import {logger} from '../utils/logging.js';
import {mockConsole, mockCConsole, unMockConsole, unMockCConsole, mockPino, unMockPino} from './setup.logging.tests.js';

const log = logger.child({module: 'vitest/version-detect-update-tests'});

export const folder = 'test-project';
export const projectNameValue = 'project'; // Renamed from name to projectName
export const oldVersion = '1.7.3';
export const projectPath = '/test/project';
export const newVersion = '2.0.0';

export const mockReadFile = (file = null) => {
  vi.spyOn(changelog.forMock, 'readFile').mockImplementation(async (filePath) => {
    if (file) {
      // If a specific file is provided, return its content
      if (filePath.endsWith(file) || filePath === file) {
        return Promise.resolve(configMocks[file]);
      }
      log.warn({filePath, error: null}, changelog.warnFailedToRead);
      return Promise.resolve(null);
    }

    for (const [key, value] of Object.entries(configMocks)) {
      if (filePath.endsWith(key) || filePath === key) {
        return Promise.resolve(value);
      }
    }

    log.warn({filePath, error: null}, changelog.warnFailedToRead);
    return Promise.resolve(null);
  });
};

export const mockWriteFile = (shouldThrow = false) => {
  vi.spyOn(changelog.forMock, 'writeFile').mockImplementation(async (path, _content) => {
    console.log(`writeFile ${path} ${_content}`);
    if (shouldThrow) {
      log.error({filePath: path, error: null}, changelog.warnFailedToWrite);
    }
  });
};

export const unMockReadFile = () => {
  changelog.forMock.readFile.mockRestore();
};

export const unMockWriteFile = () => {
  changelog.forMock.writeFile.mockRestore();
};

export const setupVersionDetectTest = async (
  parser,
  expectedResult = {
    name: projectNameValue,
    version: oldVersion,
  },
  testFile = null,
) => {
  mockReadFile(testFile);
  mockPino();
  try {
    // Execute
    const result = await parser();

    // Verify
    expect(result).toEqual({
      name: projectNameValue,
      version: oldVersion,
      ...expectedResult,
    });
  } finally {
    unMockReadFile();
    unMockPino();
  }
};

export const setupVersionUpdateTest = async (updater, expectedResult = '') => {
  mockPino();
  mockReadFile();
  mockWriteFile();
  try {
    const result = await updater(newVersion);
    expect(result).toBeTruthy();

    if (typeof expectedResult === 'string') {
      expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(expectedResult),
      );
    } else {
      for (const index in expectedResult) {
        expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(expectedResult[index]),
        );
      }
    }
  } finally {
    unMockWriteFile();
    unMockReadFile();
    unMockPino();
  }
};

const configMocks = {
  'custom-parser.txt': 'version: 1.2.3-beta\nname: MyApp',
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
  'go.mod': [`module github.com/${projectNameValue}`, `go 1.16`, `// Version: ${oldVersion}`].join('\n'),
  'version.go': [
    'package version',
    `const Version = "${oldVersion}"`,
    'func GetVersion() string {',
    '  return Version',
    '}',
  ].join('\n'),
  'pyproject.toml': ['[project]', `name = "${projectNameValue}"`, `version = "${oldVersion}"`].join('\n'),
  'poetry.toml': ['[tool.poetry]', `name = "${projectNameValue}"`, `version = "${oldVersion}"`].join('\n'),
  'setup.py': ['setup(', `name="${projectNameValue}",`, `version="${oldVersion}"`, `)`].join('\n'),
  'setup.cfg': [`[metadata]`, `name = ${projectNameValue}`, `version = ${oldVersion}`].join('\n'),
  '__init__.py': [
    '"""Package initialization."""',
    `__version__ = "${oldVersion}"`,
    `__name__ = "${projectNameValue}"`,
  ].join('\n'),
  ...['version', 'version.txt', 'VERSION', 'VERSION.txt'].reduce((acc, file) => {
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
