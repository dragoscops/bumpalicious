import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detect, updateVersion} from './node.js';
import {
  mockConfigFiles,
  setupDetectTest,
  setupDetectTestNoConfig,
  setupUpdateVersionTest,
  setupUpdateVersionTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {NODE_VERSION_FILES} from '../core/constants.js';

describe('detect/deno.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detect()', () => {
    for (const configFile of NODE_VERSION_FILES) {
      setupDetectTest({configFile, detect});
    }

    setupDetectTestNoConfig({detect});
  });

  describe('updateVersion()', () => {
    for (const configFile of NODE_VERSION_FILES) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
