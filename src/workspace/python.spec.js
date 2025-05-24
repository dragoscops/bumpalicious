import {beforeEach, describe, it, vi} from 'vitest';
import {detect} from './python.js';
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

describe('detect/python.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with pyproject.toml
    it('should detect from pyproject.toml', async () => {
      await setupVersionDetectTest(() => detect('/project'), {
        name: 'project',
      }, 'pyproject.toml');
    });

    // Test detection with poetry.toml
    it('should detect from poetry.toml', async () => {
      await setupVersionDetectTest(() => detect('/project'), {
        name: 'project',
      }, 'poetry.toml');
    });

    // Test detection with setup.py
    it('should detect from setup.py', async () => {
      await setupVersionDetectTest(() => detect('/project'), {
        name: 'project',
      }, 'setup.py');
    });

    // Test detection with setup.cfg
    it('should detect from setup.cfg', async () => {
      await setupVersionDetectTest(() => detect('/project'), {
        name: 'project',
      }, 'setup.cfg');
    });

    // Test detection with __init__.py
    it('should detect from __init__.py', async () => {
      await setupVersionDetectTest(() => detect('/project'), {
        name: 'project',
      }, '__init__.py');
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('pyproject.toml');

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
