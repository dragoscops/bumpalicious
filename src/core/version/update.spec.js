import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import * as update from './update.js';
import * as changelog from '../../utils/changelog.js';
import {warnNoVersionDetected, log} from './update.js';
import {
  mockReadFile,
  mockWriteFile,
  newVersion,
  setupVersionUpdateTest,
  setupVersionUpdateTest2,
  unMockReadFile,
  unMockWriteFile,
  createTempProjectFolder,
  createJsonFile,
  createCustomParserFile,
} from '../../vitest/setup.detect-update.tests.js';
import {mockPino, setupPinoLoggingCallsTest, unMockPino} from '../../vitest/setup.logging.tests.js';

// Generator functions for different test scenarios
const generatePackageJsonCreator = async () => {
  const projectPath = await createTempProjectFolder('update');
  await createJsonFile(`${projectPath}/package.json`);
  return {
    projectPath,
    customParser: update.configUpdater('package.json', {
      parser: JSON.parse,
      serializer: (data) => JSON.stringify(data, null, 2),
      version: ['version'],
    }),
  };
};

const generateGoModCreator = async () => {
  const projectPath = await createTempProjectFolder('update');
  const fs = await import('fs/promises');
  const customContent = `module test-project

go 1.21

// version: 1.0.0
`;
  await fs.writeFile(`${projectPath}/go.mod`, customContent);
  return {
    projectPath,
    customParser: update.configUpdater('go.mod', {
      parser: (data) => data, // pass through
      serializer: (data) => data,
      version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
    }),
  };
};

const generateVersionFileCreator = async () => {
  const projectPath = await createTempProjectFolder('update');
  const fs = await import('fs/promises');
  await fs.writeFile(`${projectPath}/version`, '1.0.0');
  return {
    projectPath,
    customParser: update.configUpdater('version', {
      parser: (data) => data, // pass through
      serializer: (data) => data,
      version: [(data) => newVersion],
    }),
  };
};

describe('update.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPino(log);
  });

  afterEach(() => {
    unMockPino(log);
  });

  describe('configUpdater', () => {
    it('should create an updater function for JSON files', async () => {
      await setupVersionUpdateTest2({
        creator: generatePackageJsonCreator,
        updater: async (projectPath, version) => {
          // Change to the project directory to test relative paths
          const originalCwd = process.cwd();
          try {
            process.chdir(projectPath);
            const updaterFn = update.configUpdater('package.json', {
              parser: JSON.parse,
              serializer: (data) => JSON.stringify(data, null, 2),
              version: ['version'],
            });
            return await updaterFn(version);
          } finally {
            process.chdir(originalCwd);
          }
        },
        expected: `"version": "${newVersion}"`,
      });
    });

    it('should create an updater function for regex-based updates', async () => {
      await setupVersionUpdateTest2({
        creator: generateGoModCreator,
        updater: async (projectPath, version) => {
          const originalCwd = process.cwd();
          try {
            process.chdir(projectPath);
            const updaterFn = update.configUpdater('go.mod', {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
            });
            return await updaterFn(version);
          } finally {
            process.chdir(originalCwd);
          }
        },
        expected: `// version: ${newVersion}`,
      });
    });

    it('should create an updater function', async () => {
      await setupVersionUpdateTest2({
        creator: generateVersionFileCreator,
        updater: async (projectPath, version) => {
          const originalCwd = process.cwd();
          try {
            process.chdir(projectPath);
            const updaterFn = update.configUpdater('version', {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: [(data) => version], // Use the passed version parameter
            });
            return await updaterFn(version);
          } finally {
            process.chdir(originalCwd);
          }
        },
        expected: newVersion,
      });
    });

    it('should handle file read errors gracefully', async () => {
      mockReadFile();

      try {
        const result = await update.configUpdater('missing.json')(newVersion);

        expect(result).toBe(false);
        setupPinoLoggingCallsTest('warn', [{filePath: 'missing.json'}, warnNoVersionDetected], log);
      } finally {
        unMockReadFile();
      }
    });
  });

  describe('updateAll', () => {
    it('should update all files with matching patterns', async () => {
      setupVersionUpdateTest(
        async () =>
          await update.updateAll('/project', 'test', newVersion, [
            update.configUpdater('package.json', {
              parser: JSON.parse,
              serializer: (data) => JSON.stringify(data, null, 2),
              version: ['version'],
            }),
            update.configUpdater('version', {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: (data) => newVersion,
            }),
          ]),
        [`"version": "${newVersion}"`, newVersion],
      );
    });
  });

  describe('updateFirst', () => {
    it('should update only the first file with a matching pattern', async () => {
      mockReadFile();
      mockWriteFile();

      try {
        await update.updateFirst('/project', 'test', newVersion, [
          update.configUpdater('go.mod', {
            parser: (data) => data, // pass through
            serializer: (data) => data,
            version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
          }),
          update.configUpdater('version', {
            parser: (data) => data, // pass through
            serializer: (data) => data,
            version: (data) => newVersion,
          }),
        ]);

        expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
          'go.mod',
          expect.stringContaining(`// version: ${newVersion}`),
        );
        expect(changelog.forMock.writeFile).not.toHaveBeenCalledWith('version', newVersion);
      } finally {
        unMockReadFile();
        unMockWriteFile();
      }
    });

    it('should return null if no files can be updated', async () => {
      mockReadFile();

      try {
        await update.updateFirst('/project', 'test', newVersion, [
          update.configUpdater('nonexistent.json', {}),
          update.configUpdater('nonexistent.json', {}),
        ]);

        setupPinoLoggingCallsTest('warn', [{filePath: 'nonexistent.json'}, warnNoVersionDetected], log);
      } finally {
        unMockReadFile();
      }
    });
  });
});
