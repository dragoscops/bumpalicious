import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detect, updateVersion} from './python.js';
import {
  mockConfigFiles,
  setupDetectTest,
  setupDetectTestNoConfig,
  setupUpdateVersionTest,
  setupUpdateVersionTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {PYTHON_VERSION_FILES} from '../core/constants.js';

describe('detect/python.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detect()', () => {
    for (const configFile of PYTHON_VERSION_FILES) {
      setupDetectTest({configFile, detect});
    }

    setupDetectTestNoConfig({detect});
  });

  describe('updateVersion()', () => {
    for (const configFile of PYTHON_VERSION_FILES) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
