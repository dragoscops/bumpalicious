/**
 * Test repository setup utilities for integration tests
 *
 * Usage:
 * ```typescript
 * import { setupTestRepo, createNodeRepo, createPythonRepo } from '@/test/fixtures/repos/setup.js';
 *
 * // Create a test repository
 * const { repoPath, cleanup } = await setupTestRepo('node');
 *
 * // Use the repository in tests
 * // ...
 *
 * // Clean up after tests
 * await cleanup();
 * ```
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export type RepoType = 'node' | 'python' | 'monorepo' | 'go' | 'rust' | 'deno' | 'zig' | 'text';

export interface TestRepo {
  repoPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a temporary test repository with the specified type
 */
export async function setupTestRepo(type: RepoType = 'node'): Promise<TestRepo> {
  const repoPath = join(tmpdir(), `bumpalicious-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  await mkdir(repoPath, { recursive: true });

  switch (type) {
    case 'node':
      await createNodeRepo(repoPath);
      break;
    case 'python':
      await createPythonRepo(repoPath);
      break;
    case 'monorepo':
      await createMonorepo(repoPath);
      break;
    case 'go':
      await createGoRepo(repoPath);
      break;
    case 'rust':
      await createRustRepo(repoPath);
      break;
    case 'deno':
      await createDenoRepo(repoPath);
      break;
    case 'zig':
      await createZigRepo(repoPath);
      break;
    case 'text':
      await createTextRepo(repoPath);
      break;
  }

  const cleanup = async () => {
    await rm(repoPath, { recursive: true, force: true });
  };

  return { repoPath, cleanup };
}

/**
 * Creates a Node.js repository template
 */
export async function createNodeRepo(repoPath: string): Promise<void> {
  const packageJson = {
    name: 'test-node-project',
    version: '1.0.0',
    description: 'Test Node.js project',
    main: 'index.js',
    scripts: {
      test: 'echo "Error: no test specified" && exit 1',
    },
    keywords: [],
    author: '',
    license: 'MIT',
  };

  await writeFile(join(repoPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  const indexJs = `console.log('Hello, World!');
`;
  await writeFile(join(repoPath, 'index.js'), indexJs);

  const readme = `# Test Node Project

This is a test Node.js project.
`;
  await writeFile(join(repoPath, 'README.md'), readme);
}

/**
 * Creates a Python repository template
 */
export async function createPythonRepo(repoPath: string): Promise<void> {
  const pyprojectToml = `[project]
name = "test-python-project"
version = "0.1.0"
description = "Test Python project"
authors = [{ name = "Test Author", email = "test@example.com" }]
license = { text = "MIT" }
requires-python = ">=3.8"
`;

  await writeFile(join(repoPath, 'pyproject.toml'), pyprojectToml);

  const srcDir = join(repoPath, 'src', 'test_project');
  await mkdir(srcDir, { recursive: true });

  const initPy = `"""Test Python project."""

__version__ = "0.1.0"
`;
  await writeFile(join(srcDir, '__init__.py'), initPy);

  const mainPy = `def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
`;
  await writeFile(join(srcDir, 'main.py'), mainPy);

  const readme = `# Test Python Project

This is a test Python project.
`;
  await writeFile(join(repoPath, 'README.md'), readme);
}

/**
 * Creates a monorepo template with multiple workspaces
 */
export async function createMonorepo(repoPath: string): Promise<void> {
  // Root package.json
  const rootPackageJson = {
    name: 'test-monorepo',
    version: '1.0.0',
    private: true,
    workspaces: ['packages/*'],
  };
  await writeFile(join(repoPath, 'package.json'), JSON.stringify(rootPackageJson, null, 2));

  // Create packages directory
  const packagesDir = join(repoPath, 'packages');
  await mkdir(packagesDir, { recursive: true });

  // Package 1: Node.js API
  const apiDir = join(packagesDir, 'api');
  await mkdir(apiDir, { recursive: true });
  const apiPackageJson = {
    name: '@test/api',
    version: '2.0.0',
    description: 'Test API package',
    main: 'index.js',
  };
  await writeFile(join(apiDir, 'package.json'), JSON.stringify(apiPackageJson, null, 2));
  await writeFile(join(apiDir, 'index.js'), 'module.exports = { api: true };\n');

  // Package 2: Node.js CLI
  const cliDir = join(packagesDir, 'cli');
  await mkdir(cliDir, { recursive: true });
  const cliPackageJson = {
    name: '@test/cli',
    version: '1.5.0',
    description: 'Test CLI package',
    bin: {
      'test-cli': './cli.js',
    },
  };
  await writeFile(join(cliDir, 'package.json'), JSON.stringify(cliPackageJson, null, 2));
  await writeFile(join(cliDir, 'cli.js'), '#!/usr/bin/env node\nconsole.log("CLI");\n');

  // Backend: Python
  const backendDir = join(repoPath, 'backend');
  await mkdir(backendDir, { recursive: true });
  const backendPyproject = `[project]
name = "test-backend"
version = "1.2.0"
`;
  await writeFile(join(backendDir, 'pyproject.toml'), backendPyproject);

  const readme = `# Test Monorepo

Multi-language monorepo for testing.

## Structure
- packages/api - Node.js API
- packages/cli - Node.js CLI
- backend - Python backend
`;
  await writeFile(join(repoPath, 'README.md'), readme);
}

/**
 * Creates a Go repository template
 */
export async function createGoRepo(repoPath: string): Promise<void> {
  const goMod = `module test-go-project

go 1.21

// version: 0.1.0
`;
  await writeFile(join(repoPath, 'go.mod'), goMod);

  const mainGo = `package main

import "fmt"

func main() {
	fmt.Println("Hello, World!")
}
`;
  await writeFile(join(repoPath, 'main.go'), mainGo);
}

/**
 * Creates a Rust repository template
 */
export async function createRustRepo(repoPath: string): Promise<void> {
  const cargoToml = `[package]
name = "test-rust-project"
version = "0.1.0"
edition = "2021"

[dependencies]
`;
  await writeFile(join(repoPath, 'Cargo.toml'), cargoToml);

  const srcDir = join(repoPath, 'src');
  await mkdir(srcDir, { recursive: true });

  const mainRs = `fn main() {
    println!("Hello, World!");
}
`;
  await writeFile(join(srcDir, 'main.rs'), mainRs);
}

/**
 * Creates a Deno repository template
 */
export async function createDenoRepo(repoPath: string): Promise<void> {
  const denoJson = {
    name: 'test-deno-project',
    version: '1.0.0',
    exports: './mod.ts',
  };
  await writeFile(join(repoPath, 'deno.json'), JSON.stringify(denoJson, null, 2));

  const modTs = `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;
  await writeFile(join(repoPath, 'mod.ts'), modTs);
}

/**
 * Creates a Zig repository template
 */
export async function createZigRepo(repoPath: string): Promise<void> {
  const buildZig = `const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "test-zig-project",
        .root_source_file = .{ .path = "src/main.zig" },
        .target = target,
        .optimize = optimize,
        .version = .{ .major = 0, .minor = 1, .patch = 0 },
    });

    b.installArtifact(exe);
}
`;
  await writeFile(join(repoPath, 'build.zig'), buildZig);

  const srcDir = join(repoPath, 'src');
  await mkdir(srcDir, { recursive: true });

  const mainZig = `const std = @import("std");

pub fn main() !void {
    const stdout = std.io.getStdOut().writer();
    try stdout.print("Hello, World!\\n", .{});
}
`;
  await writeFile(join(srcDir, 'main.zig'), mainZig);
}

/**
 * Creates a text-based version file repository
 */
export async function createTextRepo(repoPath: string): Promise<void> {
  await writeFile(join(repoPath, 'VERSION'), '1.0.0');

  const readme = `# Test Project

Version: 1.0.0
`;
  await writeFile(join(repoPath, 'README.md'), readme);
}
