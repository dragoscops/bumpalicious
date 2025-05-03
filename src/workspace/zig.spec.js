import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detect, updateVersion} from './zig.js';
import {
  mockConfigFiles,
  setupDetectTest,
  setupDetectTestNoConfig,
  setupUpdateVersionTest,
  setupUpdateVersionTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {ZIG_VERSION_FILES} from './constants.js';

describe('detect/zig.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detect()', () => {
    for (const configFile of ZIG_VERSION_FILES) {
      setupDetectTest({configFile, detect});
    }

    setupDetectTestNoConfig({detect});
  });

  describe('updateVersion()', () => {
    for (const configFile of ZIG_VERSION_FILES) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
