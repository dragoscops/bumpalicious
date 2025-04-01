import fs from 'fs-extra';
import path from 'path';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as text from './text.js';
import * as logging from '../utils/logging.js';
import {projectPath, newVersion, oldVersion, TEXT_VERSION_FILES} from '../vitest/setup.detect-update.tests.js';

// Mock the dependencies
vi.mock('fs-extra');
vi.mock('path', () => {
  return {
    default: {
      join: vi.fn((dir, file) => `${dir}/${file}`),
      basename: vi.fn((p) => p.split('/').pop()),
      normalize: vi.fn((p) => p),
    },
    join: vi.fn((dir, file) => `${dir}/${file}`),
    basename: vi.fn((p) => p.split('/').pop()),
    normalize: vi.fn((p) => p),
  };
});
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/text.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    it('updates existing version file', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('version'));
      });

      const result = await text.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/version`, newVersion, 'utf8');
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    it('updates VERSION.txt file when found', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(
          !path.endsWith('version') &&
            !path.endsWith('VERSION') &&
            !path.endsWith('version.txt') &&
            path.endsWith('VERSION.txt'),
        );
      });

      const result = await text.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/VERSION.txt`, newVersion, 'utf8');
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    it('creates version file when none exists', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test - no version files exist
      fs.pathExists.mockResolvedValue(false);

      const result = await text.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/version`, newVersion, 'utf8');
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('Created version file'));
    });

    it('handles errors gracefully', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup for this specific test
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('version'));
      });
      fs.writeFile.mockRejectedValue(new Error('Test error'));

      // Should throw an error when writing to an existing version file fails
      await expect(text.updateVersion({projectPath, newVersion})).rejects.toThrow();
      expect(logging.error).toHaveBeenCalled();
    });
  });
});
