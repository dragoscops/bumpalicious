import {beforeEach, describe, it, vi} from 'vitest';
import toml from '@iarna/toml';
import {detect, update} from './python.js';
import {log as detectLog} from '../detect.js';
import * as changelog from '../../../utils/changelog.js';
import {
  setupVersionDetectTest,
  createPythonPyProjectTomlFile,
  createPythonPoetryTomlFile,
  createPythonSetupPyFile,
  createPythonSetupCfgFile,
  createPythonInitPyFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
  newVersion,
  setupVersionUpdateTest,
  mockWriteFile,
  unMockWriteFile,
  mockReadFile,
  unMockReadFile,
} from '../../../vitest/setup.detect-update.tests.js';
import {mockPino, setupPinoLoggingCallsTest, unMockPino} from '../../../vitest/setup.logging.tests.js';

describe('core/version/workspace/python.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with pyproject.toml
    it('should detect from pyproject.toml', async () => {
      await setupVersionDetectTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('python');
          await createPythonPyProjectTomlFile(`${projectPath}/pyproject.toml`);
          return projectPath;
        },
        parser: detect,
        expected: {
          name: projectNameValue,
        },
      });
    });

    // Test detection with poetry.toml
    it('should detect from poetry.toml', async () => {
      await setupVersionDetectTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('python');
          await createPythonPoetryTomlFile(`${projectPath}/poetry.toml`);
          return projectPath;
        },
        parser: detect,
        expected: {
          name: projectNameValue,
        },
      });
    });

    // Test detection with setup.py
    it('should detect from setup.py', async () => {
      await setupVersionDetectTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('python');
          await createPythonSetupPyFile(`${projectPath}/setup.py`);
          return projectPath;
        },
        parser: detect,
        expected: {
          name: projectNameValue,
        },
      });
    });

    // Test detection with setup.cfg
    it('should detect from setup.cfg', async () => {
      await setupVersionDetectTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('python');
          await createPythonSetupCfgFile(`${projectPath}/setup.cfg`);
          return projectPath;
        },
        parser: detect,
        expected: {
          name: projectNameValue,
        },
      });
    });

    // Test detection with __init__.py
    it('should detect from __init__.py', async () => {
      await setupVersionDetectTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('python');
          await createPythonInitPyFile(`${projectPath}/__init__.py`);
          return projectPath;
        },
        parser: detect,
        expected: {
          name: projectNameValue,
        },
      });
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      mockPino(detectLog);
      mockReadFile('pyproject.toml');
      const parseSpy = vi.spyOn(toml, 'parse').mockImplementation(() => {
        throw new Error('Parsing error');
      });

      try {
        await detect('/project');

        setupPinoLoggingCallsTest(
          'warn',
          [
            expect.objectContaining({filePath: expect.stringContaining('pyproject.toml'), error: expect.any(Error)}),
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

    it('should update all python config files when multiple exist', async () => {
      // Test that all python files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['pyproject.toml', 'poetry.toml', 'setup.py', 'setup.cfg', '__init__.py'];
        expect(changelog.forMock.writeFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
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
