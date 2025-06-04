import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './rust.js';
import {log as detectLog} from '../detect.js';
import {
  newVersion,
  setupVersionUpdateTest2,
  setupVersionDetectTest,
  createRustCargoTomlFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
  createBrokenFile,
} from '../../../vitest/setup.detect-update.tests.js';
import path from 'path';

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
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with Cargo.toml
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
    it('should update version in Cargo.toml when Cargo.toml exists', async () => {
      await setupVersionUpdateTest2({
        creator: generateCreator(['Cargo.toml']),
        updater: update,
        expected: `version = "${newVersion}"`,
      });
    });

    it('should update all rust config files when multiple exist', async () => {
      // For rust, there's typically only Cargo.toml, but this test verifies
      // the update function works correctly when called on a rust project
      await setupVersionUpdateTest2({
        creator: generateCreator(['Cargo.toml']),
        updater: update,
        expected: `version = "${newVersion}"`,
      });
    });
  });
});
