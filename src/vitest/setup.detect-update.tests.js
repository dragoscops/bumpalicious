import {TEXT_VERSION_FILES} from '../workspace/constants.js';
import * as detect from '../core/version/detect.js';
import * as update from '../core/version/update.js';
import * as logging from '../utils/logging.js';
import {mockConsole, mockCConsole, unMockConsole, unMockCConsole} from './setup.logging.tests.js';

export const folder = 'test-project';
export const projectNameValue = 'project'; // Renamed from name to projectName
export const oldVersion = '1.7.3';
export const projectPath = '/test/project';
export const newVersion = '2.0.0';

export const mockReadFile = (file = null) => {
  vi.spyOn(detect.forMock, 'readFile').mockImplementation(async (path) => {
    if (file) {
      // If a specific file is provided, return its content
      if (path.endsWith(file) || path === file) {
        return Promise.resolve(configMocks[file]);
      }
      logging.warning(`Mocked readFile: File not found for path: ${path}`);
      return Promise.resolve(null);
    }

    for (const [key, value] of Object.entries(configMocks)) {
      if (path.endsWith(key) || path === key) {
        return Promise.resolve(value);
      }
    }

    logging.warning(`Mocked readFile: File not found for path: ${path}`);
    return Promise.resolve(null);
  });
};

export const mockWriteFile = (shouldThrow = false) => {
  vi.spyOn(update.forMock, 'writeFile').mockImplementation(async (path, _content) => {
    console.log(`writeFile ${path} ${_content}`);
    if (shouldThrow) {
      logging.error(`Mocked writeFile error for path: ${path}`);
    }
  });
};

export const unMockReadFile = () => {
  detect.forMock.readFile.mockRestore();
};

export const unMockWriteFile = () => {
  update.forMock.writeFile.mockRestore();
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
  mockConsole(['error']);
  mockCConsole(['error']);
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
    unMockConsole(['error']);
    unMockCConsole(['error']);
  }
};

export const setupVersionUpdateTest = async (updater, expectedResult = '') => {
  // mockCConsole();
  // mockConsole();
  mockReadFile();
  mockWriteFile();
  try {
    await updater(newVersion);

    if (typeof expectedResult === 'string') {
      expect(update.forMock.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(expectedResult),
      );
    } else {
      for (const index in expectedResult) {
        expect(update.forMock.writeFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(expectedResult[index]),
        );
      }
    }
  } finally {
    unMockWriteFile();
    unMockReadFile();
    unMockConsole();
    unMockCConsole();
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
