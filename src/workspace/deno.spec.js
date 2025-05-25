import {beforeEach, describe, it, vi} from 'vitest';
import {detect} from './deno.js';
import {
  mockConfigFiles,
  setupVersionDetectTest,
  projectNameValue,
  mockReadFile,
  unMockReadFile,
} from '../vitest/setup.detect-update.tests.js';
import {
  mockConsole,
  mockCConsole,
  unMockConsole,
  unMockCConsole,
  setupLoggingCallsTest,
} from '../vitest/setup.logging.tests.js';

describe('detect/deno.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with deno.jsonc
    it('should detect from deno.jsonc', async () => {
      await setupVersionDetectTest(() => detect('/project'), {}, 'deno.jsonc');
    });

    // Test detection with deno.json
    it('should detect from deno.json', async () => {
      await setupVersionDetectTest(() => detect('/project'), {}, 'deno.json');
    });

    // Test detection with jsr.json
    it('should detect from jsr.json', async () => {
      await setupVersionDetectTest(() => detect('/project'), {}, 'jsr.json');
    });

    // Test detection with package.json
    it('should detect from package.json', async () => {
      await setupVersionDetectTest(() => detect('/project'), {}, 'package.json');
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('deno.json');
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
        throw new Error('Parsing error');
      });

      try {
        await detect('/project');

        setupLoggingCallsTest(
          'warning',
          [expect.stringContaining('WARNING'), expect.stringContaining('Failed to parse'), expect.any(Error)],
          2,
        );
      } finally {
        parseSpy.mockRestore();
        unMockReadFile();
        unMockCConsole(['warning', 'error']);
        unMockConsole(['warning', 'error']);
      }
    });
  });
});
