import {execa} from 'execa';
import * as changelog from '../utils/changelog.js';
import {logger} from '../utils/logging.js';
import {mockPino, setupPinoLoggingCallsTest, unMockPino} from './setup.logging.tests.js';
import fs from 'fs/promises';
import path from 'path';
import {tmpdir} from 'os';

const log = logger.child({module: 'vitest/version-detect-update-tests'});

export const folder = 'test-project';
export const projectNameValue = 'project'; // Renamed from name to projectName
export const oldVersion = '1.7.3';
export const projectPath = '/test/project';
export const newVersion = '2.0.0';

// TODO: Remove this when all tests are migrated to the new setup
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

// TODO: Remove this when all tests are migrated to the new setup
export const mockWriteFile = (shouldThrow = false) => {
  vi.spyOn(changelog.forMock, 'writeFile').mockImplementation(async (path, _content) => {
    // console.log(`writeFile ${path} ${_content}`);
    if (shouldThrow) {
      log.error({filePath: path, error: null}, changelog.warnFailedToWrite);
    }
  });
};

// TODO: Remove this when all tests are migrated to the new setup
export const unMockReadFile = () => {
  changelog.forMock.readFile.mockRestore();
};

// TODO: Remove this when all tests are migrated to the new setup
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

/**
 * @typedef {import('../detect.js').ProjectInfo} ProjectInfo
 */

/**
 *
 * @param {() => Promise<string>} creator - Function that creates temp folder and returns path
 * @param {(projectPath: string) => Promise<ProjectInfo>} parser - Function that parses the project
 * @param {ProjectInfo} expected - Expected result
 * @param {Object} testLogMessage - Expected log message
 * @param {Object} options - Additional options
 */
export const setupVersionDetectTest2 = async ({
  creator,
  parser,
  expected = null,
  testLogMessage = null,
  options = {},
}) => {
  const {logger} = {
    logger: log,
    ...options,
  };

  mockPino(logger);
  let projectPath = null;
  let customParser = null;

  try {
    const creatorResult = await creator();

    // Handle both string return (simple path) and object return (with customParser)
    if (typeof creatorResult === 'string') {
      projectPath = creatorResult;
    } else {
      projectPath = creatorResult.projectPath;
      customParser = creatorResult.customParser;
    }

    // Execute - use customParser if provided, otherwise use the passed parser
    const parserToUse = customParser || parser;
    const result = await parserToUse(projectPath);

    // Verify
    if (expected) {
      expect(result).toEqual({
        name: projectNameValue,
        version: oldVersion,
        ...expected,
      });
    }

    if (testLogMessage) {
      setupPinoLoggingCallsTest(testLogMessage.method, ...testLogMessage.expected, logger);
    }
  } finally {
    unMockPino(logger);
    await removeTempProjectFolder(projectPath);
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

/**
 * Creates a temporary folder for testing purposes.
 *
 * @param {string} prefix - Prefix for the temporary folder name, defaults to 'node'.
 * @returns {Promise<string>} - A promise that resolves to the path of the created temporary folder.
 */
export const createTempProjectFolder = async (prefix = 'node') => {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), `${prefix}-`));
  await execa(['git', 'init'], {cwd: tempDir});
  await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\nThis is a test project.');
  return tempDir;
};

export const removeTempProjectFolder = async (folderPath) => {
  if (projectPath) {
    return fs.rm(folderPath, {recursive: true});
  }
};

/**
 * Creates a JSON file with the specified content.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createJsonFile = async (filePath, content = {version: oldVersion, name: projectNameValue}) =>
  fs.writeFile(filePath, JSON.stringify(content, null, 2));

/**
 * Creates a go.mod file with the specified content.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createGoModFile = async (filePath, content = {version: oldVersion, name: projectNameValue}) =>
  fs.writeFile(filePath, [`module github.com/${content.name}`, `go 1.16`, `// Version: ${content.version}`].join('\n'));

/**
 * Creates a poetry.toml file with the specified content.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createPythonPoetryTomlFile = async (filePath, content = {version: oldVersion, name: projectNameValue}) =>
  fs.writeFile(filePath, [`[tool.poetry]`, `name = "${content.name}"`, `version = "${content.version}"`].join('\n'));

/**
 * Creates a pyproject.toml file with the specified content.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createPythonPyProjectTomlFile = async (
  filePath,
  content = {version: oldVersion, name: projectNameValue},
) => fs.writeFile(filePath, [`[project]`, `name = "${content.name}"`, `version = "${content.version}"`].join('\n'));

/**
 * Creates a 'broken' file with invalid content.'
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export const createBrokenFile = async (filePath) => {
  fs.writeFile(filePath, 'versions: 1.2.3-beta');
};

/**
 * Creates a build.zig file with the specified content.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createZigBuildFile = async (filePath, content = {version: oldVersion, name: projectNameValue}) =>
  fs.writeFile(
    filePath,
    `const std = @import("std");

pub fn build(b: *std.Build) void {
    const exe = b.addExecutable(.{
        .name = "${content.name}",
        .version = "${content.version}",
    });
}`,
  );

/**
 * Creates a build.zig.zon file with the specified content.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createZigBuildZonFile = async (filePath, content = {version: oldVersion, name: projectNameValue}) =>
  fs.writeFile(
    filePath,
    `.{
    .name = "${content.name}",
    .version = "${content.version}",
}`,
  );

/**
 * Creates a custom parser file with version and name data.
 * @param {string} filePath
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createCustomParserFile = async (filePath, content = {version: oldVersion, name: projectNameValue}) =>
  fs.writeFile(filePath, `version: ${content.version}\nname: ${content.name}`);

/**
 * Creates multiple JSON files in a project directory.
 * @param {string} projectPath
 * @param {Array<string>} files
 * @param {Object} content
 * @returns {Promise<void>}
 */
export const createMultipleJsonFiles = async (
  projectPath,
  files,
  content = {version: oldVersion, name: projectNameValue},
) => {
  await Promise.all(
    files.map((file, index) =>
      createJsonFile(path.join(projectPath, file), {
        name: index === 0 ? content.name : `${content.name}-${file.split('.')[0]}`,
        version: content.version,
      }),
    ),
  );
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
