import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detectVersion, detectName} from './rust.js';
import {
  mockConfigFiles,
  setupDetectVersionTest,
  setupDetectVersionTestNoConfig,
  setupDetectNameTest,
  setupDetectNameTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {RUST_VERSION_FILES} from '../core/constants.js';

describe('detect/node.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    for (const configFile of RUST_VERSION_FILES) {
      setupDetectVersionTest({configFile, detectVersion});
    }

    setupDetectVersionTestNoConfig({detectVersion});
  });

  describe('detectName()', () => {
    for (const configFile of RUST_VERSION_FILES) {
      setupDetectNameTest({configFile, detectName});
    }

    setupDetectNameTestNoConfig({detectName});
  });
});
