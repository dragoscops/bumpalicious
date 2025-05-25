import {describe, it, expect, beforeEach, vi} from 'vitest';
import {configUpdater, updateAll, updateFirst} from './update.js';;
import {newVersion, setupVersionUpdateTest} from '../../vitest/setup.detect-update.tests.js';



describe('update.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configUpdater', () => {
    it('should create an updater function for JSON files', async () => {
      setupVersionUpdateTest(
        configUpdater('package.json', {
          parser: JSON.parse,
          serializer: (data) => JSON.stringify(data, null, 2),
          version: ['version'],
        }),
        `"version": "${newVersion}"`,
      );
    });

    // it('should create an updater function for regex-based updates', async () => {
    //   const mockWriteFile = vi.fn().mockResolvedValue(true);
    //   const mockReadFile = vi.fn().mockResolvedValue('const VERSION = "1.0.0";');

    //   const originalForMock = await import('./update.js').then((m) => m.forMock);
    //   vi.spyOn(originalForMock, 'writeFile').mockImplementation(mockWriteFile);
    //   vi.spyOn(originalForMock, 'readFile').mockImplementation(mockReadFile);

    //   const updater = configUpdater('/project/version.js', {
    //     parser: (data) => data, // pass through
    //     serializer: (data) => data,
    //     version: [[/const VERSION = "([^"]+)";/, 'const VERSION = "$VERSION";']],
    //   });

    //   const result = await updater('2.0.0');

    //   expect(result.success).toBe(true);
    //   expect(mockWriteFile).toHaveBeenCalledWith('/project/version.js', 'const VERSION = "2.0.0";');
    // });

    // it('should handle file read errors gracefully', async () => {
    //   const mockReadFile = vi.fn().mockResolvedValue(null);

    //   const originalForMock = await import('./update.js').then((m) => m.forMock);
    //   vi.spyOn(originalForMock, 'readFile').mockImplementation(mockReadFile);

    //   const updater = configUpdater('/project/missing.json');
    //   const result = await updater('2.0.0');

    //   expect(result.success).toBe(false);
    //   expect(result.error).toBe('File not found or could not be read');
    // });
  });

  // describe('updateAll', () => {
  //   it('should update all files with matching patterns', async () => {
  //     const updater1 = vi.fn().mockResolvedValue({success: true, filePath: '/project/package.json'});
  //     const updater2 = vi.fn().mockResolvedValue({success: true, filePath: '/project/version.txt'});
  //     const updater3 = vi
  //       .fn()
  //       .mockResolvedValue({success: false, filePath: '/project/missing.json', error: 'Not found'});

  //     const results = await updateAll('/project', 'test', '2.0.0', [updater1, updater2, updater3]);

  //     expect(results).toHaveLength(3);
  //     expect(results[0].success).toBe(true);
  //     expect(results[1].success).toBe(true);
  //     expect(results[2].success).toBe(false);
  //     expect(updater1).toHaveBeenCalledWith('2.0.0');
  //     expect(updater2).toHaveBeenCalledWith('2.0.0');
  //     expect(updater3).toHaveBeenCalledWith('2.0.0');
  //   });
  // });

  // describe('updateFirst', () => {
  //   it('should update only the first file with a matching pattern', async () => {
  //     const updater1 = vi
  //       .fn()
  //       .mockResolvedValue({success: false, filePath: '/project/missing.json', error: 'Not found'});
  //     const updater2 = vi.fn().mockResolvedValue({success: true, filePath: '/project/package.json'});
  //     const updater3 = vi.fn(); // Should not be called

  //     const result = await updateFirst('/project', 'test', '2.0.0', [updater1, updater2, updater3]);

  //     expect(result?.success).toBe(true);
  //     expect(result?.filePath).toBe('/project/package.json');
  //     expect(updater1).toHaveBeenCalledWith('2.0.0');
  //     expect(updater2).toHaveBeenCalledWith('2.0.0');
  //     expect(updater3).not.toHaveBeenCalled();
  //   });

  //   it('should return null if no files can be updated', async () => {
  //     const updater1 = vi
  //       .fn()
  //       .mockResolvedValue({success: false, filePath: '/project/missing1.json', error: 'Not found'});
  //     const updater2 = vi
  //       .fn()
  //       .mockResolvedValue({success: false, filePath: '/project/missing2.json', error: 'Not found'});

  //     const result = await updateFirst('/project', 'test', '2.0.0', [updater1, updater2]);

  //     expect(result).toBeNull();
  //     expect(updater1).toHaveBeenCalledWith('2.0.0');
  //     expect(updater2).toHaveBeenCalledWith('2.0.0');
  //   });
  // });
});
