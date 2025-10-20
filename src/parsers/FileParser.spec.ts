/**
 * Tests for FileParser
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parseJsonFile,
  parseTomlFile,
  parseRegexFile,
  configParser,
  VERSION_PATTERNS,
  NAME_PATTERNS,
  type ParserConfig,
} from './FileParser.js';
import { isOk, isErr } from '../types/result.js';
import { toVersion } from '../types/version.js';

describe('FileParser', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileparser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parseJsonFile', () => {
    it('should parse simple package.json', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          name: 'my-package',
          version: '1.2.3',
        }),
      );

      const result = await parseJsonFile(filePath);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('my-package');
        expect(result.value.version).toBe('1.2.3');
      }
    });

    it('should parse nested version path', async () => {
      const filePath = path.join(tempDir, 'config.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          project: {
            name: 'nested-project',
            version: '2.0.0',
          },
        }),
      );

      const result = await parseJsonFile(filePath, 'project.version', 'project.name');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('nested-project');
        expect(result.value.version).toBe('2.0.0');
      }
    });

    it('should parse pre-release versions', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          name: 'beta-package',
          version: '1.0.0-beta.1',
        }),
      );

      const result = await parseJsonFile(filePath);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe('1.0.0-beta.1');
      }
    });

    it('should return error for missing version field', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          name: 'no-version',
        }),
      );

      const result = await parseJsonFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Version field');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error for missing name field', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          version: '1.0.0',
        }),
      );

      const result = await parseJsonFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Name field');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error for invalid version format', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          name: 'bad-version',
          version: 'not-a-version',
        }),
      );

      const result = await parseJsonFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid version format');
      }
    });

    it('should return error for malformed JSON', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(filePath, '{ invalid json }');

      const result = await parseJsonFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid JSON syntax');
      }
    });

    it('should return error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.json');

      const result = await parseJsonFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_OPERATION_FAILED');
      }
    });

    it('should handle deeply nested paths', async () => {
      const filePath = path.join(tempDir, 'deep.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          metadata: {
            project: {
              info: {
                name: 'deep-package',
                version: '3.0.0',
              },
            },
          },
        }),
      );

      const result = await parseJsonFile(filePath, 'metadata.project.info.version', 'metadata.project.info.name');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('deep-package');
        expect(result.value.version).toBe('3.0.0');
      }
    });
  });

  describe('parseTomlFile', () => {
    it('should parse Cargo.toml', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "my-rust-crate"
version = "0.1.0"
edition = "2021"
`,
      );

      const result = await parseTomlFile(filePath, 'package.version', 'package.name');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('my-rust-crate');
        expect(result.value.version).toBe('0.1.0');
      }
    });

    it('should parse pyproject.toml', async () => {
      const filePath = path.join(tempDir, 'pyproject.toml');
      await fs.writeFile(
        filePath,
        `[project]
name = "my-python-package"
version = "1.2.3"
`,
      );

      const result = await parseTomlFile(filePath, 'project.version', 'project.name');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('my-python-package');
        expect(result.value.version).toBe('1.2.3');
      }
    });

    it('should parse poetry.toml', async () => {
      const filePath = path.join(tempDir, 'poetry.toml');
      await fs.writeFile(
        filePath,
        `[tool.poetry]
name = "poetry-package"
version = "2.0.0-alpha.1"
`,
      );

      const result = await parseTomlFile(filePath, 'tool.poetry.version', 'tool.poetry.name');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('poetry-package');
        expect(result.value.version).toBe('2.0.0-alpha.1');
      }
    });

    it('should return error for missing version field', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "no-version"
`,
      );

      const result = await parseTomlFile(filePath, 'package.version', 'package.name');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Version field');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error for missing name field', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
version = "1.0.0"
`,
      );

      const result = await parseTomlFile(filePath, 'package.version', 'package.name');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Name field');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error for invalid version format', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "bad-version"
version = "invalid"
`,
      );

      const result = await parseTomlFile(filePath, 'package.version', 'package.name');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid version format');
      }
    });

    it('should return error for malformed TOML', async () => {
      const filePath = path.join(tempDir, 'bad.toml');
      await fs.writeFile(filePath, '[invalid toml syntax');

      const result = await parseTomlFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid TOML syntax');
      }
    });

    it('should return error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.toml');

      const result = await parseTomlFile(filePath);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_OPERATION_FAILED');
      }
    });
  });

  describe('parseRegexFile', () => {
    it('should parse Python setup.py', async () => {
      const filePath = path.join(tempDir, 'setup.py');
      await fs.writeFile(
        filePath,
        `from setuptools import setup

setup(
    name='my-python-package',
    version='1.2.3',
    description='A test package',
)
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_SETUP, NAME_PATTERNS.PYTHON_SETUP);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('my-python-package');
        expect(result.value.version).toBe('1.2.3');
      }
    });

    it('should parse Python __init__.py', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `"""My Package"""

__version__ = "2.0.0"
__author__ = "Test Author"
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_INIT, undefined, 'my-package');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('my-package');
        expect(result.value.version).toBe('2.0.0');
      }
    });

    it('should parse Python setup.cfg', async () => {
      const filePath = path.join(tempDir, 'setup.cfg');
      await fs.writeFile(
        filePath,
        `[metadata]
name = cfg-package
version = 3.0.0
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_SETUP_CFG, NAME_PATTERNS.PYTHON_SETUP_CFG);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('cfg-package');
        expect(result.value.version).toBe('3.0.0');
      }
    });

    it('should parse Go version comment', async () => {
      const filePath = path.join(tempDir, 'go.mod');
      await fs.writeFile(
        filePath,
        `module github.com/user/myproject

go 1.21

// version: 1.0.0
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.GO_VERSION_COMMENT, /^module\s+(.+)$/m);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('github.com/user/myproject');
        expect(result.value.version).toBe('1.0.0');
      }
    });

    it('should parse pre-release versions', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "1.0.0-beta.2"
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_INIT, undefined, 'test-package');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe('1.0.0-beta.2');
      }
    });

    it('should return error when version pattern does not match', async () => {
      const filePath = path.join(tempDir, 'setup.py');
      await fs.writeFile(
        filePath,
        `from setuptools import setup
setup(name='package')
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_SETUP, NAME_PATTERNS.PYTHON_SETUP);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Version pattern did not match');
      }
    });

    it('should return error when name pattern does not match and no default', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "1.0.0"
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_INIT, /name\s*=\s*['"]([^'"]+)['"]/);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Name pattern did not match and no default provided');
      }
    });

    it('should return error for invalid version format', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "not-a-version"
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_INIT, undefined, 'test');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid version format');
      }
    });

    it('should return error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.py');

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_INIT, undefined, 'test');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_OPERATION_FAILED');
      }
    });

    it('should use default name when name pattern is not provided', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "1.0.0"
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_INIT, undefined, 'default-name');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('default-name');
        expect(result.value.version).toBe('1.0.0');
      }
    });

    it('should handle single quotes in setup.py', async () => {
      const filePath = path.join(tempDir, 'setup.py');
      await fs.writeFile(
        filePath,
        `setup(
    name='single-quote-package',
    version='1.0.0',
)
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_SETUP, NAME_PATTERNS.PYTHON_SETUP);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('single-quote-package');
      }
    });

    it('should handle double quotes in setup.py', async () => {
      const filePath = path.join(tempDir, 'setup.py');
      await fs.writeFile(
        filePath,
        `setup(
    name="double-quote-package",
    version="1.0.0",
)
`,
      );

      const result = await parseRegexFile(filePath, VERSION_PATTERNS.PYTHON_SETUP, NAME_PATTERNS.PYTHON_SETUP);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('double-quote-package');
      }
    });
  });

  describe('configParser', () => {
    it('should delegate to parseJsonFile for JSON format', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          name: 'json-package',
          version: '1.0.0',
        }),
      );

      const config: ParserConfig = {
        format: 'json',
        versionPath: 'version',
        namePath: 'name',
      };

      const result = await configParser(filePath, config);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('json-package');
        expect(result.value.version).toBe('1.0.0');
      }
    });

    it('should delegate to parseTomlFile for TOML format', async () => {
      const filePath = path.join(tempDir, 'Cargo.toml');
      await fs.writeFile(
        filePath,
        `[package]
name = "toml-package"
version = "2.0.0"
`,
      );

      const config: ParserConfig = {
        format: 'toml',
        versionPath: 'package.version',
        namePath: 'package.name',
      };

      const result = await configParser(filePath, config);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('toml-package');
        expect(result.value.version).toBe('2.0.0');
      }
    });

    it('should delegate to parseRegexFile for regex format', async () => {
      const filePath = path.join(tempDir, '__init__.py');
      await fs.writeFile(
        filePath,
        `__version__ = "3.0.0"
`,
      );

      const config: ParserConfig = {
        format: 'regex',
        versionPattern: VERSION_PATTERNS.PYTHON_INIT,
      };

      const result = await configParser(filePath, config);

      expect(isErr(result)).toBe(true); // No name pattern, should fail
    });

    it('should return error for unsupported format', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      const config = {
        format: 'xml' as const,
      } as unknown as ParserConfig;

      const result = await configParser(filePath, config);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Unsupported format');
      }
    });

    it('should return error when versionPattern is missing for regex format', async () => {
      const filePath = path.join(tempDir, 'test.py');
      await fs.writeFile(filePath, '__version__ = "1.0.0"');

      const config: ParserConfig = {
        format: 'regex',
        // versionPattern is missing
      };

      const result = await configParser(filePath, config);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('versionPattern is required for regex format');
      }
    });

    it('should use default paths when not specified for JSON', async () => {
      const filePath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({
          name: 'default-paths',
          version: '1.0.0',
        }),
      );

      const config: ParserConfig = {
        format: 'json',
      };

      const result = await configParser(filePath, config);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('default-paths');
        expect(result.value.version).toBe('1.0.0');
      }
    });

    it('should use default paths when not specified for TOML', async () => {
      const filePath = path.join(tempDir, 'simple.toml');
      await fs.writeFile(
        filePath,
        `name = "simple"
version = "1.0.0"
`,
      );

      const config: ParserConfig = {
        format: 'toml',
      };

      const result = await configParser(filePath, config);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('simple');
        expect(result.value.version).toBe('1.0.0');
      }
    });
  });

  describe('VERSION_PATTERNS', () => {
    it('should export PYTHON_SETUP pattern', () => {
      expect(VERSION_PATTERNS.PYTHON_SETUP).toBeInstanceOf(RegExp);
    });

    it('should export PYTHON_INIT pattern', () => {
      expect(VERSION_PATTERNS.PYTHON_INIT).toBeInstanceOf(RegExp);
    });

    it('should export PYTHON_SETUP_CFG pattern', () => {
      expect(VERSION_PATTERNS.PYTHON_SETUP_CFG).toBeInstanceOf(RegExp);
    });

    it('should export GO_VERSION_COMMENT pattern', () => {
      expect(VERSION_PATTERNS.GO_VERSION_COMMENT).toBeInstanceOf(RegExp);
    });

    it('should export GENERIC pattern', () => {
      expect(VERSION_PATTERNS.GENERIC).toBeInstanceOf(RegExp);
    });
  });

  describe('NAME_PATTERNS', () => {
    it('should export PYTHON_SETUP pattern', () => {
      expect(NAME_PATTERNS.PYTHON_SETUP).toBeInstanceOf(RegExp);
    });

    it('should export PYTHON_SETUP_CFG pattern', () => {
      expect(NAME_PATTERNS.PYTHON_SETUP_CFG).toBeInstanceOf(RegExp);
    });
  });
});
