import fs from 'fs-extra';
import path from 'path';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as text from './text.js';
import {projectPath, oldVersion, projectName, TEXT_VERSION_FILES} from '../vitest/setup.detect-update.tests.js';

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

describe('detect/text.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    it('detects version from version file', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('version'));
      });
      fs.readFile.mockResolvedValue(oldVersion);

      await expect(text.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/version`, 'utf8');
    });

    it('detects version from VERSION file', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('version') && path.endsWith('VERSION'));
      });
      fs.readFile.mockResolvedValue(oldVersion);

      await expect(text.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/VERSION`, 'utf8');
    });

    it('throws error when no version could be found', async () => {
      fs.pathExists.mockResolvedValue(false);

      await expect(text.detectVersion(projectPath)).rejects.toThrow('Could not detect version in text project');
    });
  });

  describe('detectName()', () => {
    it('returns directory name as project name', async () => {
      // The detectName function simply returns the directory name
      await expect(text.detectName(projectPath)).resolves.toEqual(projectPath.split('/').pop());
    });
  });
});
