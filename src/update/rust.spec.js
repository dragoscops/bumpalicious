import fs from 'fs-extra';
import toml from '@iarna/toml';
import {describe, it, expect, beforeAll, vi, afterAll} from 'vitest';
import * as rust from './rust.js';
import * as logging from '../utils/logging.js';
import {
  projectPath,
  newVersion,
  oldVersion,
  projectName,
  cargoContent,
  mockCargoData,
  mockConsole,
  unMockConsole,
} from '../vitest/setup.detect-update.tests.js';

// Define RUST_VERSION_FILES constant
const RUST_VERSION_FILES = ['Cargo.toml'];

describe.skip('update/rust.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConsole(['error', 'success']);
  });

  afterAll(() => {
    vi.restoreAllMocks();
    unMockConsole(['error', 'success']);
  });

  describe('updateVersion()', () => {
    it('updates version in Cargo.toml', async () => {
      // Setup the mocks
      const updatedData = JSON.parse(JSON.stringify(mockCargoData));
      updatedData.package.version = newVersion;

      toml.parse.mockReturnValue(JSON.parse(JSON.stringify(mockCargoData)));
      toml.stringify.mockReturnValue(`[package]\nname = "${projectName}"\nversion = "${newVersion}"\n`);

      // Reset all mock implementations
      vi.clearAllMocks();

      // Setup file mocks
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);

      const result = await rust.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/Cargo.toml`, 'utf8');
      expect(toml.parse).toHaveBeenCalledWith(cargoContent);

      // Verify the file was updated with the new version
      expect(fs.writeFile.mock.calls[0][0]).toBe(`${projectPath}/Cargo.toml`);
      expect(fs.writeFile.mock.calls[0][1]).toContain(newVersion);

      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    it('falls back to regex when TOML parsing fails', async () => {
      // Make TOML parse fail
      toml.parse.mockImplementation(() => {
        throw new Error('TOML parse error');
      });

      // Reset all mock implementations
      vi.clearAllMocks();

      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(cargoContent);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await rust.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/Cargo.toml`, 'utf8');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('using regex'));
      expect(logging.error).toHaveBeenCalled();
    });

    it('creates version file when Cargo.toml does not exist', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      fs.pathExists.mockResolvedValue(false);

      const result = await rust.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(`${projectPath}/version`, newVersion, 'utf8');
      expect(logging.success).toHaveBeenCalledWith(expect.stringContaining('Created version file'));
    });

    it('handles errors gracefully', async () => {
      // Reset all mock implementations
      vi.clearAllMocks();

      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockRejectedValue(new Error('Test error'));

      // The Rust module handles errors and creates a version file as fallback
      const result = await rust.updateVersion({projectPath, newVersion});

      expect(result).toBe(true);
      expect(logging.error).toHaveBeenCalled();
    });
  });
});
