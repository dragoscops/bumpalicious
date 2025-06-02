import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './rust.js';
import {log as detectLog} from '../detect.js';
import {forMock as changelogForMock} from '../../../utils/changelog.js';
import {
  mockReadFile,
  unMockReadFile,
  newVersion,
  setupVersionUpdateTest,
  mockWriteFile,
  unMockWriteFile,
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
      await setupVersionUpdateTest(() => update('/project', newVersion), `version = "${newVersion}"`, 'Cargo.toml');
    });

    it('should update all rust config files when multiple exist', async () => {
      // Test that all rust files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['Cargo.toml'];
        expect(changelogForMock.writeFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(changelogForMock.writeFile).toHaveBeenCalledWith(
            expect.stringContaining(file),
            expect.stringContaining(`version = "${newVersion}"`),
          );
        });
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
