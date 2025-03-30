import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';

import * as deno from './deno.js';
import {folder, mockConfigFiles, name, version} from '../vitest/index.js';

describe('detect/deno.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    for (const file of ['deno.jsonc', 'deno.json', 'jsr.json', 'package.json']) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;

        await expect(deno.detectVersion(folder)).resolves.toEqual(version);
      });
    }
    it(`throws error when no config file is found`, async () => {
      fs.existingFile = 'unknown';

      await expect(deno.detectVersion(folder)).rejects.toThrow('Could not detect version in Deno project');
    });
  });

  describe('detectName()', () => {
    for (const file of ['deno.jsonc', 'deno.json', 'jsr.json', 'package.json']) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(deno.detectName(folder)).resolves.toEqual(name);
      });
    }

    it(`returns directory name when config file is missing`, async () => {
      fs.existingFile = 'unknown';

      await expect(deno.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
