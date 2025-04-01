import fs from 'fs-extra';
import {describe, beforeAll, vi, afterAll} from 'vitest';
import {detectVersion, detectName} from './go.js';
import {
  mockConfigFiles,
  setupDetectVersionTest,
  setupDetectVersionTestNoConfig,
  setupDetectNameTest,
  setupDetectNameTestNoConfig,
  projectPath,
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

  describe('detectVersion()', () => {
    setupDetectVersionTest({configFile: GO_VERSION_FILES[0], detectVersion});

    for (const configFile of GO_VERSION_FILES.slice(1, -1)) {
      setupDetectVersionTest({configFile, detectVersion});
    }

    setupDetectVersionTestNoConfig({detectVersion});
  });

  describe('detectName()', () => {
    setupDetectNameTest({configFile: GO_VERSION_FILES[0], detectName, projectName: 'github.com/project'});

    setupDetectNameTestNoConfig({detectName});
  });
});
