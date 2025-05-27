import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './go.js';
import {
  setupVersionDetectTest,
  setupVersionUpdateTest,
  mockReadFile,
  unMockReadFile,
  newVersion,
} from '../vitest/setup.detect-update.tests.js';
import {mockConsole, mockCConsole, unMockConsole, unMockCConsole} from '../vitest/setup.logging.tests.js';

describe('detect/go.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with go.mod
    it('should detect from go.mod', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'github.com/project',
        },
        'go.mod',
      );
    });

    // Test detection with version.go
    it('should detect from version.go', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'version', // Package name from version.go
        },
        'version.go',
      );
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('go.mod');

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

  describe('update()', () => {
    // Test updating go.mod
    it('should update version in go.mod', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `// version: ${newVersion}`);
    });

    // Test updating version.go
    it('should update version in version.go', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `const Version = "${newVersion}"`);
    });
  });
});
