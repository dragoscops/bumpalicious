/**
 * Tests for Workspace Adapter Factory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter, getSupportedTypes, isTypeSupported, clearAdapterCache } from './AdapterFactory.js';
import { DenoAdapter } from './DenoAdapter.js';
import { GoAdapter } from './GoAdapter.js';
import { NodeAdapter } from './NodeAdapter.js';
import { PythonAdapter } from './PythonAdapter.js';
import { RustAdapter } from './RustAdapter.js';
import { TextAdapter } from './TextAdapter.js';
import { ZigAdapter } from './ZigAdapter.js';
import type { WorkspaceType } from '../../types/index.js';
import { InvalidConfigurationError } from '../../utils/errors.js';

describe('AdapterFactory', () => {
  beforeEach(() => {
    // Clear cache before each test to ensure isolated state
    clearAdapterCache();
  });

  describe('getAdapter', () => {
    describe('node adapter', () => {
      it('should return NodeAdapter instance for "node" type', () => {
        const adapter = getAdapter('node');
        expect(adapter).toBeInstanceOf(NodeAdapter);
        expect(adapter.type).toBe('node');
        expect(adapter.supportedFiles).toEqual(['package.json', 'jsr.json']);
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('node');
        const adapter2 = getAdapter('node');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('python adapter', () => {
      it('should return PythonAdapter instance for "python" type', () => {
        const adapter = getAdapter('python');
        expect(adapter).toBeInstanceOf(PythonAdapter);
        expect(adapter.type).toBe('python');
        expect(adapter.supportedFiles).toContain('pyproject.toml');
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('python');
        const adapter2 = getAdapter('python');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('deno adapter', () => {
      it('should return DenoAdapter instance for "deno" type', () => {
        const adapter = getAdapter('deno');
        expect(adapter).toBeInstanceOf(DenoAdapter);
        expect(adapter.type).toBe('deno');
        expect(adapter.supportedFiles).toContain('deno.json');
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('deno');
        const adapter2 = getAdapter('deno');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('go adapter', () => {
      it('should return GoAdapter instance for "go" type', () => {
        const adapter = getAdapter('go');
        expect(adapter).toBeInstanceOf(GoAdapter);
        expect(adapter.type).toBe('go');
        expect(adapter.supportedFiles).toContain('go.mod');
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('go');
        const adapter2 = getAdapter('go');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('rust adapter', () => {
      it('should return RustAdapter instance for "rust" type', () => {
        const adapter = getAdapter('rust');
        expect(adapter).toBeInstanceOf(RustAdapter);
        expect(adapter.type).toBe('rust');
        expect(adapter.supportedFiles).toContain('Cargo.toml');
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('rust');
        const adapter2 = getAdapter('rust');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('zig adapter', () => {
      it('should return ZigAdapter instance for "zig" type', () => {
        const adapter = getAdapter('zig');
        expect(adapter).toBeInstanceOf(ZigAdapter);
        expect(adapter.type).toBe('zig');
        expect(adapter.supportedFiles).toContain('build.zig.zon');
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('zig');
        const adapter2 = getAdapter('zig');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('text adapter', () => {
      it('should return TextAdapter instance for "text" type', () => {
        const adapter = getAdapter('text');
        expect(adapter).toBeInstanceOf(TextAdapter);
        expect(adapter.type).toBe('text');
        expect(adapter.supportedFiles).toContain('VERSION');
      });

      it('should return same instance on multiple calls (singleton)', () => {
        const adapter1 = getAdapter('text');
        const adapter2 = getAdapter('text');
        expect(adapter1).toBe(adapter2);
      });
    });

    describe('error handling', () => {
      it('should throw InvalidConfigurationError for unsupported type', () => {
        expect(() => {
          getAdapter('unsupported' as WorkspaceType);
        }).toThrow(InvalidConfigurationError);
      });

      it('should include supported types in error message', () => {
        expect(() => {
          getAdapter('invalid' as WorkspaceType);
        }).toThrow(/Supported types: node, python, deno, go, rust, zig, text/);
      });

      it('should include the invalid type in error message', () => {
        expect(() => {
          getAdapter('foobar' as WorkspaceType);
        }).toThrow(/Unsupported workspace type: foobar/);
      });
    });

    describe('cache behavior', () => {
      it('should return different instances for different types', () => {
        const nodeAdapter = getAdapter('node');
        const pythonAdapter = getAdapter('python');
        expect(nodeAdapter).not.toBe(pythonAdapter);
        expect(nodeAdapter.type).toBe('node');
        expect(pythonAdapter.type).toBe('python');
      });

      it('should maintain cache across multiple different adapter requests', () => {
        const node1 = getAdapter('node');
        const python1 = getAdapter('python');
        const node2 = getAdapter('node');
        const python2 = getAdapter('python');

        expect(node1).toBe(node2);
        expect(python1).toBe(python2);
        expect(node1).not.toBe(python1);
      });
    });
  });

  describe('getSupportedTypes', () => {
    it('should return array of all supported workspace types', () => {
      const types = getSupportedTypes();
      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBe(7);
    });

    it('should include all expected workspace types', () => {
      const types = getSupportedTypes();
      expect(types).toContain('node');
      expect(types).toContain('python');
      expect(types).toContain('deno');
      expect(types).toContain('go');
      expect(types).toContain('rust');
      expect(types).toContain('zig');
      expect(types).toContain('text');
    });

    it('should return same types on multiple calls', () => {
      const types1 = getSupportedTypes();
      const types2 = getSupportedTypes();
      expect(types1).toEqual(types2);
    });
  });

  describe('isTypeSupported', () => {
    it('should return true for supported types', () => {
      expect(isTypeSupported('node')).toBe(true);
      expect(isTypeSupported('python')).toBe(true);
      expect(isTypeSupported('deno')).toBe(true);
      expect(isTypeSupported('go')).toBe(true);
      expect(isTypeSupported('rust')).toBe(true);
      expect(isTypeSupported('zig')).toBe(true);
      expect(isTypeSupported('text')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isTypeSupported('unsupported')).toBe(false);
      expect(isTypeSupported('invalid')).toBe(false);
      expect(isTypeSupported('foobar')).toBe(false);
      expect(isTypeSupported('')).toBe(false);
    });

    it('should work as type guard', () => {
      const type: string = 'node';
      if (isTypeSupported(type)) {
        // Type should be narrowed to WorkspaceType
        const adapter = getAdapter(type);
        expect(adapter.type).toBe('node');
      }
    });
  });

  describe('clearAdapterCache', () => {
    it('should clear all cached adapters', () => {
      const adapter1 = getAdapter('node');
      clearAdapterCache();
      const adapter2 = getAdapter('node');
      expect(adapter1).not.toBe(adapter2);
    });

    it('should clear cache for all adapter types', () => {
      const node1 = getAdapter('node');
      const python1 = getAdapter('python');

      clearAdapterCache();

      const node2 = getAdapter('node');
      const python2 = getAdapter('python');

      expect(node1).not.toBe(node2);
      expect(python1).not.toBe(python2);
    });

    it('should allow new instances to be created after clearing', () => {
      getAdapter('node');
      clearAdapterCache();

      const adapter = getAdapter('node');
      expect(adapter).toBeInstanceOf(NodeAdapter);
      expect(adapter.type).toBe('node');
    });
  });

  describe('integration', () => {
    it('should create adapters that can detect and update', async () => {
      // This is a smoke test to ensure adapters have the correct interface
      const adapters = [
        getAdapter('node'),
        getAdapter('python'),
        getAdapter('deno'),
        getAdapter('go'),
        getAdapter('rust'),
        getAdapter('zig'),
        getAdapter('text'),
      ];

      for (const adapter of adapters) {
        expect(adapter.detect).toBeInstanceOf(Function);
        expect(adapter.update).toBeInstanceOf(Function);
        expect(adapter.type).toBeTruthy();
        expect(adapter.supportedFiles.length).toBeGreaterThan(0);
      }
    });

    it('should work with all workspace types from type system', () => {
      const workspaceTypes: WorkspaceType[] = ['node', 'python', 'deno', 'go', 'rust', 'zig', 'text'];

      for (const type of workspaceTypes) {
        const adapter = getAdapter(type);
        expect(adapter.type).toBe(type);
      }
    });
  });
});
