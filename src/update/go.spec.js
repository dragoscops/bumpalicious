import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';
import * as go from './go.js';
import * as logging from '../utils/logging.js';
import {projectPath, newVersion, oldVersion, mockConfigFiles} from '../vitest/setup.detect-update.tests.js';
import {GO_VERSION_FILES} from '../core/constants.js';

describe('update/go.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    it('updates version in go.mod', async () => {
      const result = await go.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/go.mod`, 'utf8');
      expect(fs.writeFile).toHaveBeenCalledWith(
        `${projectPath}/go.mod`,
        expect.stringContaining(`version = "${newVersion}"`),
        'utf8',
      );
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    // // Test updating version in different Go source files
    // for (const file of GO_VERSION_FILES.slice(1, -1)) {
    //   // Skip go.mod and plain version file
    //   it(`updates version in ${file}`, async () => {
    //     const result = await go.updateVersion({projectPath, newVersion});

    //     expect(result).toBe(true);
    //     expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/${file}`, 'utf8');
    //     expect(fs.writeFile).toHaveBeenCalledWith(
    //       `${projectPath}/${file}`,
    //       expect.stringContaining(`const Version = "${newVersion}"`),
    //       'utf8',
    //     );
    //     expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    //   });
    // }

    // it('creates version file when no version files exist', async () => {
    //   fs.existingFile = 'version';

    //   const result = await go.updateVersion({projectPath, newVersion});

    //   expect(result).toBe(true);
    //   expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/version`, newVersion, 'utf8');
    //   expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('Created version file'));
    // });

    // it('handles errors gracefully', async () => {
    //   fs.readFile.mockRejectedValue(new Error('Test error'));

    //   await expect(go.updateVersion({projectPath, newVersion})).resolves.toBe(true); // Should create version file as fallback

    //   expect(logging.error).toHaveBeenCalled();
    // });

    // it('updates version with func Version() pattern', async () => {
    //   const result = await go.updateVersion({projectPath, newVersion});

    //   expect(result).toBe(true);
    //   expect(fs.writeFile).toHaveBeenCalledWith(
    //     `${projectPath}/version.go`,
    //     expect.stringContaining(`func Version() string { return "${newVersion}" }`),
    //     'utf8',
    //   );
    //   expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    // });
  });
});
