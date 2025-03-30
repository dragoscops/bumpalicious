import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll, beforeEach} from 'vitest';
import * as rust from './rust.js';
import toml from '@iarna/toml';
import {execa} from 'execa';

import {
  folder,
  mockConsole,
  unMockConsole,
  mockConfigFiles,
  mockCargoData,
  name,
  version,
  cargoContent,
} from '../vitest/index.js';

describe('detect/rust.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConsole(['error']);
    mockConfigFiles();
    toml.parse.mockImplementation(() => mockCargoData);
  });

  afterAll(() => {
    unMockConsole(['error']);
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fs.existingFile = 'Cargo.toml';
    // fs.existingFile = 'unknown';
  });

  describe('detectVersion()', () => {
    it('detects version from Cargo.toml using TOML parser', async () => {
      await expect(rust.detectVersion('test')).resolves.toEqual(version);
      expect(toml.parse).toHaveBeenCalledWith(cargoContent);
    });

    it('detects version from Cargo.toml using cargo command', async () => {
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parsing error');
      });

      const execaMock = execa.mockRestore().mockResolvedValue({
        stdout: `${name}@${version}`,
      });

      await expect(rust.detectVersion(folder)).resolves.toEqual(version);

      execaMock.mockRestore();
    });

    it('throws error when Cargo.toml is missing', async () => {
      fs.existingFile = 'unknown';

      await expect(rust.detectVersion(folder)).rejects.toThrow('Could not detect version in Rust project');
    });

    it('handles TOML parsing errors gracefully', async () => {
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parsing error');
      });

      const execaMock = execa.mockRestore().mockResolvedValue({
        stdout: '',
      });

      await expect(rust.detectVersion(folder)).rejects.toThrow('Could not detect version in Rust project');

      execaMock.mockRestore();
    });
  });

  describe('detectName()', () => {
    it('detects name from Cargo.toml using TOML parser', async () => {
      await expect(rust.detectName(folder)).resolves.toEqual(name);
      expect(toml.parse).toHaveBeenCalledWith(cargoContent);
    });

    it('returns directory name when Cargo.toml is missing', async () => {
      fs.existingFile = 'unknown';

      await expect(rust.detectName(folder)).resolves.toEqual(folder);
    });
  });
});
