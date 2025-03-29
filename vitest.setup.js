import { execa } from "execa";

process.exit = vi.fn();

// Mock the execa module
vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "" }),
}));
