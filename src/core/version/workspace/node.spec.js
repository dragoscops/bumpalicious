import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './node.js';
import {log as detectLog} from '../detect.js';
import * as changelog from '../../../utils/changelog.js';
import {
  mockReadFile,
  unMockReadFile,
  newVersion,
  setupVersionUpdateTest,
  mockWriteFile,
  unMockWriteFile,
  createJsonFile,
  setupVersionDetectTest,
  oldVersion,
  createTempProjectFolder,
  projectNameValue,
  createBrokenFile,
} from '../../../vitest/setup.detect-update.tests.js';
import path from 'path';

const generateCreator =
  (files = ['jsr.json'], createFile = createJsonFile) =>
  async () => {
    const projectPath = await createTempProjectFolder('node');
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

describe('core/version/workspace/node.js module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with jsr.json
    it('should detect from jsr.json', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: {name: projectNameValue, version: oldVersion},
      });
    });

    // Test detection with package.json
    it('should detect from package.json', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['package.json']),
        parser: detect,
        expected: {name: projectNameValue, version: oldVersion},
      });
    });

    // Test detection with jsr.json, package.json
    it('should detect from jsr.json, package.json', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['jsr.json', 'package.json']),
        parser: detect,
        expected: {
          name: projectNameValue,
          version: oldVersion,
        },
      });
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['package.json'], createBrokenFile),
        parser: detect,
        expectedLogError: {
          method: 'warn',
          expected: [
            expect.objectContaining({filePath: expect.stringContaining('package.json'), error: expect.any(Error)}),
            'Failed to parse version file',
          ],
        },
        options: {logger: detectLog},
      });
    });
  });

  describe('update()', () => {
    it('should update version in jsr.json when only jsr.json exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `"version": "${newVersion}"`, 'jsr.json');
    });

    it('should update version in package.json when only package.json exists', async () => {
      await setupVersionUpdateTest(() => update('/project', newVersion), `"version": "${newVersion}"`, 'package.json');
    });

    it('should update all node config files when multiple exist', async () => {
      // Test that all node files are updated when they exist
      mockReadFile(); // This will make all config files available
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Verify all files were written to with the new version
        const expectedFiles = ['jsr.json', 'package.json'];
        expect(changelog.forMock.writeFile).toHaveBeenCalledTimes(expectedFiles.length);

        expectedFiles.forEach((file) => {
          expect(changelog.forMock.writeFile).toHaveBeenCalledWith(
            expect.stringContaining(file),
            expect.stringContaining(`"version": "${newVersion}"`),
          );
        });
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
