import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, beforeEach} from 'vitest';
import * as go from './go.js';
import {folder, mockConfigFiles, name, version} from '../vitest/index.js';

describe('detect/go.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fs.existingFile = 'go.mod';
  });

  describe('detectVersion()', () => {
    it('extracts version from go.mod', async () => {
      await expect(go.detectVersion(folder)).resolves.toEqual(version);
    });

    it('throws error when go.mod is missing', async () => {
      fs.existingFile = 'unkown';

      await expect(go.detectVersion(folder)).rejects.toThrow('Could not detect version in Go project');
    });
  });

  describe('detectName()', () => {
    it('detects name from go.mod', async () => {
      await expect(go.detectName(folder)).resolves.toEqual(name);
    });

    it('returns directory name when config file is missing', async () => {
      fs.existingFile = 'unknown';

      await expect(go.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
