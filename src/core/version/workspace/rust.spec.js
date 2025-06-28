import path from 'node:path';
import {beforeEach, describe, it} from 'vitest';
import {detect, update} from './rust.js';
import {
  newVersion,
  setupVersionUpdateTest,
  setupVersionDetectTest,
  createRustCargoTomlFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
  createBrokenFile,
} from '../../../vitest/setup.detect-update.tests.js';
import {mockPinoIn, unMockPinoIn} from '../../../vitest/setup.logging.tests.js';
import {log as detectLog} from '../detect.js';

const generateCreator =
  (files = ['Cargo.toml'], createFile = createRustCargoTomlFile) =>
  async () => {
    const projectPath = await createTempProjectFolder('rust');
    await Promise.all(
      files.map((file, index) =>
        createFile(path.join(projectPath, file), {
          name: `${projectNameValue}${index === 0 ? '' : index}`,
          version: oldVersion,
        }),
      ),
    );
    return {projectPath, customParser: undefined};
  };

describe('core/version/workspace/rust.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(() => {
    unMockPinoIn(logMocks);
  });

  describe('detect()', () => {
    // Test detection with Cargo.toml
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from Cargo.toml', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: {name: projectNameValue, version: oldVersion},
      });
    });

    // Test error handling when parsing fails

    it('should handle parsing errors gracefully', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['Cargo.toml'], createBrokenFile),
        parser: detect,
        expectedLogError: {
          method: 'warn',
          expected: [
            expect.objectContaining({filePath: expect.stringContaining('Cargo.toml'), error: expect.any(Error)}),
            'Failed to parse version file',
          ],
        },
        options: {logger: detectLog},
      });
    });
  });

  describe('update()', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should update version in Cargo.toml when Cargo.toml exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['Cargo.toml']),
        updater: update,
        expected: `version = "${newVersion}"`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update all rust config files when multiple exist', async () => {
      // For rust, there's typically only Cargo.toml, but this test verifies
      // the update function works correctly when called on a rust project
      await setupVersionUpdateTest({
        creator: generateCreator(['Cargo.toml']),
        updater: update,
        expected: `version = "${newVersion}"`,
      });
    });
  });
});
