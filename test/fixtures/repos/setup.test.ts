/**
 * Tests for test repository setup utilities
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { setupTestRepo, type TestRepo } from './setup.js';

describe('test repository setup', () => {
  let testRepo: TestRepo | null = null;

  afterEach(async () => {
    if (testRepo) {
      await testRepo.cleanup();
      testRepo = null;
    }
  });

  describe('setupTestRepo', () => {
    it('should create a temporary directory', async () => {
      testRepo = await setupTestRepo('node');
      expect(testRepo.repoPath).toBeDefined();
      expect(testRepo.cleanup).toBeInstanceOf(Function);

      // Verify directory exists
      await expect(access(testRepo.repoPath)).resolves.not.toThrow();
    });

    it('should create unique directories for each call', async () => {
      const repo1 = await setupTestRepo('node');
      const repo2 = await setupTestRepo('node');

      expect(repo1.repoPath).not.toBe(repo2.repoPath);

      await repo1.cleanup();
      await repo2.cleanup();
    });
  });

  describe('node repository', () => {
    it('should create package.json', async () => {
      testRepo = await setupTestRepo('node');
      const packageJsonPath = join(testRepo.repoPath, 'package.json');

      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should create index.js', async () => {
      testRepo = await setupTestRepo('node');
      const indexPath = join(testRepo.repoPath, 'index.js');

      await expect(access(indexPath)).resolves.not.toThrow();
    });

    it('should create README.md', async () => {
      testRepo = await setupTestRepo('node');
      const readmePath = join(testRepo.repoPath, 'README.md');

      await expect(access(readmePath)).resolves.not.toThrow();
    });
  });

  describe('python repository', () => {
    it('should create pyproject.toml', async () => {
      testRepo = await setupTestRepo('python');
      const pyprojectPath = join(testRepo.repoPath, 'pyproject.toml');

      const content = await readFile(pyprojectPath, 'utf-8');
      expect(content).toContain('[project]');
      expect(content).toContain('version =');
    });

    it('should create __init__.py with version', async () => {
      testRepo = await setupTestRepo('python');
      const initPath = join(testRepo.repoPath, 'src', 'test_project', '__init__.py');

      const content = await readFile(initPath, 'utf-8');
      expect(content).toContain('__version__');
    });
  });

  describe('monorepo', () => {
    it('should create root package.json with workspaces', async () => {
      testRepo = await setupTestRepo('monorepo');
      const packageJsonPath = join(testRepo.repoPath, 'package.json');

      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      expect(packageJson.workspaces).toBeDefined();
      expect(packageJson.private).toBe(true);
    });

    it('should create multiple workspace packages', async () => {
      testRepo = await setupTestRepo('monorepo');

      // Check API package
      const apiPackagePath = join(testRepo.repoPath, 'packages', 'api', 'package.json');
      await expect(access(apiPackagePath)).resolves.not.toThrow();

      // Check CLI package
      const cliPackagePath = join(testRepo.repoPath, 'packages', 'cli', 'package.json');
      await expect(access(cliPackagePath)).resolves.not.toThrow();

      // Check backend (Python)
      const backendPath = join(testRepo.repoPath, 'backend', 'pyproject.toml');
      await expect(access(backendPath)).resolves.not.toThrow();
    });

    it('should have different versions in packages', async () => {
      testRepo = await setupTestRepo('monorepo');

      const rootContent = await readFile(join(testRepo.repoPath, 'package.json'), 'utf-8');
      const apiContent = await readFile(join(testRepo.repoPath, 'packages', 'api', 'package.json'), 'utf-8');
      const cliContent = await readFile(join(testRepo.repoPath, 'packages', 'cli', 'package.json'), 'utf-8');

      const rootVersion = JSON.parse(rootContent).version;
      const apiVersion = JSON.parse(apiContent).version;
      const cliVersion = JSON.parse(cliContent).version;

      expect(rootVersion).toBeDefined();
      expect(apiVersion).toBeDefined();
      expect(cliVersion).toBeDefined();

      // Verify they can have different versions
      expect(apiVersion).not.toBe(cliVersion);
    });
  });

  describe('go repository', () => {
    it('should create go.mod with version comment', async () => {
      testRepo = await setupTestRepo('go');
      const goModPath = join(testRepo.repoPath, 'go.mod');

      const content = await readFile(goModPath, 'utf-8');
      expect(content).toContain('module');
      expect(content).toContain('// version:');
    });
  });

  describe('rust repository', () => {
    it('should create Cargo.toml with package section', async () => {
      testRepo = await setupTestRepo('rust');
      const cargoPath = join(testRepo.repoPath, 'Cargo.toml');

      const content = await readFile(cargoPath, 'utf-8');
      expect(content).toContain('[package]');
      expect(content).toContain('version =');
    });
  });

  describe('deno repository', () => {
    it('should create deno.json with version', async () => {
      testRepo = await setupTestRepo('deno');
      const denoJsonPath = join(testRepo.repoPath, 'deno.json');

      const content = await readFile(denoJsonPath, 'utf-8');
      const denoJson = JSON.parse(content);

      expect(denoJson.version).toBeDefined();
      expect(denoJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('zig repository', () => {
    it('should create build.zig with version', async () => {
      testRepo = await setupTestRepo('zig');
      const buildZigPath = join(testRepo.repoPath, 'build.zig');

      const content = await readFile(buildZigPath, 'utf-8');
      expect(content).toContain('.version');
      expect(content).toContain('.major');
      expect(content).toContain('.minor');
      expect(content).toContain('.patch');
    });
  });

  describe('text repository', () => {
    it('should create VERSION file', async () => {
      testRepo = await setupTestRepo('text');
      const versionPath = join(testRepo.repoPath, 'VERSION');

      const content = await readFile(versionPath, 'utf-8');
      expect(content).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('cleanup', () => {
    it('should remove the test repository', async () => {
      testRepo = await setupTestRepo('node');
      const repoPath = testRepo.repoPath;

      // Verify it exists
      await expect(access(repoPath)).resolves.not.toThrow();

      // Cleanup
      await testRepo.cleanup();

      // Verify it's gone
      await expect(access(repoPath)).rejects.toThrow();

      testRepo = null; // Prevent double cleanup
    });
  });
});
