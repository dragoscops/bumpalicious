import fs from 'fs-extra';
import toml from '@iarna/toml';
import {execa} from 'execa';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as rust from './rust.js';
import {
  projectPath,
  oldVersion,
  projectName,
  cargoContent,
  mockCargoData,
} from '../vitest/setup.detect-update.tests.js';

// Define RUST_VERSION_FILES constant
const RUST_VERSION_FILES = ['Cargo.toml'];

// Mock the dependencies
vi.mock('fs-extra');
vi.mock('@iarna/toml');
vi.mock('execa');

describe.skip('detect/rust.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();

    // Mock cargo command output
    execa.mockResolvedValue({
      stdout: `https://github.com/username/${projectName}#${projectName}@${oldVersion}`,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    it('detects version from Cargo.toml', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);
      toml.parse.mockReturnValue(mockCargoData);

      await expect(rust.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/Cargo.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();
    });

    it('detects version using cargo pkgid when Cargo.toml parsing fails', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parse error');
      });

      await expect(rust.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(execa).toHaveBeenCalledWith('cargo', ['pkgid'], {cwd: projectPath});
    });

    it('detects version using cargo pkgid when Cargo.toml is missing version', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);
      toml.parse.mockReturnValue({package: {}}); // No version property

      await expect(rust.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      expect(execa).toHaveBeenCalledWith('cargo', ['pkgid'], {cwd: projectPath});
    });

    it('throws error when no version could be found', async () => {
      fs.pathExists.mockResolvedValue(false);
      execa.mockRejectedValue(new Error('Cargo error'));

      await expect(rust.detectVersion(projectPath)).rejects.toThrow('Could not detect version in Rust project');
    });
  });

  describe('detectName()', () => {
    it('detects name from Cargo.toml', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);
      toml.parse.mockReturnValue(mockCargoData);

      await expect(rust.detectName(projectPath)).resolves.toEqual(projectName);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/Cargo.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalled();
    });

    it('returns directory name when Cargo.toml parsing fails', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parse error');
      });

      await expect(rust.detectName(projectPath)).resolves.toEqual(projectPath.split('/').pop());
    });
  });
});
