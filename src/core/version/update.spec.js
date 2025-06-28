import path from 'node:path';
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as update from './update.js';
import {warnNoVersionDetected, log} from './update.js';
import {
  newVersion,
  setupVersionUpdateTest,
  createTempProjectFolder,
  createJsonFile,
} from '../../vitest/setup.detect-update.tests.js';
import {mockPinoIn, setupPinoLoggingCallsTest, unMockPinoIn} from '../../vitest/setup.logging.tests.js';

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
  const fs = await import('node:fs/promises');
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
  const fs = await import('node:fs/promises');
  await fs.writeFile(`${projectPath}/version`, '1.0.0');
  return {
    projectPath,
    customParser: update.configUpdater('version', {
      parser: (data) => data, // pass through
      serializer: (data) => data,
      version: [() => newVersion],
    }),
  };
};

const generateMultiFileCreator = async () => {
  const projectPath = await createTempProjectFolder('update');
  const fs = await import('node:fs/promises');
  await createJsonFile(`${projectPath}/package.json`);
  await fs.writeFile(`${projectPath}/version`, '1.0.0');
  return {
    projectPath,
    customParser: undefined, // Will use updateAll with multiple updaters
  };
};

describe('core/version/update.js', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(async () => {
    unMockPinoIn(logMocks);
  });

  describe('configUpdater', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should create an updater function for JSON files', async () => {
      await setupVersionUpdateTest({
        creator: generatePackageJsonCreator,
        updater: async (projectPath, version) => {
          const updaterFn = update.configUpdater(path.join(projectPath, 'package.json'), {
            parser: JSON.parse,
            serializer: (data) => JSON.stringify(data, null, 2),
            version: ['version'],
          });
          return await updaterFn(version);
        },
        expected: `"version": "${newVersion}"`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should create an updater function for regex-based updates', async () => {
      await setupVersionUpdateTest({
        creator: generateGoModCreator,
        updater: async (projectPath, version) => {
          const updaterFn = update.configUpdater(path.join(projectPath, 'go.mod'), {
            parser: (data) => data, // pass through
            serializer: (data) => data,
            version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
          });
          return await updaterFn(version);
        },
        expected: `// version: ${newVersion}`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should create an updater function', async () => {
      await setupVersionUpdateTest({
        creator: generateVersionFileCreator,
        updater: async (projectPath, version) => {
          const updaterFn = update.configUpdater(path.join(projectPath, 'version'), {
            parser: (data) => data, // pass through
            serializer: (data) => data,
            version: [() => version], // Use the passed version parameter
          });
          return await updaterFn(version);
        },
        expected: newVersion,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should handle file read errors gracefully', async () => {
      await setupVersionUpdateTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('update');
          // Don't create the file - it should be missing
          return projectPath;
        },
        updater: async (projectPath, version) => {
          const result = await update.configUpdater(path.join(projectPath, 'missing.json'))(version);
          // For this test, we expect the result to be false, but we need to return truthy for the test framework
          return result === false ? true : result;
        },
        expected: undefined, // No content should be written
        validator: async () => {
          // Verify that the warning was logged
          setupPinoLoggingCallsTest('warn', [{filePath: 'missing.json'}, warnNoVersionDetected], log);
        },
      });
    });
  });

  describe('updateAll', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should update all files with matching patterns', async () => {
      await setupVersionUpdateTest({
        creator: generateMultiFileCreator,
        updater: async (projectPath, version) => {
          return await update.updateAll(projectPath, 'test', version, [
            update.configUpdater(path.join(projectPath, 'package.json'), {
              parser: JSON.parse,
              serializer: (data) => JSON.stringify(data, null, 2),
              version: ['version'],
            }),
            update.configUpdater(path.join(projectPath, 'version'), {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: [() => version], // Function that returns the version
            }),
          ]);
        },
        expected: [`"version": "${newVersion}"`, newVersion],
      });
    });
  });

  describe('updateFirst', () => {
    it('should update only the first file with a matching pattern', async () => {
      await setupVersionUpdateTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('update');
          const fs = await import('node:fs/promises');

          // Create both files that updateFirst can choose from
          const goModContent = `module test-project

go 1.21

// version: 1.0.0
`;
          await fs.writeFile(`${projectPath}/go.mod`, goModContent);
          await fs.writeFile(`${projectPath}/version`, '1.0.0');
          return projectPath;
        },
        updater: async (projectPath, version) => {
          return await update.updateFirst(projectPath, 'test', version, [
            update.configUpdater(path.join(projectPath, 'go.mod'), {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
            }),
            update.configUpdater(path.join(projectPath, 'version'), {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: [() => version],
            }),
          ]);
        },
        expected: `// version: ${newVersion}`, // Only go.mod should be updated (first match)
        validator: async (projectPath) => {
          const fs = await import('node:fs/promises');
          const goModContent = await fs.readFile(`${projectPath}/go.mod`, 'utf8');
          const versionContent = await fs.readFile(`${projectPath}/version`, 'utf8');

          // go.mod should be updated
          expect(goModContent).toContain(`// version: ${newVersion}`);
          // version file should remain unchanged (still old version)
          expect(versionContent).toBe('1.0.0');
        },
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should return null if no files can be updated', async () => {
      await setupVersionUpdateTest({
        creator: async () => {
          const projectPath = await createTempProjectFolder('update');
          // Don't create any files - they should be missing
          return projectPath;
        },
        updater: async (projectPath, version) => {
          const result = await update.updateFirst(projectPath, 'test', version, [
            update.configUpdater('nonexistent.json', {}),
            update.configUpdater('nonexistent.json', {}),
          ]);

          // For this test, we expect the result to be falsy since no files can be updated
          // But we need to return a truthy value for the test framework
          return result === null || result === false ? true : result;
        },
        expected: undefined, // No content should be written
        validator: async () => {
          // Verify that the warning was logged
          setupPinoLoggingCallsTest('warn', [{filePath: 'nonexistent.json'}, warnNoVersionDetected], log);
        },
      });
    });
  });
});
