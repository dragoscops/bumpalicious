import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detectVersion, detectName} from './python.js';
import {
  mockConfigFiles,
  setupDetectVersionTest,
  setupDetectVersionTestNoConfig,
  setupDetectNameTest,
  setupDetectNameTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {PYTHON_VERSION_FILES} from '../core/constants.js';

describe('detect/node.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    for (const configFile of PYTHON_VERSION_FILES.slice(0, -1)) {
      setupDetectVersionTest({configFile, detectVersion});
    }

    setupDetectVersionTestNoConfig({detectVersion});
  });

  describe('detectName()', () => {
    for (const configFile of PYTHON_VERSION_FILES.slice(0, -1)) {
      setupDetectNameTest({configFile, detectName});
    }

    setupDetectNameTestNoConfig({detectName});
  });
});
