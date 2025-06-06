import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './text.js';
import {
  setupVersionUpdateTest,
  setupVersionDetectTest,
  createTextVersionFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
} from '../../../vitest/setup.detect-update.tests.js';
import path from 'path';

const generateCreator =
  (files = ['version'], createFile = createTextVersionFile) =>
  async () => {
    const projectPath = await createTempProjectFolder('text');
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

describe('core/version/workspace/text.js module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with version
    it('should detect from version', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['version']),
        parser: detect,
        expected: {name: expect.stringContaining('text-'), version: oldVersion},
      });
    });

    // Test detection with version.txt
    it('should detect from version.txt', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['version.txt']),
        parser: detect,
        expected: {name: expect.stringContaining('text-'), version: oldVersion},
      });
    });

    // Test detection with VERSION
    it('should detect from VERSION', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['VERSION']),
        parser: detect,
        expected: {name: expect.stringContaining('text-'), version: oldVersion},
      });
    });

    // Test detection with VERSION.txt
    it('should detect from VERSION.txt', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['VERSION.txt']),
        parser: detect,
        expected: {name: expect.stringContaining('text-'), version: oldVersion},
      });
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      const projectPath = await createTempProjectFolder('text');

      try {
        const result = await detect(projectPath);

        // Should return null when no files are found
        expect(result).toEqual({version: null, name: null});
      } finally {
        // Cleanup is handled by the test framework
      }
    });
  });

  describe('update()', () => {
    it('should update version in version when only version exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version']),
        updater: update,
        expected: '2.0.0',
      });
    });

    it('should update version in version.txt when only version.txt exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version.txt']),
        updater: update,
        expected: '2.0.0',
      });
    });

    it('should update version in VERSION when only VERSION exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['VERSION']),
        updater: update,
        expected: '2.0.0',
      });
    });

    it('should update version in VERSION.txt when only VERSION.txt exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['VERSION.txt']),
        updater: update,
        expected: '2.0.0',
      });
    });

    it('should update all text config files when multiple exist', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version', 'version.txt', 'VERSION', 'VERSION.txt']),
        updater: update,
        expected: ['2.0.0'], // Should appear in all files
      });
    });
  });
});
