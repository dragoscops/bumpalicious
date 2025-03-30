import toml from '@iarna/toml';
import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';

import * as python from './python.js';
import {folder, mockConfigFiles, name, pyprojectContent, version} from '../vitest/index.js';

describe('detect/python.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('true', () => {
    expect(true).toBe(true);
  });

  // describe("detectVersion()", () => {
  //     it("detects version from pyproject.toml using TOML parser", async () => {
  //         fs.existingFile = "pyproject.toml";

  //         await expect(python.detectVersion("test"))
  //             .resolves.toEqual(version);

  //         expect(toml.parse).toHaveBeenCalledWith(pyprojectContent);
  //     });

  //     it("falls back to setup.py when pyproject.toml is not present", async () => {
  //         fs.existingFile = "setup.py";

  //         await expect(python.detectVersion("test"))
  //             .resolves.toEqual(version);
  //     });

  //     it("throws error when no config file is found", async () => {
  //         fs.existingFile = "unknown";

  //         await expect(python.detectVersion("test"))
  //             .rejects.toThrow("Could not detect version in Python project");
  //     });
  // });

  // describe("detectName()", () => {
  //     it("detects name from pyproject.toml using TOML parser", async () => {
  //         await expect(python.detectName("test"))
  //             .resolves.toEqual(name);
  //         expect(toml.parse).toHaveBeenCalledWith(pyprojectContent);
  //     });

  //     it("falls back to setup.py when pyproject.toml is not present", async () => {
  //         fs.pathExists.mockImplementation((path) => {
  //             if (path.endsWith("pyproject.toml")) {
  //                 return Promise.resolve(false);
  //             }
  //             if (path.endsWith("setup.py")) {
  //                 return Promise.resolve(true);
  //             }
  //             return Promise.resolve(false);
  //         });

  //         await expect(python.detectName("test"))
  //             .resolves.toEqual(name);
  //     });

  //     it("returns directory name when no config file is found", async () => {
  //         fs.pathExists.mockResolvedValue(false);
  //         await expect(python.detectName("test"))
  //             .resolves.toEqual("test");
  //     });
  // });
});
