import { execa } from "execa";
import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";

import * as workspaces from "./workspaces.js";

describe("workspace.js module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fromString", () => {
    it("will parse path and type", async () => {
      const result = workspaces.fromString(".:text");

      expect(result).toEqual({ path: ".", type: "text" });
    });
    it("will parse all 4 params", async () => {
      const result = workspaces.fromString(".:text:project:1.0.0");

      expect(result).toEqual({
        name: "project",
        path: ".",
        type: "text",
        version: "1.0.0",
      });
    });
  });
});
