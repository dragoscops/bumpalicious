import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';
import * as node from './node.js';
import * as logging from '../utils/logging.js';
import {projectPath, newVersion, oldVersion, projectName, setupFileMocks} from '../vitest/setup.detect-update.tests.js';

// Define NODE_VERSION_FILES to match the implementation
const NODE_VERSION_FILES = ['package.json', 'jsr.json'];

describe('update/node.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();

    // Mock console methods used in the Node update module
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateNodeVersion()', () => {
    // Test updating the version in package.json
    it('updates version in package.json', async () => {
      setupFileMocks({
        pathPattern: 'package.json',
        jsonContent: {
          name: projectName,
          version: oldVersion,
        },
      });

      // Make jsr.json not exist for this test
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path === 'package.json');
      });

      await node.updateNodeVersion(newVersion);

      expect(fs.readJson).toHaveBeenCalledWith('package.json');
      expect(fs.writeJson).toHaveBeenCalledWith('package.json', {name: projectName, version: newVersion}, {spaces: 2});
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    // Test updating the version in jsr.json
    it('updates version in jsr.json', async () => {
      setupFileMocks({
        pathPattern: 'jsr.json',
        jsonContent: {
          name: projectName,
          version: oldVersion,
        },
      });

      // Make package.json not exist for this test
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path === 'jsr.json');
      });

      await node.updateNodeVersion(newVersion);

      expect(fs.readJson).toHaveBeenCalledWith('jsr.json');
      expect(fs.writeJson).toHaveBeenCalledWith('jsr.json', {name: projectName, version: newVersion}, {spaces: 2});
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(newVersion));
    });

    // Test updating both files when they exist
    it('updates version in both package.json and jsr.json when both exist', async () => {
      // Mock both files existing
      fs.pathExists.mockResolvedValue(true);

      // Setup mock response for readJson
      fs.readJson.mockImplementation((path) => {
        if (path === 'package.json' || path === 'jsr.json') {
          return Promise.resolve({name: projectName, version: oldVersion});
        }
        return Promise.reject(new Error('File not found'));
      });

      await node.updateNodeVersion(newVersion);

      expect(fs.readJson).toHaveBeenCalledWith('package.json');
      expect(fs.readJson).toHaveBeenCalledWith('jsr.json');
      expect(fs.writeJson).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledTimes(2);
    });

    // Test error handling when files don't exist
    it('throws error when no config files exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      await expect(node.updateNodeVersion(newVersion)).rejects.toThrow('No version files found');
      expect(fs.writeJson).not.toHaveBeenCalled();
    });

    // Test error handling when readJson fails
    it('handles errors when reading package.json fails', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path === 'package.json');
      });
      fs.readJson.mockRejectedValue(new Error('Test error'));

      await expect(node.updateNodeVersion(newVersion)).rejects.toThrow();
      expect(console.error).toHaveBeenCalled();
    });

    // Test error handling when writeJson fails
    it('handles errors when writing package.json fails', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path === 'package.json');
      });
      fs.readJson.mockResolvedValue({name: projectName, version: oldVersion});
      fs.writeJson.mockRejectedValue(new Error('Test write error'));

      await expect(node.updateNodeVersion(newVersion)).rejects.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
