import fs from "fs-extra";
import { describe, it, expect, beforeEach as beforeAll, vi } from "vitest";
import * as text from "./text.js";

describe("detect/text.js module", () => {
  const version = "1.0.0";
  const versionFileContent = version;

  beforeAll(() => {
    vi.clearAllMocks();

    fs.readFile.mockImplementation((path) => {
      if (path.endsWith("version")) {
        return Promise.resolve(versionFileContent);
      }
      return Promise.reject(new Error("File not found"));
    });

    fs.pathExists.mockImplementation((path) => {
      return Promise.resolve(path.endsWith("version"));
    });
  });

  describe("detectVersion()", () => {
    it("detects version from version file", async () => {
      await expect(text.detectVersion("test"))
        .resolves.toEqual(version);
    });

    it("throws error when no version file is found", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(text.detectVersion("test"))
        .rejects.toThrow("Could not detect version in text project");
    });
  });

  describe("detectName()", () => {
    it("returns directory name as project name", async () => {
      await expect(text.detectName("test"))
        .resolves.toEqual("test");
    });
  });
});