import fs from "fs-extra";
import {
  describe,
  it,
  expect,
  beforeEach as beforeAll,
  vi,
  afterAll,
} from "vitest";

import * as deno from "./deno.js";

const name = "deno";
const version = "1.0.0";

const json = `{
  "name": "${name}",
  "version": "${version}"
}`;

const jsonc = `{
  // comment
  "name": "${name}",
  "version": "${version}"
}`;

describe("detect/deno.js module", () => {
  beforeAll(() => {
    vi.clearAllMocks();

    fs.readJson.mockImplementation((path) => {
      return JSON.parse(json);
    });
    fs.readFile.mockImplementation((path) => {
      if (path.includes("jsonc")) {
        return Promise.resolve(jsonc);
      }
      return Promise.resolve(json);
    });
  });

  describe("detectVersion()", () => {
    for (const file of [
      "deno.jsonc",
      "deno.json",
      "jsr.json",
      "package.json",
    ]) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(deno.detectVersion("test")).resolves.toEqual(version);
      });
    }
    it(`throws error when no config file is found`, async () => {
      fs.existingFile = "unknown";
      await expect(deno.detectVersion("test")).rejects.toThrow(
        "Could not detect version in Deno project",
      );
    });
  });

  describe("detectName()", () => {
    for (const file of [
      "deno.jsonc",
      "deno.json",
      "jsr.json",
      "package.json",
    ]) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(deno.detectName("test")).resolves.toEqual(name);
      });
    }
    it(`throws error when no config file is found`, async () => {
      fs.existingFile = "unknown";
      await expect(deno.detectName(name)).resolves.toEqual(name);
    });
  });
});
