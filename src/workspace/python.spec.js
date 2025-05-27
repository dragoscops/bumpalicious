import {beforeEach, describe, it, vi} from 'vitest';
import toml from '@iarna/toml';
import {detect, update} from './python.js';
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

describe('detect/python.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with pyproject.toml
    it('should detect from pyproject.toml', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'pyproject.toml',
      );
    });

    // Test detection with poetry.toml
    it('should detect from poetry.toml', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'poetry.toml',
      );
    });

    // Test detection with setup.py
    it('should detect from setup.py', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'setup.py',
      );
    });

    // Test detection with setup.cfg
    it('should detect from setup.cfg', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        'setup.cfg',
      );
    });

    // Test detection with __init__.py
    it('should detect from __init__.py', async () => {
      await setupVersionDetectTest(
        () => detect('/project'),
        {
          name: 'project',
        },
        '__init__.py',
      );
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockConsole(['warning', 'error']);
      mockCConsole(['warning', 'error']);
      mockReadFile('pyproject.toml');
      const parseSpy = vi.spyOn(toml, 'parse').mockImplementation(() => {
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
    it('should update version in pyproject.toml when only pyproject.toml exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `version = "${newVersion}"`, 'pyproject.toml');
    });

    it('should update version in poetry.toml when only poetry.toml exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `version = "${newVersion}"`, 'poetry.toml');
    });

    it('should update version in setup.py when only setup.py exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `version="${newVersion}"`, 'setup.py');
    });

    it('should update version in setup.cfg when only setup.cfg exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `version = ${newVersion}`, 'setup.cfg');
    });

    it('should update version in __init__.py when only __init__.py exists', async () => {
      await setupVersionUpdateTest(
        () => update('/project', newVersion),
        `__version__ = "${newVersion}"`,
        '__init__.py',
      );
    });

    // TODO: must find a way to test this
    it.skip('should update all python config files when multiple exist', async () => {
      // Test that all python files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['pyproject.toml', 'poetry.toml', 'setup.py', 'setup.cfg', '__init__.py'];
        expect(mockWriteFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(mockWriteFile).toHaveBeenCalledWith(
            expect.stringContaining(file),
            expect.stringContaining(newVersion),
          );
        });
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
