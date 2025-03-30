import fs from "fs-extra";
import { describe, it, expect, beforeEach as beforeAll, vi } from "vitest";
import * as python from "./python.js";
import toml from "@iarna/toml";

describe("detect/python.js module", () => {
  const name = "example-package";
  const version = "1.0.0";
  const pyprojectContent = `[tool.poetry]
name = "${name}"
version = "${version}"`;
  const setupPyContent = `setup(
    name="${name}",
    version="${version}"
)`;

  const mockPyprojectData = {
    tool: {
      poetry: {
        name,
        version
      }
    }
  };

  beforeAll(() => {
    vi.clearAllMocks();

    fs.readFile.mockImplementation((path) => {
      if (path.endsWith("pyproject.toml")) {
        return Promise.resolve(pyprojectContent);
      }
      if (path.endsWith("setup.py")) {
        return Promise.resolve(setupPyContent);
      }
      return Promise.reject(new Error("File not found"));
    });

    fs.pathExists.mockImplementation((path) => {
      if (path.endsWith("pyproject.toml")) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    });

    toml.parse.mockImplementation(() => mockPyprojectData);
  });

  describe("detectVersion()", () => {
    it("detects version from pyproject.toml using TOML parser", async () => {
      await expect(python.detectVersion("test"))
        .resolves.toEqual(version);
      expect(toml.parse).toHaveBeenCalledWith(pyprojectContent);
    });

    it("falls back to setup.py when pyproject.toml is not present", async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path.endsWith("pyproject.toml")) {
          return Promise.resolve(false);
        }
        if (path.endsWith("setup.py")) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      
      await expect(python.detectVersion("test"))
        .resolves.toEqual(version);
    });

    it("throws error when no config file is found", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(python.detectVersion("test"))
        .rejects.toThrow("Could not detect version in Python project");
    });
  });

  describe("detectName()", () => {
    it("detects name from pyproject.toml using TOML parser", async () => {
      await expect(python.detectName("test"))
        .resolves.toEqual(name);
      expect(toml.parse).toHaveBeenCalledWith(pyprojectContent);
    });

    it("falls back to setup.py when pyproject.toml is not present", async () => {
      fs.pathExists.mockImplementation((path) => {
        if (path.endsWith("pyproject.toml")) {
          return Promise.resolve(false);
        }
        if (path.endsWith("setup.py")) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      
      await expect(python.detectName("test"))
        .resolves.toEqual(name);
    });

    it("returns directory name when no config file is found", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(python.detectName("test"))
        .resolves.toEqual("test");
    });
  });
});