import {describe, beforeAll, vi, afterAll} from 'vitest';
import {updateVersion} from './go.js';
import {
  mockConfigFiles,
  setupUpdateVersionTestNoConfig,
  setupUpdateVersionTest,
} from '../vitest/setup.detect-update.tests.js';
import {GO_VERSION_FILES} from '../core/constants.js';

describe('update/go.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    for (const configFile of GO_VERSION_FILES.slice(0, -1)) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
