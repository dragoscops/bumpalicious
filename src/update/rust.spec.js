import {describe, beforeAll, vi, afterAll} from 'vitest';
import {updateVersion} from './rust.js';
import {
  mockConfigFiles,
  setupUpdateVersionTestNoConfig,
  setupUpdateVersionTest,
} from '../vitest/setup.detect-update.tests.js';
import {RUST_VERSION_FILES} from '../core/constants.js';

describe('update/node.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('updateVersion()', () => {
    for (const configFile of RUST_VERSION_FILES) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
