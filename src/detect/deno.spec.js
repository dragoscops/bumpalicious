import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';
import * as deno from './deno.js';
import {
  projectPath,
  mockConfigFiles,
  projectName,
  oldVersion,
  projectName,
} from '../vitest/setup.detect-update.tests.js';
import {DENO_VERSION_FILES} from '../core/constants.js';

describe('detect/deno.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    // Test all file types in our DENO_VERSION_FILES constant
    for (const file of DENO_VERSION_FILES) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;

        await expect(deno.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      });
    }

    it(`throws error when no config file is found`, async () => {
      fs.existingFile = 'unknown';

      await expect(deno.detectVersion(projectPath)).rejects.toThrow('Could not detect version in Deno project');
    });
  });

  describe('detectName()', () => {
    // Test all file types in our DENO_VERSION_FILES constant
    for (const file of DENO_VERSION_FILES) {
      it(`detects name from ${file} file`, async () => {
        fs.existingFile = file;

        await expect(deno.detectName(projectPath)).resolves.toEqual(projectName);
      });
    }

    it(`returns directory name when config file is missing`, async () => {
      fs.existingFile = 'unknown';

      await expect(deno.detectName(projectPath)).resolves.toEqual(projectName);
    });
  });
});
