/**
 * Tests for FileUpdater
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { updateJsonFile, updateTomlFile, updateRegexFile, configUpdater, type UpdaterConfig } from './FileUpdater.js';
import { isOk, isErr } from '../types/result.js';
import { toVersion } from '../types/version.js';

describe('FileUpdater', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileupdater-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('updateJsonFile', () => {
    it('should update version in simple package.json', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'my-package',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('2.0.0'));

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.version).toBe('2.0.0');
      expect(data.name).toBe('my-package');
    });

    it('should update nested version path', async () => {
      const filePath = path.join(tempDir, 'config.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            project: {
              name: 'nested-project',
              version: '1.0.0',
            },
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('3.0.0'), 'project.version');

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.project.version).toBe('3.0.0');
      expect(data.project.name).toBe('nested-project');
    });

    it('should update pre-release versions', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'beta-package',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('1.0.0-beta.1'));

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.version).toBe('1.0.0-beta.1');
    });

    it('should return error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.json');

      const result = await updateJsonFile(filePath, toVersion('2.0.0'));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_OPERATION_FAILED');
      }
    });

    it('should return error for file without version', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'no-version',
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('2.0.0'));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error for malformed JSON', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(filePath, '{ invalid json }');

      const result = await updateJsonFile(filePath, toVersion('2.0.0'));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid JSON syntax');
      }
    });

    it('should handle deeply nested paths', async () => {
      const filePath = path.join(tempDir, 'deep.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            metadata: {
              project: {
                info: {
                  name: 'deep-package',
                  version: '1.0.0',
                },
              },
            },
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('4.0.0'), 'metadata.project.info.version');

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.metadata.project.info.version).toBe('4.0.0');
    });

    it('should preserve JSON formatting with 2-space indent', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'formatted-package',
            version: '1.0.0',
            scripts: {
              test: 'vitest',
            },
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('2.0.0'));

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('  "name"');
      expect(content).toContain('  "version"');
    });
  });

  describe('updateTomlFile', () => {
    it('should update version in Cargo.toml', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "my-rust-crate"
version = "0.1.0"
edition = "2021"
`,
      );

      const result = await updateTomlFile(filePath, toVersion('0.2.0'), 'package.version');

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('version = "0.2.0"');
    });

    it('should update version in pyproject.toml', async () => {
      const filePath = path.join(tempDir, 'pyproject.toml');
      await fs.writeFile(
        filePath,
        `[project]
name = "my-python-package"
version = "1.0.0"
`,
      );

      const result = await updateTomlFile(filePath, toVersion('1.1.0'), 'project.version');

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('version = "1.1.0"');
    });

    it('should update version in poetry.toml', async () => {
      const filePath = path.join(tempDir, 'poetry.toml');
      await fs.writeFile(
        filePath,
        `[tool.poetry]
name = "poetry-package"
version = "2.0.0"
`,
      );

      const result = await updateTomlFile(filePath, toVersion('2.1.0'), 'tool.poetry.version');

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('version = "2.1.0"');
    });

    it('should return error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.toml');

      const result = await updateTomlFile(filePath, toVersion('2.0.0'));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_OPERATION_FAILED');
      }
    });

    it('should return error for file without version', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "no-version"
`,
      );

      const result = await updateTomlFile(filePath, toVersion('2.0.0'), 'package.version');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error for malformed TOML', async () => {
      const filePath = path.join(tempDir, 'bad.toml');
      await fs.writeFile(filePath, '[invalid toml syntax');

      const result = await updateTomlFile(filePath, toVersion('2.0.0'));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid TOML syntax');
      }
    });
  });

  describe('updateRegexFile', () => {
    it('should update version in Python setup.py', async () => {
      const filePath = path.join(tempDir, 'setup.py');
      await fs.writeFile(
        filePath,
        `from setuptools import setup

setup(
    name='my-python-package',
    version='1.0.0',
    description='A test package',
)
`,
      );

      const result = await updateRegexFile(
        filePath,
        toVersion('1.1.0'),
        /version\s*=\s*['"]([^'"]+)['"]/,
        `version='$VERSION'`,
      );

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`version='1.1.0'`);
      expect(content).toContain(`name='my-python-package'`);
    });

    it('should update version in Python __init__.py', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `"""My Package"""

__version__ = "1.0.0"
__author__ = "Test Author"
`,
      );

      const result = await updateRegexFile(
        filePath,
        toVersion('2.0.0'),
        /__version__\s*=\s*['"]([^'"]+)['"]/,
        `__version__ = "$VERSION"`,
      );

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`__version__ = "2.0.0"`);
    });

    it('should update Go version comment', async () => {
      const filePath = path.join(tempDir, 'go.mod');
      await fs.writeFile(
        filePath,
        `module github.com/user/myproject

go 1.21

// version: 1.0.0
`,
      );

      const result = await updateRegexFile(
        filePath,
        toVersion('1.1.0'),
        /\/\/\s*version:\s*(.+)$/m,
        `// version: $VERSION`,
      );

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`// version: 1.1.0`);
    });

    it('should update pre-release versions', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "1.0.0"
`,
      );

      const result = await updateRegexFile(
        filePath,
        toVersion('1.0.0-beta.1'),
        /__version__\s*=\s*['"]([^'"]+)['"]/,
        `__version__ = "$VERSION"`,
      );

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`__version__ = "1.0.0-beta.1"`);
    });

    it('should return error when pattern does not match', async () => {
      const filePath = path.join(tempDir, 'setup.py');
      await fs.writeFile(
        filePath,
        `from setuptools import setup
setup(name='package')
`,
      );

      const result = await updateRegexFile(
        filePath,
        toVersion('2.0.0'),
        /version\s*=\s*['"]([^'"]+)['"]/,
        `version='$VERSION'`,
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('valid existing version');
      }
    });

    it('should return error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.py');

      const result = await updateRegexFile(
        filePath,
        toVersion('2.0.0'),
        /__version__\s*=\s*['"]([^'"]+)['"]/,
        `__version__ = "$VERSION"`,
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_OPERATION_FAILED');
      }
    });

    it('should handle multiple $VERSION placeholders', async () => {
      const filePath = path.join(tempDir, 'version.txt');
      await fs.writeFile(
        filePath,
        `Version: 1.0.0
Release: 1.0.0
`,
      );

      const result = await updateRegexFile(
        filePath,
        toVersion('2.0.0'),
        /Version:\s*(\d+\.\d+\.\d+)/,
        `Version: $VERSION`,
      );

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`Version: 2.0.0`);
    });
  });

  describe('configUpdater', () => {
    it('should delegate to updateJsonFile for JSON format', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'json-package',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const config: UpdaterConfig = {
        format: 'json',
        versionPath: 'version',
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.version).toBe('2.0.0');
    });

    it('should delegate to updateTomlFile for TOML format', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "toml-package"
version = "1.0.0"
`,
      );

      const config: UpdaterConfig = {
        format: 'toml',
        versionPath: 'package.version',
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });

    it('should delegate to updateRegexFile for regex format', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "1.0.0"
`,
      );

      const config: UpdaterConfig = {
        format: 'regex',
        versionPattern: /__version__\s*=\s*['"]([^'"]+)['"]/,
        versionReplacement: `__version__ = "$VERSION"`,
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain(`__version__ = "2.0.0"`);
    });

    it('should return error for unsupported format', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      const config = {
        format: 'xml' as const,
      } as unknown as UpdaterConfig;

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Unsupported format');
      }
    });

    it('should return error when versionPattern is missing for regex format', async () => {
      const filePath = path.join(tempDir, 'test.py');
      await fs.writeFile(filePath, '__version__ = "1.0.0"');

      const config: UpdaterConfig = {
        format: 'regex',
        // versionPattern is missing
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('versionPattern and versionReplacement are required');
      }
    });

    it('should return error when versionReplacement is missing for regex format', async () => {
      const filePath = path.join(tempDir, 'test.py');
      await fs.writeFile(filePath, '__version__ = "1.0.0"');

      const config: UpdaterConfig = {
        format: 'regex',
        versionPattern: /__version__\s*=\s*['"]([^'"]+)['"]/,
        // versionReplacement is missing
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('versionPattern and versionReplacement are required');
      }
    });

    it('should use default version path for JSON when not specified', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'default-paths',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const config: UpdaterConfig = {
        format: 'json',
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.version).toBe('2.0.0');
    });

    it('should use default version path for TOML when not specified', async () => {
      const filePath = path.join(tempDir, 'simple.toml');
      await fs.writeFile(
        filePath,
        `name = "simple"
version = "1.0.0"
`,
      );

      const config: UpdaterConfig = {
        format: 'toml',
      };

      const result = await configUpdater(filePath, toVersion('2.0.0'), config);

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });
  });

  describe('rollback scenarios', () => {
    it('should not modify file if update fails', async () => {
      const filePath = path.join(tempDir, 'package.json');
      const originalContent = JSON.stringify(
        {
          name: 'rollback-package',
          version: '1.0.0',
        },
        null,
        2,
      );
      await fs.writeFile(filePath, originalContent);

      // Try to update with invalid nested path
      const result = await updateJsonFile(filePath, toVersion('2.0.0'), 'nonexistent.path.version');

      expect(isErr(result)).toBe(true);

      // File should remain unchanged
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.version).toBe('1.0.0');
    });

    it('should not create file if it does not exist', async () => {
      const filePath = path.join(tempDir, 'nonexistent.json');

      const result = await updateJsonFile(filePath, toVersion('2.0.0'));

      expect(isErr(result)).toBe(true);

      // File should not be created
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty version path for JSON', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'test',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('2.0.0'), '');

      expect(isErr(result)).toBe(true);
    });

    it('should handle version path with only dots', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'test',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('2.0.0'), '...');

      expect(isErr(result)).toBe(true);
    });

    it('should update complex version strings', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            name: 'test',
            version: '1.0.0',
          },
          null,
          2,
        ),
      );

      const result = await updateJsonFile(filePath, toVersion('1.0.0-beta.1+build.123'));

      expect(isOk(result)).toBe(true);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.version).toBe('1.0.0-beta.1+build.123');
    });
  });
});
