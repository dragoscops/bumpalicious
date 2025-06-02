import {beforeEach, describe, it, vi} from 'vitest';
import toml from '@iarna/toml';
import {detect, update} from './rust.js';
import {log as detectLog} from '../detect.js';
import {forMock as changelogForMock} from '../../../utils/changelog.js';
import {
  setupVersionDetectTest,
  mockReadFile,
  unMockReadFile,
  newVersion,
  setupVersionUpdateTest,
  mockWriteFile,
  unMockWriteFile,
} from '../../../vitest/setup.detect-update.tests.js';
import {mockPino, unMockPino, setupPinoLoggingCallsTest} from '../../../vitest/setup.logging.tests.js';

describe.skip('detect/rust.js module', () => {
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
      mockPino(detectLog);
      mockReadFile('Cargo.toml');
      const parseSpy = vi.spyOn(toml, 'parse').mockImplementation(() => {
        throw new Error('Parsing error');
      });

      try {
        await detect('/project');

        setupPinoLoggingCallsTest(
          'warn',
          [
            expect.objectContaining({filePath: expect.stringContaining('Cargo.toml'), error: expect.any(Error)}),
            'Failed to parse version file',
          ],
          detectLog,
        );
      } finally {
        parseSpy.mockRestore();
        unMockReadFile();
        unMockPino(detectLog);
      }
    });
  });

  describe('update()', () => {
    it('should update version in Cargo.toml when Cargo.toml exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `version = "${newVersion}"`, 'Cargo.toml');
    });

    it('should update all rust config files when multiple exist', async () => {
      // Test that all rust files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['Cargo.toml'];
        expect(changelogForMock.writeFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(changelogForMock.writeFile).toHaveBeenCalledWith(
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
