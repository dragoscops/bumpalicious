import {beforeEach, describe, it, vi} from 'vitest';
import toml from '@iarna/toml';
import {detect, update} from './rust.js';
import {
  setupVersionDetectTest,
  mockReadFile,
  unMockReadFile,
  newVersion,
  setupVersionUpdateTest,
  mockWriteFile,
  unMockWriteFile,
} from '../vitest/setup.detect-update.tests.js';
import {
  mockConsole,
  mockCConsole,
  unMockConsole,
  unMockCConsole,
  setupLoggingCallsTest,
} from '../vitest/setup.logging.tests.js';

describe('detect/rust.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with Cargo.toml
    it('should detect from Cargo.toml', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'Cargo.toml',
      );
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('Cargo.toml');
      const parseSpy = vi.spyOn(toml, 'parse').mockImplementation(() => {
        throw new Error('Parsing error');
      });

      try {
        await detect('/project');

        setupLoggingCallsTest(
          'warning',
          [expect.stringContaining('WARNING'), expect.stringContaining('Failed to parse'), expect.any(Error)],
          1,
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
    it('should update version in Cargo.toml when Cargo.toml exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `version = "${newVersion}"`, 'Cargo.toml');
    });

    // TODO: must find a way to test this
    it.skip('should update all rust config files when multiple exist', async () => {
      // Test that all rust files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['Cargo.toml'];
        expect(mockWriteFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(mockWriteFile).toHaveBeenCalledWith(
            expect.stringContaining(file),
            expect.stringContaining(`version = "${newVersion}"`),
          );
        });
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
