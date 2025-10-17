import path from 'node:path';
import {beforeEach, describe, it} from 'vitest';
import {detect, update} from './go.js';
import {
  setupVersionDetectTest,
  setupVersionUpdateTest,
  createGoModFile,
  createGoVersionFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
} from '../../../vitest/setup.detect-update.tests.js';
import {mockPinoIn, unMockPinoIn} from '../../../vitest/setup.logging.tests.js';

const generateCreator =
  (files = ['go.mod']) =>
  async () => {
    const projectPath = await createTempProjectFolder('go');

    for (const file of files) {
      if (file.endsWith('.mod')) {
        await createGoModFile(path.join(projectPath, file), {
          name: projectNameValue,
          version: oldVersion,
        });
      } else {
        await createGoVersionFile(path.join(projectPath, file), {
          name: 'version',
          version: oldVersion,
        });
      }
    }

    return {projectPath, customParser: undefined};
  };

describe('core/version/workspace/go.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(() => {
    unMockPinoIn(logMocks);
  });

  describe('detect()', () => {
    // Test detection with go.mod
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from go.mod', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: {name: `github.com/${projectNameValue}`, version: oldVersion},
      });
    });

    // Test detection with version.go
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from version.go', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['version.go']),
        parser: detect,
        expected: {name: 'version', version: oldVersion},
      });
    });

    // Test error handling when parsing fails
    // eslint-disable-next-line vitest/expect-expect
    it('should handle parsing errors gracefully', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['go.mod']),
        parser: detect,
        expected: {name: `github.com/${projectNameValue}`, version: oldVersion},
      });
    });
  });

  describe('update()', () => {
    // Test updating go.mod
    // eslint-disable-next-line vitest/expect-expect
    it('should update version in go.mod', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['go.mod']),
        updater: update,
        expected: '// version: 2.0.0',
      });
    });

    // Test updating version.go
    // eslint-disable-next-line vitest/expect-expect
    it('should update version in version.go', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version.go']),
        updater: update,
        expected: 'const Version = "2.0.0"',
      });
    });
  });
});
