import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';
import * as node from './node.js';
import {folder, mockConfigFiles, projectName, oldVersion} from '../vitest/setup.detect-update.tests.js';

// Define NODE_VERSION_FILES to match the implementation
const NODE_VERSION_FILES = ['jsr.json', 'package.json'];

describe('detect/node.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    for (const file of NODE_VERSION_FILES) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(node.detectVersion(folder)).resolves.toEqual(oldVersion);
      });
    }

    it(`throws error when no config file is found`, async () => {
      fs.existingFile = 'unknown';
      await expect(node.detectVersion(folder)).rejects.toThrow('Could not detect version in Node.js project');
    });
  });

  describe('detectName()', () => {
    for (const file of NODE_VERSION_FILES) {
      it(`detects project name on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(node.detectName(folder)).resolves.toEqual(projectName);
      });
    }

    it(`returns directory name when config file is missing`, async () => {
      fs.existingFile = 'unknown';
      await expect(node.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
