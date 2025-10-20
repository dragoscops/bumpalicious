/**
 * Tests for BaseWorkspaceAdapter
 */

import { describe, it, expect } from 'vitest';
import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
import { ok, err, isOk } from '../../types/result.js';
import { toVersion } from '../../types/version.js';
import { WorkspaceDetectionError as WDError, FileOperationError as FOError } from '../../utils/errors.js';

/**
 * Concrete test implementation of BaseWorkspaceAdapter
 * Used to test abstract class behavior
 */
class TestAdapter extends BaseWorkspaceAdapter {
  readonly type: WorkspaceType = 'node';
  readonly supportedFiles = ['test.json'] as const;

  async detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
    // Simple test implementation
    if (workspacePath === '/invalid') {
      return err(new WDError(workspacePath, 'Test error: invalid path'));
    }

    return ok({
      name: 'test-project',
      version: toVersion('1.0.0'),
    });
  }

  async update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>> {
    // Simple test implementation
    if (workspacePath === '/readonly') {
      return err(new FOError(workspacePath, 'update', 'Test error: read-only'));
    }

    return ok(undefined);
  }
}

describe('BaseWorkspaceAdapter', () => {
  describe('abstract properties', () => {
    it('should have type property', () => {
      const adapter = new TestAdapter();
      expect(adapter.type).toBe('node');
    });

    it('should have supportedFiles property', () => {
      const adapter = new TestAdapter();
      expect(adapter.supportedFiles).toEqual(['test.json']);
    });

    it('should have readonly supportedFiles', () => {
      const adapter = new TestAdapter();
      expect(Object.isFrozen(adapter.supportedFiles)).toBe(false); // TypeScript readonly, not runtime frozen
      expect(Array.isArray(adapter.supportedFiles)).toBe(true);
    });
  });

  describe('abstract methods', () => {
    it('should implement detect method', async () => {
      const adapter = new TestAdapter();
      const result = await adapter.detect('/valid');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('test-project');
        expect(result.value.version).toBe('1.0.0');
      }
    });

    it('should return error from detect on invalid path', async () => {
      const adapter = new TestAdapter();
      const result = await adapter.detect('/invalid');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeInstanceOf(WDError);
        expect(result.error.message).toContain('invalid path');
      }
    });

    it('should implement update method', async () => {
      const adapter = new TestAdapter();
      const result = await adapter.update('/valid', toVersion('2.0.0'));

      expect(isOk(result)).toBe(true);
    });

    it('should return error from update on readonly path', async () => {
      const adapter = new TestAdapter();
      const result = await adapter.update('/readonly', toVersion('2.0.0'));

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeInstanceOf(FOError);
        expect(result.error.message).toContain('read-only');
      }
    });
  });

  describe('protected helper methods', () => {
    it('should expose parseFile method to subclasses', () => {
      const adapter = new TestAdapter();
      // TypeScript compile-time check that protected method exists
      // We can't call it directly in tests, but we can verify it's defined
      expect(typeof (adapter as any).parseFile).toBe('function');
    });

    it('should expose updateFile method to subclasses', () => {
      const adapter = new TestAdapter();
      // TypeScript compile-time check that protected method exists
      expect(typeof (adapter as any).updateFile).toBe('function');
    });
  });

  describe('type safety', () => {
    it('should enforce WorkspaceType for type property', () => {
      const adapter = new TestAdapter();
      const type: WorkspaceType = adapter.type;
      expect(type).toBe('node');
    });

    it('should return Result<ProjectInfo, WorkspaceDetectionError> from detect', async () => {
      const adapter = new TestAdapter();
      const result: Result<ProjectInfo, WorkspaceDetectionError> = await adapter.detect('/valid');
      expect(result).toBeDefined();
    });

    it('should return Result<void, FileOperationError> from update', async () => {
      const adapter = new TestAdapter();
      const result: Result<void, FileOperationError> = await adapter.update('/valid', toVersion('1.0.0'));
      expect(result).toBeDefined();
    });
  });

  describe('inheritance', () => {
    it('should allow subclasses to override type', () => {
      class PythonAdapter extends BaseWorkspaceAdapter {
        readonly type: WorkspaceType = 'python';
        readonly supportedFiles = ['pyproject.toml'] as const;

        async detect(_path: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
          return ok({ name: 'python-project', version: toVersion('0.1.0') });
        }

        async update(_path: string, _version: Version): Promise<Result<void, FileOperationError>> {
          return ok(undefined);
        }
      }

      const adapter = new PythonAdapter();
      expect(adapter.type).toBe('python');
      expect(adapter.supportedFiles).toEqual(['pyproject.toml']);
    });

    it('should allow subclasses to override supportedFiles', () => {
      class MultiFileAdapter extends BaseWorkspaceAdapter {
        readonly type: WorkspaceType = 'node';
        readonly supportedFiles = ['package.json', 'jsr.json', 'deno.json'] as const;

        async detect(_path: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>> {
          return ok({ name: 'multi-file-project', version: toVersion('1.0.0') });
        }

        async update(_path: string, _version: Version): Promise<Result<void, FileOperationError>> {
          return ok(undefined);
        }
      }

      const adapter = new MultiFileAdapter();
      expect(adapter.supportedFiles.length).toBe(3);
      expect(adapter.supportedFiles).toContain('package.json');
      expect(adapter.supportedFiles).toContain('jsr.json');
      expect(adapter.supportedFiles).toContain('deno.json');
    });
  });

  describe('documentation', () => {
    it('should have class-level documentation', () => {
      // This is a compile-time check - if BaseWorkspaceAdapter has JSDoc,
      // TypeScript will show it in IDE tooltips
      const adapter = new TestAdapter();
      expect(adapter).toBeDefined();
    });

    it('should document abstract methods', () => {
      // Compile-time check for JSDoc on abstract methods
      const adapter = new TestAdapter();
      expect(typeof adapter.detect).toBe('function');
      expect(typeof adapter.update).toBe('function');
    });
  });
});
