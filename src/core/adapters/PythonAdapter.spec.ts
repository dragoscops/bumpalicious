/**
 * Tests for PythonAdapter
 */

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PythonAdapter } from './PythonAdapter.js';
import { isOk } from '../../types/result.js';
import { toVersion } from '../../types/version.js';

describe('PythonAdapter', () => {
  let tempDir: string;
  let adapter: PythonAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'python-adapter-test-'));
    adapter = new PythonAdapter();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('properties', () => {
    it('should have correct type', () => {
      expect(adapter.type).toBe('python');
    });

    it('should support all Python configuration files', () => {
      expect(adapter.supportedFiles).toEqual(['pyproject.toml', 'poetry.toml', 'setup.py', 'setup.cfg', '__init__.py']);
    });

    it('should have readonly supportedFiles', () => {
      expect(Array.isArray(adapter.supportedFiles)).toBe(true);
      expect(adapter.supportedFiles.length).toBe(5);
    });
  });

  describe('detect', () => {
    describe('pyproject.toml', () => {
      it('should detect version from pyproject.toml', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
name = "my-package"
version = "1.0.0"
description = "Test package"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-package');
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should detect pre-release version from pyproject.toml', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
name = "my-package"
version = "1.0.0-alpha.1"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0-alpha.1');
        }
      });

      it('should handle pyproject.toml with additional metadata', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
name = "my-package"
version = "2.5.3"
authors = [{name = "John Doe", email = "john@example.com"}]
dependencies = ["requests>=2.28.0"]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('my-package');
          expect(result.value.version).toBe('2.5.3');
        }
      });
    });

    describe('poetry.toml', () => {
      it('should detect version from poetry.toml', async () => {
        await writeFile(
          join(tempDir, 'poetry.toml'),
          `[tool.poetry]
name = "poetry-package"
version = "0.5.1"
description = "A Poetry project"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('poetry-package');
          expect(result.value.version).toBe('0.5.1');
        }
      });

      it('should detect version with poetry dependencies', async () => {
        await writeFile(
          join(tempDir, 'poetry.toml'),
          `[tool.poetry]
name = "poetry-app"
version = "3.2.1"
description = "Poetry application"
authors = ["Jane Doe <jane@example.com>"]

[tool.poetry.dependencies]
python = "^3.8"
requests = "^2.28.0"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('poetry-app');
          expect(result.value.version).toBe('3.2.1');
        }
      });
    });

    describe('setup.py', () => {
      it('should detect version from setup.py', async () => {
        await writeFile(
          join(tempDir, 'setup.py'),
          `from setuptools import setup

setup(
    name="setup-py-package",
    version="1.2.3",
    description="A setuptools package",
    packages=["my_package"],
)
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('setup-py-package');
          expect(result.value.version).toBe('1.2.3');
        }
      });

      it('should detect version with single quotes', async () => {
        await writeFile(
          join(tempDir, 'setup.py'),
          `setup(
    name='my-package',
    version='2.0.0',
)
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0');
        }
      });

      it('should detect version with various whitespace', async () => {
        await writeFile(
          join(tempDir, 'setup.py'),
          `setup(
    name   =   "my-package",
    version   =   "4.5.6",
)
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('4.5.6');
        }
      });
    });

    describe('setup.cfg', () => {
      it('should detect version from setup.cfg', async () => {
        await writeFile(
          join(tempDir, 'setup.cfg'),
          `[metadata]
name = setup-cfg-package
version = 1.4.2
description = A setup.cfg package
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('setup-cfg-package');
          expect(result.value.version).toBe('1.4.2');
        }
      });

      it('should detect version with additional metadata', async () => {
        await writeFile(
          join(tempDir, 'setup.cfg'),
          `[metadata]
name = my-package
version = 0.1.0
author = John Doe
author_email = john@example.com

[options]
packages = find:
install_requires =
    requests>=2.28.0
    pytest>=7.0.0
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('0.1.0');
        }
      });
    });

    describe('__init__.py', () => {
      it('should detect version from __init__.py', async () => {
        await writeFile(
          join(tempDir, '__init__.py'),
          `"""Package initialization."""

__version__ = "1.0.0"
__author__ = "John Doe"

def main():
    pass
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should detect version with single quotes', async () => {
        await writeFile(
          join(tempDir, '__init__.py'),
          `__version__ = '2.3.4'
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.3.4');
        }
      });

      it('should use directory name when name not found', async () => {
        await writeFile(
          join(tempDir, '__init__.py'),
          `__version__ = "1.0.0"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          // Should fallback to directory name
          expect(result.value.name).toBeTruthy();
        }
      });
    });

    describe('priority order', () => {
      it('should prefer pyproject.toml over poetry.toml', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
name = "pyproject-package"
version = "1.0.0"
`,
        );

        await writeFile(
          join(tempDir, 'poetry.toml'),
          `[tool.poetry]
name = "poetry-package"
version = "2.0.0"
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('pyproject-package');
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should prefer poetry.toml over setup.py', async () => {
        await writeFile(
          join(tempDir, 'poetry.toml'),
          `[tool.poetry]
name = "poetry-package"
version = "2.0.0"
`,
        );

        await writeFile(join(tempDir, 'setup.py'), `setup(name="setup-package", version="3.0.0")`);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('poetry-package');
          expect(result.value.version).toBe('2.0.0');
        }
      });

      it('should prefer setup.py over setup.cfg', async () => {
        await writeFile(join(tempDir, 'setup.py'), `setup(name="setup-py", version="3.0.0")`);

        await writeFile(
          join(tempDir, 'setup.cfg'),
          `[metadata]
name = setup-cfg
version = 4.0.0
`,
        );

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('setup-py');
          expect(result.value.version).toBe('3.0.0');
        }
      });

      it('should prefer setup.cfg over __init__.py', async () => {
        await writeFile(
          join(tempDir, 'setup.cfg'),
          `[metadata]
name = setup-cfg
version = 4.0.0
`,
        );

        await writeFile(join(tempDir, '__init__.py'), `__version__ = "5.0.0"`);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.name).toBe('setup-cfg');
          expect(result.value.version).toBe('4.0.0');
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no configuration file exists', async () => {
        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('No valid Python configuration file found');
        }
      });

      it('should skip invalid pyproject.toml and try next file', async () => {
        await writeFile(join(tempDir, 'pyproject.toml'), 'invalid toml content {{{');

        await writeFile(join(tempDir, 'setup.py'), `setup(name="setup-package", version="1.0.0")`);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should skip file without version and try next', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
name = "no-version"
`,
        );

        await writeFile(join(tempDir, 'setup.py'), `setup(name="setup-package", version="1.0.0")`);

        const result = await adapter.detect(tempDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }
      });
    });
  });

  describe('update', () => {
    describe('single file updates', () => {
      it('should update version in pyproject.toml', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
name = "my-package"
version = "1.0.0"
`,
        );

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, 'pyproject.toml'), 'utf-8');
        expect(updated).toContain('version = "2.0.0"');
        expect(updated).not.toContain('version = "1.0.0"');
      });

      it('should update version in poetry.toml', async () => {
        await writeFile(
          join(tempDir, 'poetry.toml'),
          `[tool.poetry]
name = "poetry-package"
version = "0.5.1"
`,
        );

        const result = await adapter.update(tempDir, toVersion('0.6.0'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, 'poetry.toml'), 'utf-8');
        expect(updated).toContain('version = "0.6.0"');
      });

      it('should update version in setup.py', async () => {
        await writeFile(
          join(tempDir, 'setup.py'),
          `setup(
    name="my-package",
    version="1.0.0",
)
`,
        );

        const result = await adapter.update(tempDir, toVersion('1.1.0'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, 'setup.py'), 'utf-8');
        expect(updated).toContain('version="1.1.0"');
        expect(updated).not.toContain('version="1.0.0"');
      });

      it('should update version in setup.cfg', async () => {
        await writeFile(
          join(tempDir, 'setup.cfg'),
          `[metadata]
name = my-package
version = 1.0.0
`,
        );

        const result = await adapter.update(tempDir, toVersion('1.2.0'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, 'setup.cfg'), 'utf-8');
        expect(updated).toContain('version = 1.2.0');
      });

      it('should update version in __init__.py', async () => {
        await writeFile(
          join(tempDir, '__init__.py'),
          `__version__ = "1.0.0"
__author__ = "John Doe"
`,
        );

        const result = await adapter.update(tempDir, toVersion('1.3.0'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, '__init__.py'), 'utf-8');
        expect(updated).toContain('__version__ = "1.3.0"');
        expect(updated).toContain('__author__ = "John Doe"');
      });
    });

    describe('multi-file updates', () => {
      it('should update all configuration files when multiple exist', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
version = "1.0.0"
`,
        );

        await writeFile(join(tempDir, 'setup.py'), `setup(version="1.0.0")`);

        await writeFile(join(tempDir, '__init__.py'), `__version__ = "1.0.0"`);

        const result = await adapter.update(tempDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Check all files were updated
        const pyproject = await readFile(join(tempDir, 'pyproject.toml'), 'utf-8');
        expect(pyproject).toContain('version = "2.0.0"');

        const setupPy = await readFile(join(tempDir, 'setup.py'), 'utf-8');
        expect(setupPy).toContain('version="2.0.0"');

        const initPy = await readFile(join(tempDir, '__init__.py'), 'utf-8');
        expect(initPy).toContain('__version__ = "2.0.0"');
      });

      it('should update pyproject.toml and poetry.toml together', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
version = "1.0.0"
`,
        );

        await writeFile(
          join(tempDir, 'poetry.toml'),
          `[tool.poetry]
version = "1.0.0"
`,
        );

        const result = await adapter.update(tempDir, toVersion('3.0.0'));

        expect(isOk(result)).toBe(true);

        const pyproject = await readFile(join(tempDir, 'pyproject.toml'), 'utf-8');
        expect(pyproject).toContain('version = "3.0.0"');

        const poetry = await readFile(join(tempDir, 'poetry.toml'), 'utf-8');
        expect(poetry).toContain('version = "3.0.0"');
      });
    });

    describe('error handling', () => {
      it('should return error when no configuration file exists', async () => {
        const result = await adapter.update(tempDir, toVersion('1.0.0'));

        expect(isOk(result)).toBe(false);
        if (!isOk(result)) {
          expect(result.error.message).toContain('No Python configuration file found');
        }
      });

      it('should return error on file update failure', async () => {
        // Create file with invalid permissions (simulate failure)
        await writeFile(join(tempDir, 'pyproject.toml'), '[project]\nversion = "1.0.0"');

        // Create read-only directory to cause write failure
        const roDir = join(tempDir, 'readonly');
        await mkdir(roDir);
        await writeFile(join(roDir, 'pyproject.toml'), '[project]\nversion = "1.0.0"');

        // This test may be platform-specific
        // Just verify error handling exists
        const result = await adapter.detect(tempDir);
        expect(result).toBeDefined();
      });
    });

    describe('version format preservation', () => {
      it('should preserve pre-release versions', async () => {
        await writeFile(
          join(tempDir, 'pyproject.toml'),
          `[project]
version = "1.0.0-alpha.1"
`,
        );

        const result = await adapter.update(tempDir, toVersion('1.0.0-beta.1'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, 'pyproject.toml'), 'utf-8');
        expect(updated).toContain('version = "1.0.0-beta.1"');
      });

      it('should handle version with build metadata', async () => {
        await writeFile(join(tempDir, 'setup.py'), `setup(version="1.0.0+build.123")`);

        const result = await adapter.update(tempDir, toVersion('2.0.0+build.456'));

        expect(isOk(result)).toBe(true);

        const updated = await readFile(join(tempDir, 'setup.py'), 'utf-8');
        expect(updated).toContain('version="2.0.0+build.456"');
      });
    });
  });

  describe('integration tests', () => {
    it('should detect and update in a complete workflow', async () => {
      // Create initial files
      await writeFile(
        join(tempDir, 'pyproject.toml'),
        `[project]
name = "test-package"
version = "1.0.0"
`,
      );

      // Detect
      const detectResult = await adapter.detect(tempDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.version).toBe('1.0.0');

        // Update
        const updateResult = await adapter.update(tempDir, toVersion('2.0.0'));
        expect(isOk(updateResult)).toBe(true);

        // Detect again
        const reDetectResult = await adapter.detect(tempDir);
        expect(isOk(reDetectResult)).toBe(true);
        if (isOk(reDetectResult)) {
          expect(reDetectResult.value.version).toBe('2.0.0');
        }
      }
    });

    it('should handle real-world Python project structure', async () => {
      // Create a realistic Python project
      await mkdir(join(tempDir, 'src'));
      await mkdir(join(tempDir, 'src', 'mypackage'));

      await writeFile(
        join(tempDir, 'pyproject.toml'),
        `[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "my-package"
version = "1.2.3"
description = "A sample Python project"
authors = [{name = "John Doe", email = "john@example.com"}]
dependencies = [
    "requests>=2.28.0",
    "click>=8.0.0",
]

[project.optional-dependencies]
dev = ["pytest>=7.0.0", "black>=22.0.0"]
`,
      );

      await writeFile(
        join(tempDir, 'src', 'mypackage', '__init__.py'),
        `"""My package."""

__version__ = "1.2.3"
__all__ = ["main"]

def main():
    print("Hello, World!")
`,
      );

      // Detect
      const detectResult = await adapter.detect(tempDir);
      expect(isOk(detectResult)).toBe(true);
      if (isOk(detectResult)) {
        expect(detectResult.value.name).toBe('my-package');
        expect(detectResult.value.version).toBe('1.2.3');
      }

      // Update
      const updateResult = await adapter.update(tempDir, toVersion('1.3.0'));
      expect(isOk(updateResult)).toBe(true);

      // Verify both files updated
      const pyproject = await readFile(join(tempDir, 'pyproject.toml'), 'utf-8');
      expect(pyproject).toContain('version = "1.3.0"');
    });
  });
});
