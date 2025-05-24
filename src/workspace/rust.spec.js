import {beforeEach, describe, it, vi} from 'vitest';
import {detect} from './rust.js';
import {
  setupVersionDetectTest,
  mockReadFile,
  unMockReadFile,
} from '../vitest/setup.detect-update.tests.js';
import {
  mockConsole,
  mockCConsole,
  unMockConsole,
  unMockCConsole,
} from '../vitest/setup.logging.tests.js';

describe('detect/rust.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with Cargo.toml
    it('should detect from Cargo.toml', async () => {
      await setupVersionDetectTest(() => detect('/project'), {
        name: 'project',
      }, 'Cargo.toml');
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('Cargo.toml');

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
