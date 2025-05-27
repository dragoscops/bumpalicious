import {describe, it, expect, beforeEach, vi} from 'vitest';
import * as update from './update.js';
import {
  mockReadFile,
  mockWriteFile,
  newVersion,
  setupVersionDetectTest,
  setupVersionUpdateTest,
  unMockReadFile,
  unMockWriteFile,
} from '../../vitest/setup.detect-update.tests.js';
import {
  mockCConsole,
  mockConsole,
  setupLoggingCallsTest,
  unMockCConsole,
  unMockConsole,
} from '../../vitest/setup.logging.tests.js';

describe('update.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configUpdater', () => {
    it('should create an updater function for JSON files', async () => {
      setupVersionUpdateTest(
        update.configUpdater('package.json', {
          parser: JSON.parse,
          serializer: (data) => JSON.stringify(data, null, 2),
          version: ['version'],
        }),
        `"version": "${newVersion}"`,
      );
    });

    it('should create an updater function for regex-based updates', async () => {
      setupVersionUpdateTest(
        update.configUpdater('go.mod', {
          parser: (data) => data, // pass through
          serializer: (data) => data,
          version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
        }),
        `// version: ${newVersion}`,
      );
    });

    it('should create an updater function', async () => {
      setupVersionUpdateTest(
        update.configUpdater('version', {
          parser: (data) => data, // pass through
          serializer: (data) => data,
          version: [(data) => newVersion],
        }),
        newVersion,
      );
    });

    it('should handle file read errors gracefully', async () => {
      mockReadFile();
      mockCConsole(['warning']);
      mockConsole(['warning']);

      try {
        const result = await update.configUpdater('missing.json')(newVersion);

        expect(result).toBe(false);
        setupLoggingCallsTest('warning', [
          expect.stringContaining('WARNING'),
          expect.stringContaining('No version detected'),
        ]);
      } finally {
        unMockReadFile();
        unMockCConsole(['warning']);
        unMockConsole(['warning']);
      }
    });
  });

  describe('updateAll', () => {
    it('should update all files with matching patterns', async () => {
      setupVersionUpdateTest(
        async () =>
          await update.updateAll('/project', 'test', newVersion, [
            update.configUpdater('package.json', {
              parser: JSON.parse,
              serializer: (data) => JSON.stringify(data, null, 2),
              version: ['version'],
            }),
            update.configUpdater('version', {
              parser: (data) => data, // pass through
              serializer: (data) => data,
              version: (data) => newVersion,
            }),
          ]),
        [`"version": "${newVersion}"`, newVersion],
      );
    });
  });

  describe('updateFirst', () => {
    it('should update only the first file with a matching pattern', async () => {
      mockCConsole();
      mockConsole();
      mockReadFile();
      mockWriteFile();

      try {
        await update.updateFirst('/project', 'test', newVersion, [
          update.configUpdater('go.mod', {
            parser: (data) => data, // pass through
            serializer: (data) => data,
            version: [[/\/\/\s*[vV]ersion:?\s*(\d+\.\d+\.\d+(?:[-+][\da-zA-Z.]+)*)/m, '// version: $VERSION']],
          }),
          update.configUpdater('version', {
            parser: (data) => data, // pass through
            serializer: (data) => data,
            version: (data) => newVersion,
          }),
        ]);

        expect(update.forMock.writeFile).toHaveBeenCalledWith(
          'go.mod',
          expect.stringContaining(`// version: ${newVersion}`),
        );
        expect(update.forMock.writeFile).not.toHaveBeenCalledWith('version', newVersion);
      } finally {
        unMockReadFile();
        unMockWriteFile();
        unMockCConsole();
        unMockConsole();
      }
    });

    it('should return null if no files can be updated', async () => {
      mockCConsole();
      mockConsole();
      mockReadFile();

      try {
        await update.updateFirst('/project', 'test', newVersion, [
          update.configUpdater('nonexistent.json', {}),
          update.configUpdater('nonexistent.json', {}),
        ]);

        setupLoggingCallsTest('warning', [
          expect.stringContaining('WARNING'),
          expect.stringContaining('No version detected'),
        ]);
      } finally {
        unMockReadFile();
        unMockCConsole();
        unMockConsole();
      }
    });
  });
});
