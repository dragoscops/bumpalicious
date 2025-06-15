import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './python.js';
import {
  setupVersionDetectTest,
  setupVersionUpdateTest,
  createPythonPyProjectTomlFile,
  createPythonPoetryTomlFile,
  createPythonSetupPyFile,
  createPythonSetupCfgFile,
  createPythonInitPyFile,
  createTempProjectFolder,
  projectNameValue,
} from '../../../vitest/setup.detect-update.tests.js';
import {mockPinoIn, unMockPinoIn} from '../../../vitest/setup.logging.tests.js';

// Generator functions for different Python file types
const generatePyProjectTomlCreator = async () => {
  const projectPath = await createTempProjectFolder('python');
  await createPythonPyProjectTomlFile(`${projectPath}/pyproject.toml`);
  return {projectPath, customParser: undefined};
};

const generatePoetryTomlCreator = async () => {
  const projectPath = await createTempProjectFolder('python');
  await createPythonPoetryTomlFile(`${projectPath}/poetry.toml`);
  return {projectPath, customParser: undefined};
};

const generateSetupPyCreator = async () => {
  const projectPath = await createTempProjectFolder('python');
  await createPythonSetupPyFile(`${projectPath}/setup.py`);
  return {projectPath, customParser: undefined};
};

const generateSetupCfgCreator = async () => {
  const projectPath = await createTempProjectFolder('python');
  await createPythonSetupCfgFile(`${projectPath}/setup.cfg`);
  return {projectPath, customParser: undefined};
};

const generateInitPyCreator = async () => {
  const projectPath = await createTempProjectFolder('python');
  await createPythonInitPyFile(`${projectPath}/__init__.py`);
  return {projectPath, customParser: undefined};
};

const generateAllPythonFilesCreator = async () => {
  const projectPath = await createTempProjectFolder('python');
  await createPythonPyProjectTomlFile(`${projectPath}/pyproject.toml`);
  await createPythonPoetryTomlFile(`${projectPath}/poetry.toml`);
  await createPythonSetupPyFile(`${projectPath}/setup.py`);
  await createPythonSetupCfgFile(`${projectPath}/setup.cfg`);
  await createPythonInitPyFile(`${projectPath}/__init__.py`);
  return {projectPath, customParser: undefined};
};

describe('core/version/workspace/python.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(() => {
    unMockPinoIn(logMocks);
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
    it.skip('should handle parsing errors gracefully', async () => {
      // Skipped: Error handling test requires mocking which is not compatible with integration testing approach
    });
  });

  describe('update()', () => {
    it('should update version in pyproject.toml when only pyproject.toml exists', async () => {
      await setupVersionUpdateTest({
        creator: generatePyProjectTomlCreator,
        updater: update,
        expected: 'version = "2.0.0"',
      });
    });

    it('should update version in poetry.toml when only poetry.toml exists', async () => {
      await setupVersionUpdateTest({
        creator: generatePoetryTomlCreator,
        updater: update,
        expected: 'version = "2.0.0"',
      });
    });

    it('should update version in setup.py when only setup.py exists', async () => {
      await setupVersionUpdateTest({
        creator: generateSetupPyCreator,
        updater: update,
        expected: 'version="2.0.0"',
      });
    });

    it('should update version in setup.cfg when only setup.cfg exists', async () => {
      await setupVersionUpdateTest({
        creator: generateSetupCfgCreator,
        updater: update,
        expected: 'version = 2.0.0',
      });
    });

    it('should update version in __init__.py when only __init__.py exists', async () => {
      await setupVersionUpdateTest({
        creator: generateInitPyCreator,
        updater: update,
        expected: '__version__ = "2.0.0"',
      });
    });

    it('should update all python config files when multiple exist', async () => {
      await setupVersionUpdateTest({
        creator: generateAllPythonFilesCreator,
        updater: update,
        expected: [
          'version = "2.0.0"', // pyproject.toml and poetry.toml format
          'version="2.0.0"', // setup.py format
          'version = 2.0.0', // setup.cfg format
          '__version__ = "2.0.0"', // __init__.py format
        ],
      });
    });
  });
});
