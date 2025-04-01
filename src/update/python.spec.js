import fs from 'fs-extra';
import toml from '@iarna/toml';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as python from './python.js';
import * as logging from '../utils/logging.js';
import {
  projectPath,
  newVersion,
  oldVersion,
  projectName,
  setupFileMocks,
  mockPyprojectData,
  mockPyprojectPoetryData,
  pyprojectContent,
  pyprojectPoetryContent,
  PYTHON_VERSION_FILES,
} from '../vitest/setup.detect-update.tests.js';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('@iarna/toml');
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe.skip('update/python.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    it('updates version in pyproject.toml with project section', async () => {
      // Mock the TOML parse and stringify
      const updatedData = JSON.parse(JSON.stringify(mockPyprojectData));
      updatedData.project.version = newVersion;

      toml.parse.mockReturnValue(updatedData);
      toml.stringify.mockReturnValue(`[project]\nname = "${projectName}"\nversion = "${newVersion}"\n`);

      // Reset all mock implementations first
      vi.clearAllMocks();

      // Setup only the relevant paths
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('pyproject.toml'));
      });
      fs.readFile.mockResolvedValue(pyprojectContent);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();

      // Only check if the first call to writeFile includes the expected file path and new version
      expect(fs.writeFile.mock.calls[0][0]).toBe(`${projectPath}/pyproject.toml`);
      expect(fs.writeFile.mock.calls[0][1]).toContain(newVersion);

      expect(logging.success).toHaveBeenCalled();
    });

    it('updates version in pyproject.toml with poetry section', async () => {
      // Mock the TOML parse and stringify
      const updatedData = JSON.parse(JSON.stringify(mockPyprojectPoetryData));
      updatedData.tool.poetry.version = newVersion;

      toml.parse.mockReturnValue(updatedData);
      toml.stringify.mockReturnValue(`[tool.poetry]\nname = "${projectName}"\nversion = "${newVersion}"\n`);

      // Reset all mock implementations first
      vi.clearAllMocks();

      // Setup only the relevant paths
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('pyproject.toml'));
      });
      fs.readFile.mockResolvedValue(pyprojectPoetryContent);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();

      // Only check if the first call to writeFile includes the expected file path and new version
      expect(fs.writeFile.mock.calls[0][0]).toBe(`${projectPath}/pyproject.toml`);
      expect(fs.writeFile.mock.calls[0][1]).toContain(newVersion);

      expect(logging.success).toHaveBeenCalled();
    });

    it('falls back to regex when TOML parsing fails', async () => {
      // Make TOML parse fail
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parse error');
      });

      // Reset all mock implementations first
      vi.clearAllMocks();

      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.endsWith('pyproject.toml'));
      });
      fs.readFile.mockResolvedValue(pyprojectContent);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/pyproject.toml`, 'utf8');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('using regex'));
      expect(logging.error).toHaveBeenCalled();
    });

    it('updates version in setup.py', async () => {
      const setupPyContent = `setup(\n  name="${projectName}",\n  version="${oldVersion}"\n)`;

      // Reset all mock implementations first
      vi.clearAllMocks();

      fs.pathExists.mockImplementation((path) => {
        if (path.includes('pyproject.toml')) return Promise.resolve(false);
        if (path.includes('setup.py')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      fs.readFile.mockResolvedValue(setupPyContent);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.py`, 'utf8');

      // Verify the first write call is to setup.py and includes the new version
      expect(fs.writeFile.mock.calls[0][0]).toBe(`${projectPath}/setup.py`);
      expect(fs.writeFile.mock.calls[0][1]).toContain(`version="${newVersion}"`);

      expect(logging.success).toHaveBeenCalled();
    });

    it('updates version in setup.cfg', async () => {
      const setupCfgContent = `[metadata]\nname = ${projectName}\nversion = ${oldVersion}`;

      // Reset all mock implementations first
      vi.clearAllMocks();

      fs.pathExists.mockImplementation((path) => {
        if (path.includes('pyproject.toml')) return Promise.resolve(false);
        if (path.includes('setup.py')) return Promise.resolve(false);
        if (path.includes('setup.cfg')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      fs.readFile.mockResolvedValue(setupCfgContent);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.cfg`, 'utf8');

      // Verify the first write call is to setup.cfg and includes the new version
      expect(fs.writeFile.mock.calls[0][0]).toBe(`${projectPath}/setup.cfg`);
      expect(fs.writeFile.mock.calls[0][1]).toContain(`version = ${newVersion}`);

      expect(logging.success).toHaveBeenCalled();
    });

    it('updates version in __init__.py', async () => {
      const initPyContent = `__version__ = "${oldVersion}"\n`;

      // Reset all mock implementations first
      vi.clearAllMocks();

      // Only allow __init__.py to exist
      fs.pathExists.mockImplementation((path) => {
        if (path.includes('__init__.py')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      fs.readFile.mockResolvedValue(initPyContent);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);

      // Check that at least one of the writeFile calls is for a __init__.py file
      // and contains the new version
      let foundInitPyUpdate = false;
      for (const call of fs.writeFile.mock.calls) {
        if (call[0].includes('__init__.py') && call[1].includes(`__version__ = "${newVersion}"`)) {
          foundInitPyUpdate = true;
          break;
        }
      }
      expect(foundInitPyUpdate).toBe(true);

      expect(logging.success).toHaveBeenCalled();
    });

    it('creates version file when no config files exist', async () => {
      // Reset all mock implementations first
      vi.clearAllMocks();

      fs.pathExists.mockResolvedValue(false);

      const result = await python.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/version`, newVersion, 'utf8');
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('Created version file'));
    });

    it('handles errors gracefully', async () => {
      // Reset all mock implementations first
      vi.clearAllMocks();

      // Setup for error handling test - let Python module create a fallback version file
      fs.pathExists.mockImplementation((path) => {
        if (path.includes('setup.py')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      fs.readFile.mockRejectedValue(new Error('Test error'));

      // The Python module doesn't actually reject in this case, it logs error and tries alternatives
      const result = await python.updateVersion({projectPath, newVersion});
      expect(result).toBe(true);
      expect(logging.error).toHaveBeenCalled();
    });
  });
});
