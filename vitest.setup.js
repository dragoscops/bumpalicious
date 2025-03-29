import { execa } from "execa";
import fs from "fs-extra";

process.exit = vi.fn();

// Mock the execa module
vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "" }),
}));

vi.mock("fs-extra", () => {
  const def = {
    ...fs,
    readFile: vi.fn(),
  };

  return { ...def, default: def };
});
