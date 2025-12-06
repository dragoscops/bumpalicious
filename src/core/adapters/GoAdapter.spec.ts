/**
 * Tests for GoAdapter
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GoAdapter } from './GoAdapter.js';
import { isErr, isOk } from '../../types/result.js';
import { toVersion } from '../../types/version.js';

describe('GoAdapter', () => {
  let adapter: GoAdapter;
  let tempDir: string;

  beforeEach(async () => {
    adapter = new GoAdapter();
    tempDir = await mkdtemp(join(tmpdir(), 'go-adapter-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('properties', () => {
    it('should have correct workspace type', () => {
      expect(adapter.type).toBe('go');
    });

    it('should have correct supported files', () => {
      expect(adapter.supportedFiles).toEqual(['go.mod', 'version.go', 'VERSION.txt', 'version.txt']);
    });
  });

  describe('detect', () => {
    describe('go.mod', () => {
      it('should detect version from go.mod comment', async () => {
        const goMod = `module github.com/user/myproject

go 1.21

// version: 1.2.3

require (
	github.com/some/dependency v1.0.0
)`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('github.com/user/myproject');
          expect(result.value.version).toBe('1.2.3');
        }
      });

      it('should detect pre-release version from go.mod', async () => {
        const goMod = `module github.com/company/tool

// version: 2.0.0-beta.1

go 1.21`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0-beta.1');
        }
      });

      it('should handle Version with capital V', async () => {
        const goMod = `module example.com/project

// Version: 3.1.4

go 1.20`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('3.1.4');
        }
      });

      it('should handle version comment without colon', async () => {
        const goMod = `module myapp

// version 1.0.0`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }
      });
    });

    describe('version.go', () => {
      it('should detect version from version.go const', async () => {
        const versionGo = `package main

const Version = "1.5.0"

func main() {
	// ...
}`;
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('main');
          expect(result.value.version).toBe('1.5.0');
        }
      });

      it('should detect version from version.go var', async () => {
        const versionGo = `package mypackage

var version = "2.1.0"`;
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('mypackage');
          expect(result.value.version).toBe('2.1.0');
        }
      });

      it('should handle lowercase version variable', async () => {
        const versionGo = `package app

const version = "0.9.5"`;
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('0.9.5');
        }
      });
    });

    describe('version.txt', () => {
      it('should detect version from version.txt', async () => {
        await writeFile(join(tempDir, 'version.txt'), '1.0.0');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
          // Name should be directory name
          expect(result.value.name).toBeTruthy();
        }
      });

      it('should handle version.txt with newline', async () => {
        await writeFile(join(tempDir, 'version.txt'), '2.3.4\n');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.3.4');
        }
      });

      it('should handle pre-release in version.txt', async () => {
        await writeFile(join(tempDir, 'version.txt'), '3.0.0-rc.2');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('3.0.0-rc.2');
        }
      });

      it('should handle version.txt with v prefix', async () => {
        await writeFile(join(tempDir, 'version.txt'), 'v1.2.3\n');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.2.3');
        }
      });

      it('should detect version from VERSION.txt (uppercase)', async () => {
        await writeFile(join(tempDir, 'VERSION.txt'), '2.0.0\n');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0');
        }
      });
    });

    describe('priority order', () => {
      it('should prefer go.mod over version.go', async () => {
        const goMod = `module priority-test

// version: 5.0.0`;
        const versionGo = `package main

const Version = "1.0.0"`;

        await writeFile(join(tempDir, 'go.mod'), goMod);
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('priority-test');
          expect(result.value.version).toBe('5.0.0');
        }
      });

      it('should prefer version.go over version.txt', async () => {
        const versionGo = `package test

const Version = "2.5.0"`;
        await writeFile(join(tempDir, 'version.go'), versionGo);
        await writeFile(join(tempDir, 'version.txt'), '1.0.0');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('test');
          expect(result.value.version).toBe('2.5.0');
        }
      });

      it('should try all files if first ones are invalid', async () => {
        // Create invalid go.mod (no version comment)
        await writeFile(join(tempDir, 'go.mod'), 'module test\n\ngo 1.21');

        // Create valid version.txt
        await writeFile(join(tempDir, 'version.txt'), '1.0.0');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Go configuration file found');
        }
      });

      it('should return error for invalid version format in go.mod', async () => {
        const goMod = `module test

// version: not-a-version`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error when go.mod has no module name', async () => {
        const goMod = `// version: 1.0.0

go 1.21`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error for invalid version in version.go', async () => {
        const versionGo = `package main

const Version = "invalid"`;
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
      });
    });
  });

  describe('update', () => {
    describe('single file updates', () => {
      it('should update version in go.mod', async () => {
        const goMod = `module myproject

// version: 1.0.0

go 1.21`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify the file was updated
        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0');
        }
      });

      it('should update version in version.go', async () => {
        const versionGo = `package main

const Version = "1.0.0"`;
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.update(tempDir, toVersion('1.5.0'));

        expect(isOk(result)).toBe(true);

        // Verify the file was updated
        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('1.5.0');
        }
      });

      it('should update version in version.txt', async () => {
        await writeFile(join(tempDir, 'version.txt'), '1.0.0');

        const result = await adapter.update(tempDir, toVersion('1.1.0'));

        expect(isOk(result)).toBe(true);

        // Verify the file was updated
        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('1.1.0');
        }
      });
    });

    describe('multi-file updates', () => {
      it('should update all existing config files', async () => {
        const goMod = `module myproject

// version: 1.0.0`;
        const versionGo = `package main

const Version = "1.0.0"`;

        await writeFile(join(tempDir, 'go.mod'), goMod);
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify both files were updated
        const fs = await import('node:fs/promises');
        const modContent = await fs.readFile(join(tempDir, 'go.mod'), 'utf-8');
        const goContent = await fs.readFile(join(tempDir, 'version.go'), 'utf-8');

        expect(modContent).toContain('// version: 2.0.0');
        expect(goContent).toContain('const Version = "2.0.0"');
      });

      it('should update go.mod, version.go, and version.txt together', async () => {
        const goMod = `module test\n// version: 1.0.0`;
        const versionGo = `package main\nconst Version = "1.0.0"`;

        await writeFile(join(tempDir, 'go.mod'), goMod);
        await writeFile(join(tempDir, 'version.go'), versionGo);
        await writeFile(join(tempDir, 'version.txt'), '1.0.0');

        const result = await adapter.update(tempDir, toVersion('3.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify all files were updated
        const fs = await import('node:fs/promises');
        const modContent = await fs.readFile(join(tempDir, 'go.mod'), 'utf-8');
        const goContent = await fs.readFile(join(tempDir, 'version.go'), 'utf-8');
        const txtContent = await fs.readFile(join(tempDir, 'version.txt'), 'utf-8');

        expect(modContent).toContain('3.0.0');
        expect(goContent).toContain('3.0.0');
        expect(txtContent).toContain('3.0.0');
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Go configuration file found');
        }
      });

      it('should return error when version pattern does not match', async () => {
        // go.mod without version comment
        await writeFile(join(tempDir, 'go.mod'), 'module test\n\ngo 1.21');

        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isErr(result)).toBe(true);
      });
    });

    describe('version format preservation', () => {
      it('should handle pre-release versions', async () => {
        const goMod = `module test\n// version: 1.0.0`;
        await writeFile(join(tempDir, 'go.mod'), goMod);

        const result = await adapter.update(tempDir, toVersion('2.0.0-alpha.1'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0-alpha.1');
        }
      });

      it('should handle versions with build metadata', async () => {
        const versionGo = `package main\nconst Version = "1.0.0"`;
        await writeFile(join(tempDir, 'version.go'), versionGo);

        const result = await adapter.update(tempDir, toVersion('1.0.1+build.456'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('1.0.1+build.456');
        }
      });
    });
  });

  describe('integration tests', () => {
    it('should handle detect and update workflow', async () => {
      const goMod = `module github.com/user/project

go 1.21

// version: 1.0.0`;
      await writeFile(join(tempDir, 'go.mod'), goMod);

      // Detect initial version
      const detectResult1 = await adapter.detect(tempDir);
      expect(isOk(detectResult1)).toBe(true);
      if (isOk(detectResult1)) {
        expect(detectResult1.value.version).toBe('1.0.0');
      }

      // Update version
      const updateResult = await adapter.update(tempDir, toVersion('1.1.0'));
      expect(isOk(updateResult)).toBe(true);

      // Detect updated version
      const detectResult2 = await adapter.detect(tempDir);
      expect(isOk(detectResult2)).toBe(true);
      if (isOk(detectResult2)) {
        expect(detectResult2.value.version).toBe('1.1.0');
      }
    });

    it('should handle real-world Go project structure', async () => {
      // Create typical Go project structure
      const goMod = `module github.com/myorg/awesome-cli

go 1.21

// version: 0.1.0

require (
	github.com/spf13/cobra v1.7.0
	github.com/spf13/viper v1.16.0
)`;

      const versionGo = `package version

// Version is the current version of the application
const Version = "0.1.0"

// GetVersion returns the current version
func GetVersion() string {
	return Version
}`;

      await writeFile(join(tempDir, 'go.mod'), goMod);
      await writeFile(join(tempDir, 'version.go'), versionGo);

      // Detect
      const detectResult = await adapter.detect(tempDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('github.com/myorg/awesome-cli');
        expect(detectResult.value.version).toBe('0.1.0');
      }

      // Update
      const updateResult = await adapter.update(tempDir, toVersion('0.2.0'));
      expect(isOk(updateResult)).toBe(true);

      // Verify both files updated
      const fs = await import('node:fs/promises');
      const modContent = await fs.readFile(join(tempDir, 'go.mod'), 'utf-8');
      const goContent = await fs.readFile(join(tempDir, 'version.go'), 'utf-8');

      expect(modContent).toContain('0.2.0');
      expect(goContent).toContain('0.2.0');
    });
  });
});
