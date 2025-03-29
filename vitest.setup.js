import { execa } from "execa";
import fs from "fs-extra";

process.exit = vi.fn();

// Mock the execa module
vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "" }),
}));

vi.mock("fs-extra", async () => {
  const actual = await vi.importActual("fs-extra");
  const def = {
    ...actual,
    pathExists: vi
      .fn()
      .mockImplementation((path) =>
        Promise.resolve(path.endsWith(def.existingFile)),
      ),
    readJson: vi.fn(),
    readFile: vi.fn(),

    existingFile: "",
  };
  return { ...def, default: def };
});
