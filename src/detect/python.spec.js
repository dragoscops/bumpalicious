import fs from 'fs-extra';
import toml from '@iarna/toml';
import {execa} from 'execa';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as python from './python.js';
import {
  projectPath,
  mockConfigFiles,
  projectName,
  oldVersion,
  mockPyprojectData,
  mockPyprojectPoetryData,
  pyprojectContent,
  pyprojectPoetryContent,
  PYTHON_VERSION_FILES,
} from '../vitest/setup.detect-update.tests.js';

// Mock the dependencies
vi.mock('fs-extra');
vi.mock('@iarna/toml');
vi.mock('execa');

describe('detect/python.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();

    // Mock execa for Python importlib.metadata detection
    execa.mockResolvedValue({stdout: oldVersion});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    it('detects version from pyproject.toml with project section', async () => {
      fs.pathExists.mockResolvedValue(true);
      toml.parse.mockReturnValue(mockPyprojectData);

      await expect(python.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();
    });

    it('detects version from pyproject.toml with poetry section', async () => {
      fs.pathExists.mockResolvedValue(true);
      toml.parse.mockReturnValue(mockPyprojectPoetryData);

      await expect(python.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();
    });

    it('detects version from setup.py', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('pyproject.toml') && path.endsWith('setup.py'));
      });
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parse error');
      });

      await expect(python.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.py`, 'utf8');
    });

    it('detects version from setup.cfg', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(
          !path.endsWith('pyproject.toml') && !path.endsWith('setup.py') && path.endsWith('setup.cfg'),
        );
      });

      await expect(python.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.cfg`, 'utf8');
    });

    it('detects version using importlib.metadata', async () => {
      fs.pathExists.mockResolvedValue(false);

      await expect(python.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(execa).toHaveBeenCalledWith(
        'python',
        ['-c', "import importlib.metadata; print(importlib.metadata.version('.'))"],
        {cwd: projectPath},
      );
    });

    it('throws error when no version could be found', async () => {
      fs.pathExists.mockResolvedValue(false);
      execa.mockRejectedValue(new Error('Python error'));

      await expect(python.detectVersion(projectPath)).rejects.toThrow('Could not detect version in Python project');
    });
  });

  describe('detectName()', () => {
    it('detects name from pyproject.toml with project section', async () => {
      fs.pathExists.mockResolvedValue(true);
      toml.parse.mockReturnValue(mockPyprojectData);

      await expect(python.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();
    });

    it('detects name from pyproject.toml with poetry section', async () => {
      fs.pathExists.mockResolvedValue(true);
      toml.parse.mockReturnValue(mockPyprojectPoetryData);

      await expect(python.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();
    });

    it('detects name from setup.py', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('pyproject.toml') && path.endsWith('setup.py'));
      });
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parse error');
      });

      await expect(python.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.py`, 'utf8');
    });

    it('detects name from setup.cfg', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(
          !path.endsWith('pyproject.toml') && !path.endsWith('setup.py') && path.endsWith('setup.cfg'),
        );
      });

      await expect(python.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.cfg`, 'utf8');
    });

    it('returns directory name when no project name could be found', async () => {
      fs.pathExists.mockResolvedValue(false);

      await expect(python.detectName(projectPath)).resolves.toEqual(projectPath.split('/').pop());
    });
  });
});
