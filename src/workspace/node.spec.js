import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './node.js';
import {
  setupVersionDetectTest,
  mockReadFile,
  unMockReadFile,
  newVersion,
  setupVersionUpdateTest,
} from '../vitest/setup.detect-update.tests.js';
import {
  mockConsole,
  mockCConsole,
  unMockConsole,
  unMockCConsole,
  setupLoggingCallsTest,
} from '../vitest/setup.logging.tests.js';

describe('detect/node.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
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
      mockReadFile('package.json');
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

  describe('update()', () => {
    it('should update version in jsr.json when only jsr.json exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `"version": "${newVersion}"`, 'jsr.json');
    });

    it('should update version in package.json when only package.json exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `"version": "${newVersion}"`, 'package.json');
    });
  });
});
