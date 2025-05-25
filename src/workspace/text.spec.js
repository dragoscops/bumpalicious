import {beforeEach, describe, it, vi} from 'vitest';
import {detect} from './text.js';
import {setupVersionDetectTest, mockReadFile, unMockReadFile} from '../vitest/setup.detect-update.tests.js';
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
      mockReadFile('version');

      try {
        await detect('/project');

        // The detect function should complete without throwing, even if some files aren't found
        // This tests the graceful degradation when files are missing
      } finally {
        unMockReadFile();
        unMockCConsole(['warning', 'error']);
        unMockConsole(['warning', 'error']);
      }
    });
  });
});
