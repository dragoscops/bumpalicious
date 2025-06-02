import {describe, it, beforeEach, afterEach} from 'vitest';
import JSONC from 'tiny-jsonc';
import toml from '@iarna/toml';
import path from 'path';
import fs from 'fs/promises';

import {
  createGoModFile,
  createJsonFile,
  createPythonPoetryTomlFile,
  createTempProjectFolder,
  createZigBuildFile,
  createZigBuildZonFile,
  mockReadFile,
  oldVersion,
  projectNameValue,
  removeTempProjectFolder,
  unMockReadFile,
} from '../../vitest/setup.detect-update.tests';
import * as detect from './detect.js';
import {warnNoProvidedParsersToAggregator, warnFailedToAggregateVersion, log} from './detect.js';
import {mockPino, setupPinoLoggingCallsTest, unMockPino} from '../../vitest/setup.logging.tests.js';

describe('detect.js', () => {
  beforeEach(() => {
    mockPino(log);
  });

  afterEach(async () => {
    unMockPino(log);
  });

  describe('configParser', () => {
    // Test for deno.json
    it('should parse deno.json file correctly', async () => {
      const projectPath = await createTempProjectFolder('detect');
      await createJsonFile(path.join(projectPath, 'deno.json'), {
        name: projectNameValue,
        version: oldVersion,
      });

      const result = detect.configParser(path.join(projectPath, 'deno.json'), {
        parser: JSON.parse,
        version: ['version'],
        name: ['name'],
      })();
      expect(await result).toEqual({name: projectNameValue, version: oldVersion});

      await removeTempProjectFolder(projectPath);
    });

    // Test extraction with function extractor
    it('should use function extractor when provided', async () => {
      const projectPath = await createTempProjectFolder('detect');
      await fs.writeFile(
        path.join(projectPath, 'custom-parser.txt'),
        `version: ${oldVersion}\nname: ${projectNameValue}`,
      );

      const result = detect.configParser(path.join(projectPath, 'custom-parser.txt'), {
        parser: (data) => data.trim(),
        version: (data) => {
          const match = data.match(/version:\s*(\d+\.\d+\.\d+[^\s]*)/);
          return match?.[1] ?? null;
        },
        name: (data) => {
          const match = data.match(/name:\s*(\w+)/);
          return match?.[1] ?? null;
        },
      })();
      expect(await result).toEqual({name: projectNameValue, version: oldVersion});

      await removeTempProjectFolder(projectPath);
    });

    // Test with multiple extractors (string path and regex)
    it('should try multiple extractors in order', async () => {
      const projectPath = await createTempProjectFolder('detect');
      await createPythonPoetryTomlFile(path.join(projectPath, 'poetry.toml'), {
        name: projectNameValue,
        version: oldVersion,
      });

      const result = detect.configParser(path.join(projectPath, 'poetry.toml'), {
        parser: toml.parse,
        version: ['project.version', 'tool.poetry.version'],
        name: ['project.name', 'tool.poetry.name'],
      })();
      expect(await result).toEqual({name: projectNameValue, version: oldVersion});

      await removeTempProjectFolder(projectPath);
    });
  });

  describe('anyOf', () => {
    it('should return the first valid parser result for deno project files', async () => {
      const projectPath = await createTempProjectFolder('detect');
      await createJsonFile(path.join(projectPath, 'deno.jsonc'), {
        name: projectNameValue,
        version: oldVersion,
      });
      await createJsonFile(path.join(projectPath, 'deno.json'), {
        name: `${projectNameValue}-deno`,
        version: oldVersion,
      });

      // Create parsers for each potential file
      const denoJsoncParser = detect.configParser(path.join(projectPath, 'deno.jsonc'), {
        parser: JSONC.parse,
        version: ['version'],
        name: ['name'],
      });
      const denoJsonParser = detect.configParser(path.join(projectPath, 'deno.json'), {
        parser: JSON.parse,
        version: ['version'],
        name: ['name'],
      });

      const result = await detect.anyOf(projectPath, 'deno', [denoJsoncParser, denoJsonParser]);

      expect(result).toEqual({name: projectNameValue, version: oldVersion});

      await removeTempProjectFolder(projectPath);
    });

    it('should log a warning when no parsers are provided', async () => {
      // Execute anyOf with no parsers
      const result = await detect.anyOf('/project', 'deno', []);

      // Should return null version and name
      expect(result).toEqual({version: null, name: null});

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{folderPath: '/project', projectType: 'deno', aggregator: 'anyOf'}, warnNoProvidedParsersToAggregator],
        log,
      );
    });

    it('should log a warning when no valid version is found', async () => {
      mockReadFile();

      // Execute anyOf with a parser that won't find a version
      const result = await detect.anyOf('/project', 'deno', [
        detect.configParser('deno.json', {
          parser: JSON.parse,
          version: ['nonexistent'],
          name: ['name'],
        }),
      ]);

      // Should return null version and name
      expect(result).toEqual({version: null, name: null});

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{folderPath: '/project', projectType: 'deno', aggregator: 'anyOf'}, warnFailedToAggregateVersion],
        log,
      );

      unMockReadFile();
    });
  });

  describe('merge', () => {
    it('should merge results from multiple parsers for Zig project files', async () => {
      const projectPath = await createTempProjectFolder('detect');

      // Create test files with Zig syntax
      await createZigBuildFile(path.join(projectPath, 'build.zig'), {
        name: projectNameValue,
        version: oldVersion,
      });

      await createZigBuildZonFile(path.join(projectPath, 'build.zig.zon'), {
        name: projectNameValue,
        version: oldVersion,
      });

      // Create parsers for Zig files
      const buildZigParser = detect.configParser(path.join(projectPath, 'build.zig'), {
        parser: (data) => data,
        name: [/\.name\s*=\s*"([^"]+)"/],
        version: [/\.version\s*=\s*"([^"]+)"/],
      });

      const buildZigZonParser = detect.configParser(path.join(projectPath, 'build.zig.zon'), {
        parser: (data) => data,
        name: [/\.name\s*=\s*"([^"]+)"/],
        version: [/\.version\s*=\s*"([^"]+)"/],
      });

      // Test the merge function
      const result = await detect.merge(projectPath, 'zig', [buildZigParser, buildZigZonParser]);
      expect(result).toEqual({name: projectNameValue, version: oldVersion});

      await removeTempProjectFolder(projectPath);
    });

    it('should log a warning when no parsers are provided', async () => {
      // Execute merge with no parsers
      const result = await detect.merge('/project', 'zig', []);

      // Should return null version and name
      expect(result).toEqual({version: null, name: null});

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{folderPath: '/project', projectType: 'zig', aggregator: 'merge'}, warnNoProvidedParsersToAggregator],
        log,
      );
    });

    it('should log a warning when merged result has no version or name', async () => {
      mockReadFile();

      // Execute merge with a parser that won't find a version
      const result = await detect.merge('/project', 'deno', [
        detect.configParser('build.zig', {
          parser: (data) => data,
          version: [/test/i],
          name: [/test/i],
        }),
      ]);

      // Should return null version and name
      expect(result).toEqual({version: null, name: null});

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{folderPath: '/project', projectType: 'deno', aggregator: 'merge'}, warnFailedToAggregateVersion],
        log,
      );

      unMockReadFile();
    });
  });
});
