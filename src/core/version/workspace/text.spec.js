import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { detect, update } from './text.js';
import {
  setupVersionUpdateTest,
  setupVersionDetectTest,
  createTextVersionFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
} from '../../../vitest/setup.detect-update.tests.js';
import { mockPinoIn, unMockPinoIn } from '../../../vitest/setup.logging.tests.js';

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
    return { projectPath, customParser: undefined };
  };

describe('core/version/workspace/text.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(() => {
    unMockPinoIn(logMocks);
  });

  describe('detect()', () => {
    it('should detect from version', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['version']),
        parser: detect,
        expected: { name: expect.stringContaining('text-'), version: oldVersion },
      });
    });

    it('should detect from version.txt', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['version.txt']),
        parser: detect,
        expected: { name: expect.stringContaining('text-'), version: oldVersion },
      });
    });

    it('should detect from VERSION', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['VERSION']),
        parser: detect,
        expected: { name: expect.stringContaining('text-'), version: oldVersion },
      });
    });

    it('should detect from VERSION.txt', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['VERSION.txt']),
        parser: detect,
        expected: { name: expect.stringContaining('text-'), version: oldVersion },
      });
    });

    it('should handle parsing errors gracefully', async () => {
      const projectPath = await createTempProjectFolder('text');

      try {
        const result = await detect(projectPath);

        // Should return null when no files are found
        expect(result).toEqual({ version: null, name: null });
      } finally {
        // Cleanup is handled by the test framework
      }
    });
  });

  describe('update()', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should update version in version when only version exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version']),
        updater: update,
        expected: '2.0.0',
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update version in version.txt when only version.txt exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version.txt']),
        updater: update,
        expected: '2.0.0',
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update version in VERSION when only VERSION exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['VERSION']),
        updater: update,
        expected: '2.0.0',
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update version in VERSION.txt when only VERSION.txt exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['VERSION.txt']),
        updater: update,
        expected: '2.0.0',
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update all text config files when multiple exist', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['version', 'version.txt', 'VERSION', 'VERSION.txt']),
        updater: update,
        expected: ['2.0.0'], // Should appear in all files
      });
    });
  });
});
