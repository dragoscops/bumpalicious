import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import * as update from './update.js';
import {
  warnNoVersionDetected,
  log,
} from './update.js';
import {
  mockReadFile,
  mockWriteFile,
  newVersion,
  setupVersionUpdateTest,
  unMockReadFile,
  unMockWriteFile,
} from '../../vitest/setup.detect-update.tests.js';
import {mockPino, setupPinoLoggingCallsTest, unMockPino} from '../../vitest/setup.logging.tests.js';

describe('update.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPino([], log);
  });

  afterEach(() => {
    unMockPino([], log);
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

      try {
        const result = await update.configUpdater('missing.json')(newVersion);

        expect(result).toBe(false);
        setupPinoLoggingCallsTest('warn', [
          {filePath: 'missing.json'},
          warnNoVersionDetected,
        ], log);
      } finally {
        unMockReadFile();
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
      }
    });

    it('should return null if no files can be updated', async () => {
      mockReadFile();

      try {
        await update.updateFirst('/project', 'test', newVersion, [
          update.configUpdater('nonexistent.json', {}),
          update.configUpdater('nonexistent.json', {}),
        ]);

        setupPinoLoggingCallsTest('warn', [
          {filePath: 'nonexistent.json'},
          warnNoVersionDetected,
        ], log);
      } finally {
        unMockReadFile();
      }
    });
  });
});
