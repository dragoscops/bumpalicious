import {beforeEach, describe, it, vi} from 'vitest';
import {detect, update} from './zig.js';
import * as updateModule from '../update.js';
import * as changelog from '../../../utils/changelog.js';
import {
  mockReadFile,
  unMockReadFile,
  newVersion,
  mockWriteFile,
  unMockWriteFile,
  setupVersionDetectTest,
  createZigBuildFile,
  createZigBuildZonFile,
  createTempProjectFolder,
  oldVersion,
  projectNameValue,
  createBrokenFile,
} from '../../../vitest/setup.detect-update.tests.js';
import {mockPino, unMockPino} from '../../../vitest/setup.logging.tests.js';
import path from 'path';

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
    return {projectPath, customParser: undefined};
  };

describe('core/version/workspace/zig.js module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    // Test detection with build.zig
    it('should detect from build.zig', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(),
        parser: detect,
        expected: {name: projectNameValue, version: oldVersion},
      });
    });

    // Test detection with build.zig.zon
    it('should detect from build.zig.zon', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['build.zig.zon'], createZigBuildZonFile),
        parser: detect,
        expected: {name: projectNameValue, version: oldVersion},
      });
    });

    // Test error handling when parsing fails
    it('should handle parsing errors gracefully', async () => {
      await setupVersionDetectTest({
        creator: generateCreator(['build.zig'], createBrokenFile),
        parser: detect,
        expected: {name: null, version: null},
      });
    });
  });

  describe('update()', () => {
    // Test update with build.zig specifically
    it('should update build.zig when only build.zig is present', async () => {
      mockReadFile('build.zig');
      mockWriteFile();

      try {
        await update('/project', newVersion);

        expect(changelog.forMock.writeFile).toHaveBeenCalled();
        expect(
          changelog.forMock.writeFile.mock.calls.some(
            (call) => call[0].includes('build.zig') && call[1].includes('const VERSION = "2.0.0"'),
          ),
        ).toBe(true);
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });

    // Test update with build.zig.zon specifically
    it('should update build.zig.zon when only build.zig.zon is present', async () => {
      mockReadFile('build.zig.zon');
      mockWriteFile();

      try {
        await update('/project', newVersion);

        expect(changelog.forMock.writeFile).toHaveBeenCalled();
        expect(
          changelog.forMock.writeFile.mock.calls.some(
            (call) => call[0].includes('build.zig.zon') && call[1].includes('.version = "2.0.0"'),
          ),
        ).toBe(true);
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });

    // Test error handling when file writing fails
    it('should handle write errors gracefully', async () => {
      mockPino();
      mockReadFile('build.zig');
      mockWriteFile(true); // true = should throw error

      try {
        await update('/project', newVersion);

        // The update should complete without throwing, even when write fails
        // This tests graceful error handling
      } finally {
        unMockWriteFile();
        unMockReadFile();
        unMockPino();
      }
    });

    // Test update with multiple files when both are present
    it('should update both build.zig and build.zig.zon when both are present', async () => {
      // Mock both files being present
      mockReadFile(); // This will return content for any file requested
      mockWriteFile();

      try {
        await update('/project', newVersion);

        // Should write to both files
        expect(changelog.forMock.writeFile.mock.calls.length).toBe(2);
        expect(changelog.forMock.writeFile.mock.calls.some((call) => call[0].includes('build.zig'))).toBe(true);
        expect(changelog.forMock.writeFile.mock.calls.some((call) => call[0].includes('build.zig.zon'))).toBe(true);
      } finally {
        unMockWriteFile();
        unMockReadFile();
      }
    });
  });
});
