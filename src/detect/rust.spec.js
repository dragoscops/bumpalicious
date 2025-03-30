import fs from "fs-extra";
import { describe, it, expect, beforeEach as beforeAll, vi, afterAll } from "vitest";
import * as rust from "./rust.js";
import toml from "@iarna/toml";
import { execa } from "execa";
import { mockConsole, unMockConsole } from "../vitest/index.js";

describe("detect/rust.js module", () => {
  const name = "example-crate";
  const version = "1.0.0";
  const cargoContent = `[package]
name = "${name}"
version = "${version}"`;

  const mockCargoData = {
    package: {
      name,
      version
    }
  };

  beforeAll(() => {
    vi.clearAllMocks();
    mockConsole(['error'])

    fs.readFile.mockImplementation((path) => {
      if (path.endsWith("Cargo.toml")) {
        return Promise.resolve(cargoContent);
      }
      return Promise.reject(new Error("File not found"));
    });

    fs.pathExists.mockImplementation((path) => {
      return Promise.resolve(path.endsWith("Cargo.toml"));
    });

    toml.parse.mockImplementation(() => mockCargoData);
  });

  afterAll(() => {
    unMockConsole(['error']);
  })

  describe("detectVersion()", () => {
    it("detects version from Cargo.toml using TOML parser", async () => {
      await expect(rust.detectVersion("test"))
        .resolves.toEqual(version);
      expect(toml.parse).toHaveBeenCalledWith(cargoContent);
    });

    it("detects version from Cargo.toml using cargo command", async () => {
      toml.parse.mockImplementation(() => {
        throw new Error("TOML parsing error");
      });
      
      const execaMock = execa.mockRestore().mockResolvedValue({
        stdout: "example-crate@1.0.0"
      });
      
      await expect(rust.detectVersion("test"))
        .resolves.toEqual(version);
      
      execaMock.mockRestore();
    });

    it("throws error when Cargo.toml is missing", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(rust.detectVersion("test"))
        .rejects.toThrow("Could not detect version in Rust project");
    });

    it("handles TOML parsing errors gracefully", async () => {
      toml.parse.mockImplementation(() => {
        throw new Error("TOML parsing error");
      });
      
      const execaMock = execa.mockRestore().mockResolvedValue({
        stdout: ""
      });
      
      await expect(rust.detectVersion("test"))
        .rejects.toThrow("Could not detect version in Rust project");
      
      execaMock.mockRestore();
    });
  });

  describe("detectName()", () => {
    it("detects name from Cargo.toml using TOML parser", async () => {
      await expect(rust.detectName("test"))
        .resolves.toEqual(name);
      expect(toml.parse).toHaveBeenCalledWith(cargoContent);
    });

    it("returns directory name when Cargo.toml is missing", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(rust.detectName("test"))
        .resolves.toEqual("test");
    });
  });
});