/**
 * Tests for RustAdapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RustAdapter } from './RustAdapter.js';
import { isOk, isErr } from '../../types/result.js';
import { toVersion } from '../../types/version.js';

describe('RustAdapter', () => {
  let testDir: string;
  let adapter: RustAdapter;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `rust-adapter-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    adapter = new RustAdapter();
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('properties', () => {
    it('should have correct workspace type', () => {
      expect(adapter.type).toBe('rust');
    });

    it('should have correct supported files', () => {
      expect(adapter.supportedFiles).toEqual(['Cargo.toml']);
    });
  });

  describe('detect', () => {
    describe('Cargo.toml', () => {
      it('should detect version from Cargo.toml', async () => {
        const cargoToml = `[package]
name = "my-rust-crate"
version = "1.2.3"
edition = "2021"

[dependencies]
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-rust-crate');
          expect(result.value.version).toBe('1.2.3');
        }
      });

      it('should detect pre-release version from Cargo.toml', async () => {
        const cargoToml = `[package]
name = "test-crate"
version = "2.0.0-alpha.1"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0-alpha.1');
        }
      });

      it('should handle version with build metadata', async () => {
        const cargoToml = `[package]
name = "build-meta-crate"
version = "1.0.0+20231201"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0+20231201');
        }
      });

      it('should handle Cargo.toml with dependencies', async () => {
        const cargoToml = `[package]
name = "complex-crate"
version = "0.5.0"
edition = "2021"
authors = ["John Doe <john@example.com>"]
license = "MIT"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
criterion = "0.5"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('complex-crate');
          expect(result.value.version).toBe('0.5.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no Cargo.toml exists', async () => {
        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Cargo.toml file found');
        }
      });

      it('should return error for malformed TOML', async () => {
        const invalidToml = `[package
name = "broken"
version = "1.0.0"
`;
        await writeFile(join(testDir, 'Cargo.toml'), invalidToml);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Failed to parse Cargo.toml');
        }
      });

      it('should return error when version is missing', async () => {
        const cargoToml = `[package]
name = "no-version-crate"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Failed to parse Cargo.toml');
        }
      });

      it('should return error when name is missing', async () => {
        const cargoToml = `[package]
version = "1.0.0"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Failed to parse Cargo.toml');
        }
      });

      it('should return error for invalid version format', async () => {
        const cargoToml = `[package]
name = "invalid-version"
version = "not-a-version"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Failed to parse Cargo.toml');
        }
      });

      it('should return error for non-existent directory', async () => {
        const nonExistentDir = join(testDir, 'does-not-exist');

        const result = await adapter.detect(nonExistentDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Cargo.toml file found');
        }
      });
    });
  });

  describe('update', () => {
    describe('successful updates', () => {
      it('should update version in Cargo.toml', async () => {
        const cargoToml = `[package]
name = "my-crate"
version = "1.0.0"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify version was updated
        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0');
        }
      });

      it('should update to pre-release version', async () => {
        const cargoToml = `[package]
name = "test-crate"
version = "1.5.0"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.update(testDir, toVersion('2.0.0-beta.1'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0-beta.1');
        }
      });

      it('should preserve TOML structure and formatting', async () => {
        const cargoToml = `[package]
name = "preserve-crate"
version = "1.0.0"
edition = "2021"
authors = ["Test Author"]

[dependencies]
serde = "1.0"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.update(testDir, toVersion('1.1.0'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.name).toBe('preserve-crate');
          expect(detectResult.value.version).toBe('1.1.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no Cargo.toml exists', async () => {
        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Cargo.toml not found');
        }
      });

      it('should return error for malformed TOML', async () => {
        const invalidToml = `[package
name = "broken"
version = "1.0.0"
`;
        await writeFile(join(testDir, 'Cargo.toml'), invalidToml);

        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
      });

      it('should return error when version field is missing', async () => {
        const cargoToml = `[package]
name = "no-version"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
      });

      it('should return error for non-existent directory', async () => {
        const nonExistentDir = join(testDir, 'does-not-exist');

        const result = await adapter.update(nonExistentDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Cargo.toml not found');
        }
      });
    });

    describe('version format preservation', () => {
      it('should handle pre-release versions', async () => {
        const cargoToml = `[package]
name = "prerelease-crate"
version = "1.0.0-alpha.1"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.update(testDir, toVersion('1.0.0-rc.1'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('1.0.0-rc.1');
        }
      });

      it('should handle versions with build metadata', async () => {
        const cargoToml = `[package]
name = "build-meta"
version = "1.0.0"
edition = "2021"
`;
        await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

        const result = await adapter.update(testDir, toVersion('1.0.0+20231201'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('1.0.0+20231201');
        }
      });
    });
  });

  describe('integration tests', () => {
    it('should handle detect and update workflow', async () => {
      const cargoToml = `[package]
name = "workflow-test"
version = "1.0.0"
edition = "2021"
`;
      await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

      // Detect initial version
      const detectResult1 = await adapter.detect(testDir);
      expect(isOk(detectResult1)).toBe(true);
      if (isOk(detectResult1)) {
        expect(detectResult1.value.version).toBe('1.0.0');
      }

      // Update version
      const updateResult = await adapter.update(testDir, toVersion('2.0.0'));
      expect(isOk(updateResult)).toBe(true);

      // Detect updated version
      const detectResult2 = await adapter.detect(testDir);
      expect(isOk(detectResult2)).toBe(true);
      if (isOk(detectResult2)) {
        expect(detectResult2.value.version).toBe('2.0.0');
      }
    });

    it('should handle real-world Cargo.toml structure', async () => {
      const cargoToml = `[package]
name = "real-world-crate"
version = "0.3.0"
edition = "2021"
authors = ["Jane Doe <jane@example.com>"]
license = "MIT OR Apache-2.0"
description = "A real-world Rust crate"
homepage = "https://example.com"
repository = "https://github.com/example/crate"
keywords = ["rust", "example", "testing"]
categories = ["development-tools"]

[lib]
name = "real_world_crate"
path = "src/lib.rs"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }
anyhow = "1.0"

[dev-dependencies]
criterion = "0.5"
proptest = "1.0"

[profile.release]
opt-level = 3
lto = true
`;
      await writeFile(join(testDir, 'Cargo.toml'), cargoToml);

      // Detect
      const detectResult = await adapter.detect(testDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('real-world-crate');
        expect(detectResult.value.version).toBe('0.3.0');
      }

      // Update
      const updateResult = await adapter.update(testDir, toVersion('1.0.0'));
      expect(isOk(updateResult)).toBe(true);

      // Verify update preserved structure
      const detectResult2 = await adapter.detect(testDir);
      expect(isOk(detectResult2)).toBe(true);
      if (isOk(detectResult2)) {
        expect(detectResult2.value.name).toBe('real-world-crate');
        expect(detectResult2.value.version).toBe('1.0.0');
      }
    });
  });
});
