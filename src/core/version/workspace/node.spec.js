import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './node.js';
import {log as detectLog} from '../detect.js';
import * as changelog from '../../../utils/changelog.js';
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
      mockPino(detectLog);
      mockReadFile('package.json');
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
        throw new Error('Parsing error');
      });

      try {
        await detect('/project');

        setupPinoLoggingCallsTest(
          'warn',
          [
            expect.objectContaining({filePath: expect.stringContaining('package.json'), error: expect.any(Error)}),
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
    it('should update version in jsr.json when only jsr.json exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `"version": "${newVersion}"`, 'jsr.json');
    });

    it('should update version in package.json when only package.json exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `"version": "${newVersion}"`, 'package.json');
    });

    it('should update all node config files when multiple exist', async () => {
      // Test that all node files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['jsr.json', 'package.json'];
        expect(changelog.forMock.writeFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
            expect.stringContaining(file),
            expect.stringContaining(`"version": "${newVersion}"`),
          );
        });
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
