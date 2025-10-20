/**
 * Tests for NodeAdapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeAdapter } from './NodeAdapter.js';
import { isOk } from '../../types/result.js';
import { toVersion } from '../../types/version.js';
import { readFile } from 'node:fs/promises';

describe('NodeAdapter', () => {
  let tempDir: string;
  let adapter: NodeAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'node-adapter-test-'));
    adapter = new NodeAdapter();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('properties', () => {
    it('should have correct type', () => {
      expect(adapter.type).toBe('node');
    });

    it('should support package.json and jsr.json', () => {
      expect(adapter.supportedFiles).toEqual(['package.json', 'jsr.json']);
    });

    it('should have readonly supportedFiles', () => {
      expect(Array.isArray(adapter.supportedFiles)).toBe(true);
    });
  });

  describe('detect', () => {
    describe('package.json', () => {
      it('should detect version from package.json', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: '1.0.0',
            description: 'Test package',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-package');
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should detect pre-release version from package.json', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: '1.0.0-alpha.1',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0-alpha.1');
        }
      });

      it('should detect version with build metadata', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: '1.0.0+20231201',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0+20231201');
        }
      });
    });

    describe('jsr.json', () => {
      it('should detect version from jsr.json', async () => {
        await writeFile(
          join(tempDir, 'jsr.json'),
          JSON.stringify({
            name: '@scope/my-lib',
            version: '2.1.0',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('@scope/my-lib');
          expect(result.value.version).toBe('2.1.0');
        }
      });

      it('should prefer package.json over jsr.json', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'package-name',
            version: '1.0.0',
          }),
        );
        await writeFile(
          join(tempDir, 'jsr.json'),
          JSON.stringify({
            name: 'jsr-name',
            version: '2.0.0',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('package-name');
          expect(result.value.version).toBe('1.0.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('No Node.js configuration file found');
          expect(result.error.message).toContain('package.json');
          expect(result.error.message).toContain('jsr.json');
        }
      });

      it('should return error for malformed JSON', async () => {
        await writeFile(join(tempDir, 'package.json'), '{ invalid json }');

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('Failed to parse package.json');
        }
      });

      it('should return error when version is missing', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('Failed to parse package.json');
        }
      });

      it('should return error when name is missing', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            version: '1.0.0',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('Failed to parse package.json');
        }
      });

      it('should return error for invalid version format', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: 'not-a-version',
          }),
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('Failed to parse package.json');
        }
      });

      it('should return error for non-existent directory', async () => {
        const result = await adapter.detect('/non/existent/path');

        expect(isOk(result)).toBe(false);
      });
    });
  });

  describe('update', () => {
    describe('package.json', () => {
      it('should update version in package.json', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: '1.0.0',
            description: 'Test',
          }),
        );

        const result = await adapter.update(tempDir, toVersion('1.2.3'));

        expect(isOk(result)).toBe(true);

        const content = await readFile(join(tempDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(content);
        expect(pkg.version).toBe('1.2.3');
        expect(pkg.name).toBe('my-package');
        expect(pkg.description).toBe('Test');
      });

      it('should update to pre-release version', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: '1.0.0',
          }),
        );

        const result = await adapter.update(tempDir, toVersion('2.0.0-beta.1'));

        expect(isOk(result)).toBe(true);

        const content = await readFile(join(tempDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(content);
        expect(pkg.version).toBe('2.0.0-beta.1');
      });

      it('should preserve JSON formatting', async () => {
        const original = {
          name: 'my-package',
          version: '1.0.0',
          dependencies: {
            foo: '^1.0.0',
          },
        };
        await writeFile(join(tempDir, 'package.json'), JSON.stringify(original, null, 2));

        await adapter.update(tempDir, toVersion('1.0.1'));

        const content = await readFile(join(tempDir, 'package.json'), 'utf-8');
        expect(content).toContain('  "name"');
        expect(content).toContain('  "version"');
      });
    });

    describe('jsr.json', () => {
      it('should update version in jsr.json', async () => {
        await writeFile(
          join(tempDir, 'jsr.json'),
          JSON.stringify({
            name: '@scope/lib',
            version: '1.0.0',
          }),
        );

        const result = await adapter.update(tempDir, toVersion('1.1.0'));

        expect(isOk(result)).toBe(true);

        const content = await readFile(join(tempDir, 'jsr.json'), 'utf-8');
        const pkg = JSON.parse(content);
        expect(pkg.version).toBe('1.1.0');
        expect(pkg.name).toBe('@scope/lib');
      });
    });

    describe('multiple files', () => {
      it('should update both package.json and jsr.json if both exist', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
            version: '1.0.0',
          }),
        );
        await writeFile(
          join(tempDir, 'jsr.json'),
          JSON.stringify({
            name: '@scope/my-package',
            version: '1.0.0',
          }),
        );

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        const pkgContent = await readFile(join(tempDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        expect(pkg.version).toBe('2.0.0');

        const jsrContent = await readFile(join(tempDir, 'jsr.json'), 'utf-8');
        const jsr = JSON.parse(jsrContent);
        expect(jsr.version).toBe('2.0.0');
      });
    });

    describe('error handling', () => {
      it('should return error when no config file exists', async () => {
        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('No Node.js configuration file found');
        }
      });

      it('should return error for malformed JSON', async () => {
        await writeFile(join(tempDir, 'package.json'), '{ invalid json }');

        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('Failed to update package.json');
        }
      });

      it('should return error when version field is missing', async () => {
        await writeFile(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'my-package',
          }),
        );

        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('Failed to update package.json');
        }
      });

      it('should return error for non-existent directory', async () => {
        const result = await adapter.update('/non/existent/path', toVersion('1.0.0'));

        expect(isOk(result)).toBe(false);
      });
    });
  });

  describe('integration', () => {
    it('should work with real package.json from fixture', async () => {
      // Create a realistic package.json
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: '@acme/my-lib',
            version: '0.1.0',
            description: 'A sample library',
            main: 'dist/index.js',
            types: 'dist/index.d.ts',
            scripts: {
              build: 'tsc',
              test: 'vitest',
            },
            keywords: ['test', 'sample'],
            author: 'Test Author',
            license: 'MIT',
            dependencies: {
              lodash: '^4.17.21',
            },
            devDependencies: {
              typescript: '^5.0.0',
              vitest: '^1.0.0',
            },
          },
          null,
          2,
        ),
      );

      // Detect
      const detectResult = await adapter.detect(tempDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('@acme/my-lib');
        expect(detectResult.value.version).toBe('0.1.0');
      }

      // Update
      const updateResult = await adapter.update(tempDir, toVersion('0.2.0'));
      expect(isOk(updateResult)).toBe(true);

      // Verify update
      const content = await readFile(join(tempDir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.version).toBe('0.2.0');
      expect(pkg.name).toBe('@acme/my-lib');
      expect(pkg.dependencies.lodash).toBe('^4.17.21');
    });

    it('should work with monorepo workspace package', async () => {
      // Create packages directory
      const pkgDir = join(tempDir, 'packages', 'lib-a');
      await mkdir(pkgDir, { recursive: true });

      await writeFile(
        join(pkgDir, 'package.json'),
        JSON.stringify({
          name: '@monorepo/lib-a',
          version: '1.0.0',
          private: true,
        }),
      );

      const detectResult = await adapter.detect(pkgDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('@monorepo/lib-a');
        expect(detectResult.value.version).toBe('1.0.0');
      }
    });
  });
});
