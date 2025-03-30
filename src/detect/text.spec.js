import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';
import * as text from './text.js';

import {folder, mockConsole, unMockConsole, mockConfigFiles, version} from '../vitest/index.js';

describe('detect/text.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConsole(['error']);
    mockConfigFiles();
  });

  afterAll(() => {
    unMockConsole(['error']);
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fs.existingFile = 'version';
  });

  describe('detectVersion()', () => {
    it('detects version from version file', async () => {
      await expect(text.detectVersion(folder)).resolves.toEqual(version);
    });

    it('throws error when no version file is found', async () => {
      fs.existingFile = 'unknown';

      await expect(text.detectVersion(folder)).rejects.toThrow('Could not detect version in text project');
    });
  });

  describe('detectName()', () => {
    it('returns directory name as project name', async () => {
      await expect(text.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
