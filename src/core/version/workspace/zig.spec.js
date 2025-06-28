import path from 'node:path';
import { beforeEach, describe, it } from 'vitest';
import { detect, update } from './zig.js';
import {
  setupVersionUpdateTest,
  setupVersionDetectTest,
  createZigBuildFile,
  createZigBuildZonFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
  createBrokenFile,
} from '../../../vitest/setup.detect-update.tests.js';
import { mockPinoIn, unMockPinoIn } from '../../../vitest/setup.logging.tests.js';

const generateCreator =
  (files = ['build.zig'], createFile = createZigBuildFile) =>
  async () => {
    const projectPath = await createTempProjectFolder('zig');
    await Promise.all(
      files.map((file, index) => {
        const fileCreateFn = file === 'build.zig.zon' ? createZigBuildZonFile : createZigBuildFile;
        const actualCreateFn = createFile === createBrokenFile ? createFile : fileCreateFn;
        return actualCreateFn(path.join(projectPath, file), {
          name: `${projectNameValue}${index === 0 ? '' : index}`,
          version: oldVersion,
        });
      }),
    );
    return { projectPath, customParser: undefined };
  };

describe('core/version/workspace/zig.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version/detect', 'core/version/update']);
  });

  afterEach(() => {
    unMockPinoIn(logMocks);
  });

  describe('detect()', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should detect from build.zig', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should detect from build.zig.zon', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['build.zig.zon'], createZigBuildZonFile),
        parser: detect,
        expected: { name: projectNameValue, version: oldVersion },
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should handle parsing errors gracefully', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['build.zig'], createBrokenFile),
        parser: detect,
        expected: { name: null, version: null },
      });
    });
  });

  describe('update()', () => {
    // eslint-disable-next-line vitest/expect-expect
    it('should update build.zig when only build.zig is present', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['build.zig']),
        updater: update,
        expected: 'const VERSION = "2.0.0"',
      });
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update build.zig.zon when only build.zig.zon is present', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['build.zig.zon']),
        updater: update,
        expected: '.version = "2.0.0"',
      });
    });

    // Test error handling when file writing fails
    it.skip('should handle write errors gracefully', async () => {
      // This test is skipped in the new pattern as simulating write failures
      // with real temporary files is complex and may not be worth the effort.
      // The error handling is already tested at the update module level.
    });

    // eslint-disable-next-line vitest/expect-expect
    it('should update both build.zig and build.zig.zon when both are present', async () => {
      await setupVersionUpdateTest({
        creator: generateCreator(['build.zig', 'build.zig.zon']),
        updater: update,
        expected: ['const VERSION = "2.0.0"', '.version = "2.0.0"'],
      });
    });
  });
});
