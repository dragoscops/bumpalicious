import {describe, it, expect, beforeEach, vi, afterAll, beforeAll, afterEach} from 'vitest';

import * as github from './github.js';

describe.skip('github.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(process, 'chdir').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('stringToWorkspace', () => {});
});
