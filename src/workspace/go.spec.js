import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detect, updateVersion} from './go.js';
import {
  mockConfigFiles,
  setupDetectTest,
  setupDetectTestNoConfig,
  setupUpdateVersionTest,
  setupUpdateVersionTestNoConfig,
} from '../vitest/setup.detect-update.tests.js';
import {GO_VERSION_FILES} from '../core/constants.js';

describe('detect/go.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detect()', () => {
    setupDetectTest({configFile: GO_VERSION_FILES[0], detect, projectName: 'github.com/project'});

    for (const configFile of GO_VERSION_FILES.slice(1, -1)) {
      setupDetectTest({configFile, detect});
    }

    setupDetectTestNoConfig({detect});
  });

  describe('updateVersion()', () => {
    for (const configFile of GO_VERSION_FILES.slice(0, -1)) {
      setupUpdateVersionTest({configFile, updateVersion});
    }

    setupUpdateVersionTestNoConfig({updateVersion});
  });
});
