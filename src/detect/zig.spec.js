import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';

import * as zig from './zig.js';
import {folder, mockConsole, unMockConsole, mockConfigFiles, mockCargoData, name, version} from '../vitest/index.js';

describe('detect/zig.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConsole(['error']);
    mockConfigFiles();
  });

  afterAll(() => {
    unMockConsole(['error']);
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    it('detects version from build.zig.zon', async () => {
      fs.existingFile = 'build.zig.zon';

      await expect(zig.detectVersion(folder)).resolves.toEqual(version);
    });

    it('detects version from build.zig', async () => {
      fs.existingFile = 'build.zig';

      await expect(zig.detectVersion(folder)).resolves.toEqual(version);
    });

    it('throws error when no config file is found', async () => {
      fs.existingFile = 'unknown';

      await expect(zig.detectVersion(folder)).rejects.toThrow('Could not detect version in Zig project');
    });
  });

  describe('detectName()', () => {
    it('detects name from build.zig.zon', async () => {
      fs.existingFile = 'build.zig.zon';

      await expect(zig.detectName(folder)).resolves.toEqual(name);
    });

    it('detects name from build.zig', async () => {
      fs.existingFile = 'build.zig';

      await expect(zig.detectName(folder)).resolves.toEqual(name);
    });

    it('returns directory name when no config file is found', async () => {
      fs.existingFile = 'unknown';

      await expect(zig.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
