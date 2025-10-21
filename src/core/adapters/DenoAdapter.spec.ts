/**
 * Tests for DenoAdapter
 */

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DenoAdapter } from './DenoAdapter.js';
import { isOk, isErr } from '../../types/result.js';
import { toVersion } from '../../types/version.js';

describe('DenoAdapter', () => {
  let adapter: DenoAdapter;
  let tempDir: string;

  beforeEach(async () => {
    adapter = new DenoAdapter();
    tempDir = await mkdtemp(join(tmpdir(), 'deno-adapter-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('properties', () => {
    it('should have correct workspace type', () => {
      expect(adapter.type).toBe('deno');
    });

    it('should have correct supported files', () => {
      expect(adapter.supportedFiles).toEqual(['deno.jsonc', 'deno.json', 'jsr.json']);
    });
  });

  describe('detect', () => {
    describe('deno.json', () => {
      it('should detect version from deno.json', async () => {
        const denoJson = {
          name: 'my-deno-app',
          version: '1.2.3',
          exports: './mod.ts',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-deno-app');
          expect(result.value.version).toBe('1.2.3');
        }
      });

      it('should detect pre-release version', async () => {
        const denoJson = {
          name: 'test-app',
          version: '2.0.0-beta.1',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0-beta.1');
        }
      });

      it('should detect version with build metadata', async () => {
        const denoJson = {
          name: 'test-app',
          version: '1.0.0+build.123',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0+build.123');
        }
      });
    });

    describe('deno.jsonc', () => {
      it('should detect version from deno.jsonc with comments', async () => {
        const denoJsonc = `{
  // Deno configuration with comments
  "name": "deno-lib",
  "version": "0.5.0", // Current version
  "exports": "./mod.ts"
}`;
        await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('deno-lib');
          expect(result.value.version).toBe('0.5.0');
        }
      });

      it('should handle block comments in deno.jsonc', async () => {
        const denoJsonc = `{
  /*
   * Multi-line comment
   */
  "name": "deno-app",
  "version": "1.0.0"
}`;
        await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('deno-app');
          expect(result.value.version).toBe('1.0.0');
        }
      });
    });

    describe('jsr.json', () => {
      it('should detect version from jsr.json', async () => {
        const jsrJson = {
          name: '@scope/package',
          version: '3.1.4',
          exports: './mod.ts',
        };
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('@scope/package');
          expect(result.value.version).toBe('3.1.4');
        }
      });
    });

    describe('priority order', () => {
      it('should prefer deno.jsonc over deno.json', async () => {
        const denoJsonc = `{
  "name": "from-jsonc",
  "version": "2.0.0"
}`;
        const denoJson = {
          name: 'from-json',
          version: '1.0.0',
        };

        await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('from-jsonc');
          expect(result.value.version).toBe('2.0.0');
        }
      });

      it('should prefer deno.json over jsr.json', async () => {
        const denoJson = {
          name: 'from-deno',
          version: '3.0.0',
        };
        const jsrJson = {
          name: 'from-jsr',
          version: '2.0.0',
        };

        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('from-deno');
          expect(result.value.version).toBe('3.0.0');
        }
      });

      it('should prefer deno.jsonc over jsr.json', async () => {
        const denoJsonc = `{
  "name": "from-jsonc",
  "version": "4.0.0"
}`;
        const jsrJson = {
          name: 'from-jsr',
          version: '1.0.0',
        };

        await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('from-jsonc');
          expect(result.value.version).toBe('4.0.0');
        }
      });

      it('should try all files if first ones are invalid', async () => {
        // Create invalid deno.jsonc
        await writeFile(join(tempDir, 'deno.jsonc'), '{ invalid json }');

        // Create valid jsr.json
        const jsrJson = {
          name: 'valid-jsr',
          version: '1.0.0',
        };
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('valid-jsr');
          expect(result.value.version).toBe('1.0.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Deno configuration file found');
        }
      });

      it('should return error for malformed JSON in deno.json', async () => {
        await writeFile(join(tempDir, 'deno.json'), '{ invalid json }');

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Deno configuration file found');
        }
      });

      it('should return error when version is missing', async () => {
        const denoJson = {
          name: 'test-app',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error when name is missing', async () => {
        const denoJson = {
          version: '1.0.0',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
      });

      it('should return error for invalid version format', async () => {
        const denoJson = {
          name: 'test-app',
          version: 'not-a-version',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.detect(tempDir);

        expect(isErr(result)).toBe(true);
      });
    });
  });

  describe('update', () => {
    describe('single file updates', () => {
      it('should update version in deno.json', async () => {
        const denoJson = {
          name: 'my-deno-app',
          version: '1.0.0',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify the file was updated
        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0');
        }
      });

      it('should update version in deno.jsonc', async () => {
        const denoJsonc = `{
  // Configuration
  "name": "deno-lib",
  "version": "0.5.0"
}`;
        await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);

        const result = await adapter.update(tempDir, toVersion('0.6.0'));

        expect(isOk(result)).toBe(true);

        // Verify the file was updated
        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('0.6.0');
        }
      });

      it('should update version in jsr.json', async () => {
        const jsrJson = {
          name: '@scope/package',
          version: '3.0.0',
        };
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.update(tempDir, toVersion('3.1.0'));

        expect(isOk(result)).toBe(true);

        // Verify the file was updated
        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('3.1.0');
        }
      });

      it('should preserve JSON formatting', async () => {
        const denoJson = {
          name: 'test-app',
          version: '1.0.0',
          exports: './mod.ts',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        await adapter.update(tempDir, toVersion('1.1.0'));

        // Read the file and verify formatting
        const fs = await import('node:fs/promises');
        const content = await fs.readFile(join(tempDir, 'deno.json'), 'utf-8');

        expect(content).toContain('"name": "test-app"');
        expect(content).toContain('"version": "1.1.0"');
        expect(content).toContain('"exports": "./mod.ts"');
        expect(content.endsWith('\n')).toBe(true);
      });
    });

    describe('multi-file updates', () => {
      it('should update all existing config files', async () => {
        const denoJson = {
          name: 'multi-config',
          version: '1.0.0',
        };
        const jsrJson = {
          name: '@scope/multi-config',
          version: '1.0.0',
        };

        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify both files were updated
        const fs = await import('node:fs/promises');
        const denoContent = await fs.readFile(join(tempDir, 'deno.json'), 'utf-8');
        const jsrContent = await fs.readFile(join(tempDir, 'jsr.json'), 'utf-8');

        expect(denoContent).toContain('"version": "2.0.0"');
        expect(jsrContent).toContain('"version": "2.0.0"');
      });

      it('should update deno.jsonc and jsr.json together', async () => {
        const denoJsonc = `{
  "name": "deno-lib",
  "version": "1.0.0"
}`;
        const jsrJson = {
          name: '@scope/deno-lib',
          version: '1.0.0',
        };

        await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);
        await writeFile(join(tempDir, 'jsr.json'), JSON.stringify(jsrJson, null, 2));

        const result = await adapter.update(tempDir, toVersion('1.5.0'));

        expect(isOk(result)).toBe(true);

        // Verify both files were updated
        const fs = await import('node:fs/promises');
        const jsoncContent = await fs.readFile(join(tempDir, 'deno.jsonc'), 'utf-8');
        const jsrContent = await fs.readFile(join(tempDir, 'jsr.json'), 'utf-8');

        expect(jsoncContent).toContain('"version": "1.5.0"');
        expect(jsrContent).toContain('"version": "1.5.0"');
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('No Deno configuration file found');
        }
      });

      it('should return error for malformed JSON', async () => {
        await writeFile(join(tempDir, 'deno.json'), '{ invalid json }');

        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Failed to update deno.json');
        }
      });

      it('should return error when version is missing', async () => {
        const denoJson = {
          name: 'test-app',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isErr(result)).toBe(true);
      });
    });

    describe('version format preservation', () => {
      it('should handle pre-release versions', async () => {
        const denoJson = {
          name: 'test-app',
          version: '1.0.0',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

        const result = await adapter.update(tempDir, toVersion('2.0.0-alpha.1'));

        expect(isOk(result)).toBe(true);

        const detectResult = await adapter.detect(tempDir);
        expect(isOk(detectResult)).toBe(true);
        if (isOk(detectResult)) {
          expect(detectResult.value.version).toBe('2.0.0-alpha.1');
        }
      });

      it('should handle versions with build metadata', async () => {
        const denoJson = {
          name: 'test-app',
          version: '1.0.0',
        };
        await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

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
      const denoJson = {
        name: 'workflow-test',
        version: '1.0.0',
        exports: './mod.ts',
      };
      await writeFile(join(tempDir, 'deno.json'), JSON.stringify(denoJson, null, 2));

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

    it('should handle real-world Deno project structure', async () => {
      // Create typical Deno project structure
      await mkdir(join(tempDir, 'src'), { recursive: true });

      const denoJsonc = `{
  // Deno configuration
  "name": "@myorg/awesome-lib",
  "version": "0.1.0",
  "exports": "./mod.ts",
  "tasks": {
    "test": "deno test"
  },
  "imports": {
    "std/": "https://deno.land/std@0.200.0/"
  }
}`;

      await writeFile(join(tempDir, 'deno.jsonc'), denoJsonc);
      await writeFile(join(tempDir, 'mod.ts'), 'export const version = "0.1.0";');
      await writeFile(join(tempDir, 'src', 'lib.ts'), 'export function hello() { return "world"; }');

      // Detect
      const detectResult = await adapter.detect(tempDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('@myorg/awesome-lib');
        expect(detectResult.value.version).toBe('0.1.0');
      }

      // Update
      const updateResult = await adapter.update(tempDir, toVersion('0.2.0'));
      expect(isOk(updateResult)).toBe(true);

      // Verify
      const detectResult2 = await adapter.detect(tempDir);
      expect(isOk(detectResult2)).toBe(true);
      if (isOk(detectResult2)) {
        expect(detectResult2.value.version).toBe('0.2.0');
      }
    });
  });
});
