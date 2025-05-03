import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detect, updateVersion} from './text.js';
import {
  mockConfigFiles,
  setupDetectTest,
  setupDetectTestNoConfig,
  setupUpdateVersionTest,
  setupUpdateVersionTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {TEXT_VERSION_FILES} from './constants.js';

describe('detect/text.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detect()', () => {
    for (const configFile of TEXT_VERSION_FILES) {
      setupDetectTest({configFile, detect});
    }

    setupDetectTestNoConfig({detect});
  });

  describe('updateVersion()', () => {
    for (const configFile of TEXT_VERSION_FILES) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
