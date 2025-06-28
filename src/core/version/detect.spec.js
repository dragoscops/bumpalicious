import path from 'node:path';
import toml from '@iarna/toml';
import JSONC from 'tiny-jsonc';
import { describe, it, beforeEach, afterEach } from 'vitest';

import * as detect from './detect.js';
import { warnNoProvidedParsersToAggregator, warnFailedToAggregateVersion, log } from './detect.js';
import {
  createJsonFile,
  createPythonPoetryTomlFile,
  createTempProjectFolder,
  createZigBuildFile,
  createZigBuildZonFile,
  createCustomParserFile,
  oldVersion,
  projectNameValue,
  setupVersionDetectTest,
} from '../../vitest/setup.detect-update.tests';
import { mockPinoIn, setupPinoLoggingCallsTest, unMockPinoIn } from '../../vitest/setup.logging.tests.js';

const generateCreator =
  (files = ['deno.json'], wrapper = null) =>
  async () => {
    const projectPath = await createTempProjectFolder('detect');
    let createFile = createJsonFile;
    const customParser = [];

    for (const file of files) {
      switch (true) {
        case file.endsWith('.json'):
        case file.endsWith('.jsonc'):
          createFile = createJsonFile;
          customParser.push(
            detect.configParser(path.join(projectPath, file), {
              parser: file.endsWith('.json') ? JSON.parse : JSONC.parse,
              version: ['version'],
              name: ['name'],
            }),
          );
          break;
        case file.endsWith('.toml'):
          createFile = createPythonPoetryTomlFile;
          customParser.push(
            detect.configParser(path.join(projectPath, file), {
              parser: toml.parse,
              version: ['project.version', 'tool.poetry.version'],
              name: ['project.name', 'tool.poetry.name'],
            }),
          );
          break;
        case file.endsWith('.zig'):
          createFile = createZigBuildFile;
          customParser.push(
            detect.configParser(path.join(projectPath, file), {
              parser: (data) => data.trim(),
              name: [/\.name\s*=\s*"([^"]+)"/],
              version: [/\.version\s*=\s*"([^"]+)"/],
            }),
          );
          break;
        case file.endsWith('.zon'):
          createFile = createZigBuildZonFile;
          customParser.push(
            detect.configParser(path.join(projectPath, file), {
              parser: (data) => data.trim(),
              name: [/\.name\s*=\s*"([^"]+)"/],
              version: [/\.version\s*=\s*"([^"]+)"/],
            }),
          );
          break;
        default:
          createFile = createCustomParserFile;
          customParser.push(
            detect.configParser(path.join(projectPath, 'custom-parser.txt'), {
              parser: (data) => data.trim(),
              version: (data) => {
                const match = data.match(/version:\s*(\d+\.\d+\.\d+[^\s]*)/);
                return match?.[1] ?? null;
              },
              name: (data) => {
                const match = data.match(/name:\s*(\w+)/);
                return match?.[1] ?? null;
              },
            }),
          );
      }
      await createFile(path.join(projectPath, file), {
        name: projectNameValue,
        version: oldVersion,
      });
    }

    return {
      projectPath,
      customParser: wrapper ? (projectPath) => wrapper(projectPath, 'project', customParser) : customParser[0],
    };
  };

describe('core/version/detect.js', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(async () => {
    unMockPinoIn(logMocks);
  });

  describe('configParser', () => {
    // Test for deno.json
    // eslint-disable-next-line vitest/expect-expect
    it('should parse deno.json file correctly', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // Test extraction with function extractor
    // eslint-disable-next-line vitest/expect-expect
    it('should use function extractor when provided', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['custom-parser.txt']),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // Test with multiple extractors (string path and regex)
    // eslint-disable-next-line vitest/expect-expect
    it('should try multiple extractors in order', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['poetry.toml']),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });
  });

  describe('anyOf', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should return the first valid parser result for deno project files', async () => {
      await setupVersionDetectTest({
        // creator: generateDenoMultiFileCreator(),
        creator: generateCreator(['deno.jsonc', 'deno.json'], detect.anyOf),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    it('should log a warning when no parsers are provided', async () => {
      // Execute anyOf with no parsers
      const result = await detect.anyOf('/project', 'deno', []);

      // Should return null version and name
      expect(result).toEqual({ version: null, name: null });

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{ folderPath: '/project', projectType: 'deno', aggregator: 'anyOf' }, warnNoProvidedParsersToAggregator],
        log,
      );
    });

    it('should log a warning when no valid version is found', async () => {
      // Execute anyOf with a parser that won't find a version
      const result = await detect.anyOf('/project', 'deno', [
        detect.configParser('deno.json', {
          parser: JSON.parse,
          version: ['nonexistent'],
          name: ['name'],
        }),
      ]);

      // Should return null version and name
      expect(result).toEqual({ version: null, name: null });

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{ folderPath: '/project', projectType: 'deno', aggregator: 'anyOf' }, warnFailedToAggregateVersion],
        log,
      );
    });
  });

  describe('merge', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should merge results from multiple parsers for Zig project files', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['build.zig', 'build.zig.zon'], detect.merge),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    it('should log a warning when no parsers are provided', async () => {
      // Execute merge with no parsers
      const result = await detect.merge('/project', 'zig', []);

      // Should return null version and name
      expect(result).toEqual({ version: null, name: null });

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{ folderPath: '/project', projectType: 'zig', aggregator: 'merge' }, warnNoProvidedParsersToAggregator],
        log,
      );
    });

    it('should log a warning when merged result has no version or name', async () => {
      // Execute merge with a parser that won't find a version
      const result = await detect.merge('/project', 'deno', [
        detect.configParser('non-existent-file.zig', {
          parser: (data) => data,
          version: [/test/i],
          name: [/test/i],
        }),
      ]);

      // Should return null version and name
      expect(result).toEqual({ version: null, name: null });

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest(
        'warn',
        [{ folderPath: '/project', projectType: 'deno', aggregator: 'merge' }, warnFailedToAggregateVersion],
        log,
      );
    });
  });
});
