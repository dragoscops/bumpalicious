import fs from "fs-extra";
import { describe, it, expect, beforeEach as beforeAll, vi } from "vitest";
import * as go from "./go.js";

describe("detect/go.js module", () => {
  const moduleName = "example-module";
  const version = "1.2.3";
  const goModContent = `module ${moduleName}\nversion = \"${version}\"`;

  beforeAll(() => {
    vi.clearAllMocks();

    fs.readFile.mockImplementation((path) => {
      if (path.endsWith("go.mod")) {
        return Promise.resolve(goModContent);
      }
      return Promise.reject(new Error("File not found"));
    });

    fs.pathExists.mockImplementation((path) => {
      return Promise.resolve(path.endsWith("go.mod"));
    });
  });

  describe("detectVersion()", () => {
    it("extracts version from go.mod", async () => {
      await expect(go.detectVersion("test"))
        .resolves.toEqual(version);
    });

    it("throws error when go.mod is missing", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(go.detectVersion("test"))
        .rejects.toThrow("Could not detect version in Go project");
    });
  });

  describe("detectName()", () => {
    it("detects name from go.mod", async () => {
      await expect(go.detectName("test"))
        .resolves.toEqual("example-module");
    });

    it("returns directory name when go.mod is missing", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(go.detectName("test"))
        .resolves.toEqual("test");
    });
  });
});