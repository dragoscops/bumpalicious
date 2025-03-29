import fs from "fs-extra";
import {
  describe,
  it,
  expect,
  beforeEach as beforeAll,
  vi,
  afterAll,
} from "vitest";

import * as node from "./node.js";

const name = "node";
const version = "1.0.0";

const json = `{
  "name": "${name}",
  "version": "${version}"
}`;

describe("detect/node.js module", () => {
  beforeAll(() => {
    vi.clearAllMocks();

    fs.readJson.mockImplementation((path) => {
      return JSON.parse(json);
    });
  });

  describe("detectVersion()", () => {
    for (const file of ["jsr.json", "package.json"]) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(node.detectVersion("test")).resolves.toEqual(version);
      });
    }

    it(`throws error when no config file is found`, async () => {
      fs.existingFile = "unknown";
      await expect(node.detectVersion("test")).rejects.toThrow(
        "Could not detect version in Node.js project",
      );
    });
  });

  describe("detectName()", () => {
    for (const file of ["jsr.json", "package.json", "unknown"]) {
      it(`detects version on a ${file} file`, async () => {
        fs.existingFile = file;
        await expect(node.detectName(name)).resolves.toEqual(name);
      });
    }
  });
});
