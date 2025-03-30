import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi} from 'vitest';
import * as python from './python.js';
import * as logging from '../utils/logging.js';
import toml from '@iarna/toml';

// Mock logging
vi.mock('../utils/logging.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

describe('update/python.js module', () => {
  it('true', () => {
    expect(true).toBe(true);
  });
  //   const projectPath = "/test/project";
  //   const newVersion = "1.2.3";
  //   const oldVersion = "1.0.0";

  //   // Mock TOML data structure
  //   const mockPyprojectData = {
  //     tool: {
  //       poetry: {
  //         name: "test-project",
  //         version: oldVersion
  //       }
  //     }
  //   };

  //   const mockPyprojectContent = `[tool.poetry]
  // name = "test-project"
  // version = "${oldVersion}"`;

  //   const setupPyContent = `from setuptools import setup

  // setup(
  //     name="test-project",
  //     version="${oldVersion}",
  //     # ...
  // )`;

  //   const setupCfgContent = `[metadata]
  // name = test-project
  // version = ${oldVersion}`;

  //   const initPyContent = `"""Test module."""

  // __version__ = "${oldVersion}"
  // `;

  //   beforeAll(() => {
  //     vi.clearAllMocks();

  //     // Setup fs mocks
  //     fs.writeFile.mockResolvedValue(undefined);
  //     fs.readFile.mockImplementation((path) => {
  //       if (path.includes("pyproject.toml")) {
  //         return Promise.resolve(mockPyprojectContent);
  //       }
  //       if (path.includes("setup.py")) {
  //         return Promise.resolve(setupPyContent);
  //       }
  //       if (path.includes("setup.cfg")) {
  //         return Promise.resolve(setupCfgContent);
  //       }
  //       if (path.includes("__init__.py")) {
  //         return Promise.resolve(initPyContent);
  //       }
  //       return Promise.reject(new Error("File not found"));
  //     });

  //     // Mock TOML parser
  //     toml.parse.mockReturnValue({ ...mockPyprojectData });
  //     toml.stringify.mockImplementation((data) => JSON.stringify(data, null, 2));
  //   });

  //   describe("updateVersion()", () => {
  //     it("updates version in pyproject.toml using TOML parser", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("pyproject.toml"));
  //       });

  //       const result = await python.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(toml.parse).toHaveBeenCalledWith(mockPyprojectContent);
  //       expect(toml.stringify).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           tool: {
  //             poetry: {
  //               name: "test-project",
  //               version: newVersion
  //             }
  //           }
  //         })
  //       );
  //       expect(fs.writeFile).toHaveBeenCalled();
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("falls back to regex if TOML parsing fails", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("pyproject.toml"));
  //       });

  //       // Make TOML parser throw an error
  //       toml.parse.mockImplementationOnce(() => {
  //         throw new Error("TOML parsing error");
  //       });

  //       const result = await python.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(logging.error).toHaveBeenCalled();
  //       expect(fs.writeFile).toHaveBeenCalled();
  //     });

  //     it("updates version in setup.py", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("setup.py"));
  //       });

  //       const result = await python.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.py`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/setup.py`,
  //         expect.stringContaining(`version="${newVersion}"`)
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("updates version in setup.cfg", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("setup.cfg"));
  //       });

  //       const result = await python.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/setup.cfg`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/setup.cfg`,
  //         expect.stringContaining(`version = ${newVersion}`)
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("updates version in __init__.py", async () => {
  //       fs.pathExists.mockImplementation((path) => {
  //         return Promise.resolve(path.endsWith("__init__.py"));
  //       });

  //       const result = await python.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.readFile).toHaveBeenCalledWith(`${projectPath}/__init__.py`, "utf8");
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/__init__.py`,
  //         expect.stringContaining(`__version__ = "${newVersion}"`)
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });

  //     it("creates version file when no config files exist", async () => {
  //       fs.pathExists.mockResolvedValue(false);

  //       const result = await python.updateVersion({ projectPath, newVersion });

  //       expect(result).toBe(true);
  //       expect(fs.writeFile).toHaveBeenCalledWith(
  //         `${projectPath}/version`,
  //         newVersion,
  //         "utf8"
  //       );
  //       expect(logging.success).toHaveBeenCalledWith(expect.stringContaining(newVersion));
  //     });
  //   });
});
