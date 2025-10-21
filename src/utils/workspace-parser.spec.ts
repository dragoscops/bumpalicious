/**
 * Tests for workspace input parser
 */

import { describe, it, expect } from 'vitest';
import { InvalidConfigurationError } from './errors.js';
import { parseWorkspacesInput } from './workspace-parser.js';

describe('parseWorkspacesInput', () => {
  describe('basic parsing', () => {
    it('should parse single workspace with semicolon separator', () => {
      const result = parseWorkspacesInput('.:node');
      expect(result).toEqual([{ path: '.', type: 'node' }]);
    });

    it('should parse multiple workspaces with semicolon separator', () => {
      const result = parseWorkspacesInput('.:node;packages/api:python');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'python' },
      ]);
    });

    it('should parse multiple workspaces with comma separator', () => {
      const result = parseWorkspacesInput('.:node,tools:go');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'tools', type: 'go' },
      ]);
    });

    it('should parse mixed separators', () => {
      const result = parseWorkspacesInput('.:node;packages/api:python,tools:go');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'python' },
        { path: 'tools', type: 'go' },
      ]);
    });

    it('should parse all workspace types', () => {
      const result = parseWorkspacesInput('.:node;pkg1:python;pkg2:deno;pkg3:go;pkg4:rust;pkg5:zig;pkg6:text');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'pkg1', type: 'python' },
        { path: 'pkg2', type: 'deno' },
        { path: 'pkg3', type: 'go' },
        { path: 'pkg4', type: 'rust' },
        { path: 'pkg5', type: 'zig' },
        { path: 'pkg6', type: 'text' },
      ]);
    });
  });

  describe('path normalization', () => {
    it('should normalize "./" to "."', () => {
      const result = parseWorkspacesInput('./:node');
      expect(result).toEqual([{ path: '.', type: 'node' }]);
    });

    it('should remove leading "./" from paths', () => {
      const result = parseWorkspacesInput('./packages/api:python');
      expect(result).toEqual([{ path: 'packages/api', type: 'python' }]);
    });

    it('should remove trailing slashes', () => {
      const result = parseWorkspacesInput('packages/api/:python');
      expect(result).toEqual([{ path: 'packages/api', type: 'python' }]);
    });

    it('should normalize multiple paths', () => {
      const result = parseWorkspacesInput('./:node;./packages/api/:python');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'python' },
      ]);
    });

    it('should preserve relative paths without leading "./"', () => {
      const result = parseWorkspacesInput('packages/api:python');
      expect(result).toEqual([{ path: 'packages/api', type: 'python' }]);
    });
  });

  describe('whitespace handling', () => {
    it('should trim whitespace from paths and types', () => {
      const result = parseWorkspacesInput('  .  :  node  ');
      expect(result).toEqual([{ path: '.', type: 'node' }]);
    });

    it('should trim whitespace from segments', () => {
      const result = parseWorkspacesInput('  .:node  ;  packages/api:python  ');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'python' },
      ]);
    });

    it('should ignore empty segments after splitting', () => {
      const result = parseWorkspacesInput('.:node;;packages/api:python');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'python' },
      ]);
    });

    it('should handle whitespace around separators', () => {
      const result = parseWorkspacesInput('.:node ; packages/api:python , tools:go');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'python' },
        { path: 'tools', type: 'go' },
      ]);
    });
  });

  describe('error handling - empty input', () => {
    it('should throw for empty string', () => {
      expect(() => parseWorkspacesInput('')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput('')).toThrow('input cannot be empty');
    });

    it('should throw for whitespace-only string', () => {
      expect(() => parseWorkspacesInput('   ')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput('   ')).toThrow('input cannot be empty');
    });

    it('should throw for separators only', () => {
      expect(() => parseWorkspacesInput(';;,')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput(';;,')).toThrow('no valid workspace definitions found');
    });
  });

  describe('error handling - invalid format', () => {
    it('should throw for missing colon separator', () => {
      expect(() => parseWorkspacesInput('invalid')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput('invalid')).toThrow('invalid format');
      expect(() => parseWorkspacesInput('invalid')).toThrow('Expected format: "path:type"');
    });

    it('should throw for too many colons', () => {
      expect(() => parseWorkspacesInput('.:node:extra')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput('.:node:extra')).toThrow('invalid format');
    });

    it('should throw for empty path', () => {
      expect(() => parseWorkspacesInput(':node')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput(':node')).toThrow('path cannot be empty');
    });

    it('should throw for empty type', () => {
      expect(() => parseWorkspacesInput('.:  ')).toThrow(InvalidConfigurationError);
      expect(() => parseWorkspacesInput('.:  ')).toThrow('type cannot be empty');
    });

    it('should include segment index in error message', () => {
      try {
        parseWorkspacesInput('.:node;invalid;packages:python');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidConfigurationError);
        expect((error as InvalidConfigurationError).message).toContain('workspaces[1]');
      }
    });
  });

  describe('error handling - invalid workspace type', () => {
    it('should throw for invalid workspace type', () => {
      expect(() => parseWorkspacesInput('.:java')).toThrow(InvalidConfigurationError);
    });

    it('should throw for typo in workspace type', () => {
      expect(() => parseWorkspacesInput('.:nod')).toThrow(InvalidConfigurationError);
    });

    it('should validate all workspaces', () => {
      expect(() => parseWorkspacesInput('.:node;packages:invalid')).toThrow(InvalidConfigurationError);
    });
  });

  describe('error handling - security', () => {
    it('should throw for path traversal attempt with ".."', () => {
      expect(() => parseWorkspacesInput('../malicious:node')).toThrow(InvalidConfigurationError);
    });

    it('should throw for nested path traversal', () => {
      expect(() => parseWorkspacesInput('packages/../../../etc:node')).toThrow(InvalidConfigurationError);
    });
  });

  describe('edge cases', () => {
    it('should handle workspace with single character path', () => {
      const result = parseWorkspacesInput('a:node');
      expect(result).toEqual([{ path: 'a', type: 'node' }]);
    });

    it('should handle deeply nested paths', () => {
      const result = parseWorkspacesInput('packages/sub/deep/path:python');
      expect(result).toEqual([{ path: 'packages/sub/deep/path', type: 'python' }]);
    });

    it('should handle paths with hyphens and underscores', () => {
      const result = parseWorkspacesInput('my-package_v2:node');
      expect(result).toEqual([{ path: 'my-package_v2', type: 'node' }]);
    });

    it('should handle many workspaces', () => {
      const input = Array.from({ length: 10 }, (_, i) => `pkg${i}:node`).join(';');
      const result = parseWorkspacesInput(input);
      expect(result).toHaveLength(10);
      expect(result[0]).toEqual({ path: 'pkg0', type: 'node' });
      expect(result[9]).toEqual({ path: 'pkg9', type: 'node' });
    });
  });

  describe('real-world scenarios', () => {
    it('should parse monorepo root with packages', () => {
      const result = parseWorkspacesInput('.:node;packages/api:node;packages/cli:node');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'packages/api', type: 'node' },
        { path: 'packages/cli', type: 'node' },
      ]);
    });

    it('should parse multi-language monorepo', () => {
      const result = parseWorkspacesInput('.:node;backend:python;frontend:node;tools:go');
      expect(result).toEqual([
        { path: '.', type: 'node' },
        { path: 'backend', type: 'python' },
        { path: 'frontend', type: 'node' },
        { path: 'tools', type: 'go' },
      ]);
    });

    it('should parse single project workspace', () => {
      const result = parseWorkspacesInput('.:python');
      expect(result).toEqual([{ path: '.', type: 'python' }]);
    });
  });
});
