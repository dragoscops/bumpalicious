import path from 'node:path';
import { beforeEach, describe, it } from 'vitest';
import { detect, update } from './deno.js';
import {
  newVersion,
  setupVersionUpdateTest,
  createJsonFile,
  setupVersionDetectTest,
  oldVersion,
  createTempProjectFolder,
  projectNameValue,
  createBrokenFile,
} from '../../../vitest/setup.detect-update.tests.js';
import { mockPinoIn, unMockPinoIn } from '../../../vitest/setup.logging.tests.js';
import { log as detectLog } from '../detect.js';

const generateCreator =
  (files = ['deno.jsonc'], createFile = createJsonFile) =>
  async () => {
    const projectPath = await createTempProjectFolder('deno');
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

describe('core/version/workspace/deno.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(() => {
    unMockPinoIn(logMocks);
  });

  describe('detect()', () => {
    // Test detection with deno.jsonc
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from deno.jsonc', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // Test detection with deno.json
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from deno.json', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['deno.json']),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // Test detection with jsr.json
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from jsr.json', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['jsr.json']),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // Test detection with package.json
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from package.json', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['package.json']),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // Test error handling when parsing fails

    it('should handle parsing errors gracefully', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['deno.json'], createBrokenFile),
        parser: detect,
        expectedLogError: {
          method: 'warn',
          expected: [
            expect.objectContaining({ filePath: expect.stringContaining('deno.json'), error: expect.any(Error) }),
            'Failed to parse version file',
          ],
        },
        options: { logger: detectLog },
      });
    });
  });

  describe('update()', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should update version in deno.jsonc when only deno.jsonc exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['deno.jsonc']),
        updater: update,
        expected: `"version": "${newVersion}"`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update version in deno.json when only deno.json exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['deno.json']),
        updater: update,
        expected: `"version": "${newVersion}"`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update version in jsr.json when only jsr.json exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['jsr.json']),
        updater: update,
        expected: `"version": "${newVersion}"`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update version in package.json when only package.json exists', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['package.json']),
        updater: update,
        expected: `"version": "${newVersion}"`,
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update all deno config files when multiple exist', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['deno.jsonc', 'deno.json', 'jsr.json', 'package.json']),
        updater: update,
        expected: [
          `"version": "${newVersion}"`,
          `"version": "${newVersion}"`,
          `"version": "${newVersion}"`,
          `"version": "${newVersion}"`,
        ],
      });
    });
  });
});
