import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';

import * as node from './node.js';
import {folder, mockConfigFiles, name, version} from '../vitest/index.js';

describe('detect/node.js module', () => {
  it('true', () => {
    expect(true).toBe(true);
  });
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    for (const file of ['jsr.json', 'package.json']) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;

        await expect(node.detectVersion(folder)).resolves.toEqual(version);
      });
    }

    it(`throws error when no config file is found`, async () => {
      fs.existingFile = 'unknown';

      await expect(node.detectVersion(folder)).rejects.toThrow('Could not detect version in Node.js project');
    });
  });

  describe('detectName()', () => {
    for (const file of ['jsr.json', 'package.json']) {
      it(`detects project name on a ${file} file`, async () => {
        fs.existingFile = file;

        await expect(node.detectName(folder)).resolves.toEqual(name);
      });
    }

    it(`returns directory name when config file is missing`, async () => {
      fs.existingFile = 'unknown';

      await expect(node.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
