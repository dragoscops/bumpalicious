import {beforeEach, describe, it, vi} from 'vitest';
import {detect} from './zig.js';
import {setupVersionDetectTest, mockReadFile, unMockReadFile} from '../vitest/setup.detect-update.tests.js';
import {mockConsole, mockCConsole, unMockConsole, unMockCConsole} from '../vitest/setup.logging.tests.js';

describe('detect/zig.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with build.zig
    it('should detect from build.zig', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'build.zig',
      );
    });

    // Test detection with build.zig.zon
    it('should detect from build.zig.zon', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'build.zig.zon',
      );
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('build.zig');

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
