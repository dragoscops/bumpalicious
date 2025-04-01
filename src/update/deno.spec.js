import {describe, beforeAll, vi, afterAll} from 'vitest';
import {updateVersion} from './deno.js';
import {
  mockConfigFiles,
  setupUpdateVersionTestNoConfig,
  setupUpdateVersionTest,
} from '../vitest/setup.detect-update.tests.js';
import {DENO_VERSION_FILES} from '../core/constants.js';

describe('update/deno.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    for (const configFile of DENO_VERSION_FILES) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
