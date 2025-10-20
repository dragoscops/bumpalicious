/**
 * Tests for ZigAdapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ZigAdapter } from './ZigAdapter.js';
import { isOk, isErr } from '../../types/result.js';
import { toVersion } from '../../types/version.js';

describe('ZigAdapter', () => {
  let testDir: string;
  let adapter: ZigAdapter;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `zig-adapter-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    adapter = new ZigAdapter();
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('properties', () => {
    it('should have correct workspace type', () => {
      expect(adapter.type).toBe('zig');
    });

    it('should have correct supported files', () => {
      expect(adapter.supportedFiles).toEqual(['build.zig.zon', 'build.zig']);
    });
  });

  describe('detect', () => {
    describe('build.zig.zon', () => {
      it('should detect version from build.zig.zon', async () => {
        const buildZigZon = `.{
    .name = "my-zig-package",
    .version = "1.2.3",
    .paths = .{""},
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-zig-package');
          expect(result.value.version).toBe('1.2.3');
        }
      });

      it('should detect pre-release version from build.zig.zon', async () => {
        const buildZigZon = `.{
    .name = "test-package",
    .version = "2.0.0-alpha.1",
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0-alpha.1');
        }
      });

      it('should handle complex build.zig.zon structure', async () => {
        const buildZigZon = `.{
    .name = "complex-package",
    .version = "0.5.0",
    .paths = .{""},
    .dependencies = .{
        .some_dep = .{
            .url = "https://example.com/dep.tar.gz",
            .hash = "1234567890abcdef",
        },
    },
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('complex-package');
          expect(result.value.version).toBe('0.5.0');
        }
      });
    });

    describe('build.zig', () => {
      it('should detect version from build.zig', async () => {
        const buildZig = `const std = @import("std");

const VERSION = "1.0.0";
const NAME = "my-zig-project";

pub fn build(b: *std.Build) void {
    // Build configuration
}
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-zig-project');
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should detect version with lowercase const', async () => {
        const buildZig = `const std = @import("std");

const version = "2.1.0";
const name = "lowercase-project";
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.1.0');
        }
      });

      it('should handle pre-release version in build.zig', async () => {
        const buildZig = `const VERSION = "1.0.0-beta.2";
const NAME = "beta-project";
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0-beta.2');
        }
      });
    });

    describe('priority order', () => {
      it('should prefer build.zig.zon over build.zig', async () => {
        const buildZigZon = `.{
    .name = "zon-package",
    .version = "2.0.0",
}
`;
        const buildZig = `const VERSION = "1.0.0";
const NAME = "build-project";
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('zon-package');
          expect(result.value.version).toBe('2.0.0');
        }
      });

      it('should try build.zig if build.zig.zon is invalid', async () => {
        const invalidZon = `.{
    .name = "invalid",
}`;
        const buildZig = `const VERSION = "1.5.0";
const NAME = "fallback-project";
`;
        await writeFile(join(testDir, 'build.zig.zon'), invalidZon);
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.detect(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('fallback-project');
          expect(result.value.version).toBe('1.5.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Zig configuration file found');
        }
      });

      it('should return error for invalid version format in build.zig.zon', async () => {
        const buildZigZon = `.{
    .name = "invalid-version",
    .version = "not-a-version",
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error when version is missing in build.zig', async () => {
        const buildZig = `const NAME = "no-version-project";
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error when name is missing', async () => {
        const buildZigZon = `.{
    .version = "1.0.0",
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.detect(testDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error for non-existent directory', async () => {
        const nonExistentDir = join(testDir, 'does-not-exist');

        const result = await adapter.detect(nonExistentDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Zig configuration file found');
        }
      });
    });
  });

  describe('update', () => {
    describe('single file updates', () => {
      it('should update version in build.zig.zon', async () => {
        const buildZigZon = `.{
    .name = "my-package",
    .version = "1.0.0",
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify version was updated
        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0');
        }
      });

      it('should update version in build.zig', async () => {
        const buildZig = `const VERSION = "1.0.0";
const NAME = "my-project";
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.update(testDir, toVersion('3.0.0'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('3.0.0');
        }
      });

      it('should update to pre-release version', async () => {
        const buildZigZon = `.{
    .name = "test-package",
    .version = "1.0.0",
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.update(testDir, toVersion('2.0.0-rc.1'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0-rc.1');
        }
      });
    });

    describe('multi-file updates', () => {
      it('should update all existing config files', async () => {
        const buildZigZon = `.{
    .name = "multi-file",
    .version = "1.0.0",
}
`;
        const buildZig = `const VERSION = "1.0.0";
const NAME = "multi-file";
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.update(testDir, toVersion('2.5.0'));

        expect(isOk(result)).toBe(true);

        // Verify both files were updated
        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.5.0');
        }

        // Verify build.zig was also updated by removing build.zig.zon
        await rm(join(testDir, 'build.zig.zon'));
        const buildZigResult = await adapter.detect(testDir);
        expect(isOk(buildZigResult)).toBe(true);
        if (isOk(buildZigResult)) {
          expect(buildZigResult.value.version).toBe('2.5.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Zig configuration files found');
        }
      });

      it('should return error when version pattern does not match', async () => {
        const buildZig = `const NAME = "no-version";
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

        const result = await adapter.update(testDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
      });

      it('should return error for non-existent directory', async () => {
        const nonExistentDir = join(testDir, 'does-not-exist');

        const result = await adapter.update(nonExistentDir, toVersion('2.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Zig configuration files found');
        }
      });
    });

    describe('version format preservation', () => {
      it('should handle pre-release versions', async () => {
        const buildZigZon = `.{
    .name = "prerelease",
    .version = "1.0.0-alpha.1",
}
`;
        await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

        const result = await adapter.update(testDir, toVersion('1.0.0-rc.1'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(testDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('1.0.0-rc.1');
        }
      });

      it('should handle versions with build metadata', async () => {
        const buildZig = `const VERSION = "1.0.0";
const NAME = "build-meta";
`;
        await writeFile(join(testDir, 'build.zig'), buildZig);

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
      const buildZigZon = `.{
    .name = "workflow-test",
    .version = "1.0.0",
}
`;
      await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);

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

    it('should handle real-world Zig project structure', async () => {
      const buildZigZon = `.{
    .name = "real-world-zig",
    .version = "0.3.0",
    .paths = .{""},
    .dependencies = .{
        .some_lib = .{
            .url = "https://github.com/example/lib/archive/v1.0.0.tar.gz",
            .hash = "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
        },
        .another_lib = .{
            .url = "https://github.com/example/another/archive/v2.0.0.tar.gz",
            .hash = "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789012345",
        },
    },
}
`;
      const buildZig = `const std = @import("std");

const VERSION = "0.3.0";
const NAME = "real-world-zig";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = NAME,
        .root_source_file = .{ .path = "src/main.zig" },
        .target = target,
        .optimize = optimize,
    });

    b.installArtifact(exe);
}
`;
      await writeFile(join(testDir, 'build.zig.zon'), buildZigZon);
      await writeFile(join(testDir, 'build.zig'), buildZig);

      // Detect
      const detectResult = await adapter.detect(testDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('real-world-zig');
        expect(detectResult.value.version).toBe('0.3.0');
      }

      // Update
      const updateResult = await adapter.update(testDir, toVersion('1.0.0'));
      expect(isOk(updateResult)).toBe(true);

      // Verify both files were updated
      const detectResult2 = await adapter.detect(testDir);
      expect(isOk(detectResult2)).toBe(true);
      if (isOk(detectResult2)) {
        expect(detectResult2.value.version).toBe('1.0.0');
      }
    });
  });
});
