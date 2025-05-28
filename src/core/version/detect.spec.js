import {describe, it, beforeEach, afterEach} from 'vitest';
import JSONC from 'tiny-jsonc';
import toml from '@iarna/toml';

import {
  mockReadFile,
  projectNameValue,
  setupVersionDetectTest,
  unMockReadFile,
} from '../../vitest/setup.detect-update.tests';
import * as detect from './detect.js';
import {
  warnNoProvidedParsersToAggregator,
  warnFailedToAggregateVersion,
  log,
} from './detect.js';
import {mockPino, setupPinoLoggingCallsTest, unMockPino} from '../../vitest/setup.logging.tests.js';

describe('detect.js', () => {
  beforeEach(() => {
    mockPino([], log);
  });

  afterEach(() => {
    unMockPino([], log);
  });

  describe('configParser', () => {
    // Test for deno.json
    it('should parse deno.json file correctly', async () => {
      await setupVersionDetectTest(
        detect.configParser('deno.json', {
          parser: JSON.parse,
          version: ['version'],
          name: ['name'],
        }),
      );
    });

    // Test for go.mod
    it('should parse go.mod file correctly with version comment', async () => {
      // Create custom parser for go.mod
      await setupVersionDetectTest(
        detect.configParser('go.mod', {
          parser: (data) => data, // pass through raw content
          version: [/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+)/m],
          name: [/module\s+([\w./\-@:]+)/m],
        }),
        {
          name: `github.com/${projectNameValue}`,
        },
      );
    });

    // Test for Cargo.toml
    it('should parse Cargo.toml file correctly', async () => {
      // Create parser with custom parser function
      await setupVersionDetectTest(
        detect.configParser('Cargo.toml', {
          parser: toml.parse,
          version: ['package.version'],
          name: ['package.name'],
        }),
      );
    });

    // Test extraction with function extractor
    it('should use function extractor when provided', async () => {
      const customVersionExtractor = (data) => {
        const match = data.match(/version:\s*(\d+\.\d+\.\d+[^\s]*)/);
        return match?.[1] ?? null;
      };

      const customNameExtractor = (data) => {
        const match = data.match(/name:\s*(\w+)/);
        return match?.[1] ?? null;
      };

      // Create parser with function extractors
      await setupVersionDetectTest(
        detect.configParser('custom-parser.txt', {
          parser: (data) => data, // pass through raw content
          version: [customVersionExtractor],
          name: [customNameExtractor],
        }),
        {
          name: 'MyApp',
          version: '1.2.3-beta',
        },
      );
    });

    // Test with multiple extractors (string path and regex)
    it('should try multiple extractors in order', async () => {
      await setupVersionDetectTest(
        detect.configParser('poetry.toml', {
          parser: toml.parse,
          version: ['project.version', 'tool.poetry.version'],
          name: ['project.name', 'tool.poetry.name'],
        }),
      );
    });
  });

  describe('anyOf', () => {
    it('should return the first valid parser result for deno project files', async () => {
      // Create parsers for each potential file
      const denoJsoncParser = detect.configParser('deno.jsonc', {
        parser: JSONC.parse,
        version: ['version'],
        name: ['name'],
      });
      const denoJsonParser = detect.configParser('deno.json', {
        parser: JSON.parse,
        version: ['version'],
        name: ['name'],
      });
      const packageJsonParser = detect.configParser('package.json', {
        parser: JSON.parse,
        version: ['version'],
        name: ['name'],
      });

      await setupVersionDetectTest(() =>
        detect.anyOf('/project', 'deno', [denoJsoncParser, denoJsonParser, packageJsonParser]),
      );
    });

    it('should log a warning when no parsers are provided', async () => {
      // Execute anyOf with no parsers
      const result = await detect.anyOf('/project', 'deno', []);

      // Should return null version and name
      expect(result).toEqual({version: null, name: null});

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest('warn', [{folderPath: '/project', projectType: 'deno', aggregator: 'anyOf'}, warnNoProvidedParsersToAggregator], log);
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
      setupPinoLoggingCallsTest('warn', [{folderPath: '/project', projectType: 'deno', aggregator: 'anyOf'}, warnFailedToAggregateVersion], log);

      unMockReadFile();
    });
  });

  describe('merge', () => {
    it('should merge results from multiple parsers for Zig project files', async () => {
      // Create parsers for Zig files
      const buildZigParser = detect.configParser('build.zig', {
        parser: (data) => data,
        name: [/\.name\s*=\s*"([^"]+)"/],
        version: [/\.version\s*=\s*"([^"]+)"/],
      });

      const buildZigZonParser = detect.configParser('build.zig.zon', {
        parser: (data) => data,
        name: [/\.name\s*=\s*"([^"]+)"/],
        version: [/\.version\s*=\s*"([^"]+)"/],
      });

      // Test the merge function
      await setupVersionDetectTest(() => detect.merge('/project', 'zig', [buildZigParser, buildZigZonParser]));
    });

    it('should log a warning when no parsers are provided', async () => {
      // Execute merge with no parsers
      const result = await detect.merge('/project', 'zig', []);

      // Should return null version and name
      expect(result).toEqual({version: null, name: null});

      // Check the pino log was called with the expected message
      setupPinoLoggingCallsTest('warn', [{folderPath: '/project', projectType: 'zig', aggregator: 'merge'}, warnNoProvidedParsersToAggregator], log);
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
      setupPinoLoggingCallsTest('warn', [{folderPath: '/project', projectType: 'deno', aggregator: 'merge'}, warnFailedToAggregateVersion], log);

      unMockReadFile();
    });
  });
});
