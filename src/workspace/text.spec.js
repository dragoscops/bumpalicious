import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './text.js';
import {
  setupVersionDetectTest,
  mockReadFile,
  unMockReadFile,
  newVersion,
  setupVersionUpdateTest,
  mockWriteFile,
  unMockWriteFile,
} from '../vitest/setup.detect-update.tests.js';
import {mockConsole, mockCConsole, unMockConsole, unMockCConsole} from '../vitest/setup.logging.tests.js';

describe('detect/text.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with version
    it('should detect from version', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'version',
      );
    });

    // Test detection with version.txt
    it('should detect from version.txt', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'version.txt',
      );
    });

    // Test detection with VERSION
    it('should detect from VERSION', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'VERSION',
      );
    });

    // Test detection with VERSION.txt
    it('should detect from VERSION.txt', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'VERSION.txt',
      );
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      // Mock to return null for all files (no files found)
      mockReadFile('nonexistent.txt');

      try {
        const result = await detect('/project');

        // Should return null when no files are found
        expect(result).toEqual({version: null, name: null});
      } finally {
        unMockReadFile();
        unMockCConsole(['warning', 'error']);
        unMockConsole(['warning', 'error']);
      }
    });
  });

  describe('update()', () => {
    it('should update version in version when only version exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), newVersion, 'version');
    });

    it('should update version in version.txt when only version.txt exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), newVersion, 'version.txt');
    });

    it('should update version in VERSION when only VERSION exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), newVersion, 'VERSION');
    });

    it('should update version in VERSION.txt when only VERSION.txt exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), newVersion, 'VERSION.txt');
    });

    // TODO: must find a way to test this
    it.skip('should update all text config files when multiple exist', async () => {
      // Test that all text files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['version', 'version.txt', 'VERSION', 'VERSION.txt'];
        expect(mockWriteFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(mockWriteFile).toHaveBeenCalledWith(expect.stringContaining(file), newVersion);
        });
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
