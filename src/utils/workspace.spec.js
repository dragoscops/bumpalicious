import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';

import * as workspace from './workspace.js';

describe('workspace.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(process, 'chdir').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('stringToWorkspace', () => {
    it('will parse path and type', async () => {
      const result = workspace.stringToWorkspace('.:text');

      expect(result).toEqual({path: '.', type: 'text'});
    });

    it('will parse all 4 params', async () => {
      const result = workspace.stringToWorkspace('.:text:project:1.0.0');

      expect(result).toEqual({
        name: 'project',
        path: '.',
        type: 'text',
        version: '1.0.0',
      });
    });

    it('will handle empty string', () => {
      const result = workspace.stringToWorkspace('');

      expect(result).toEqual({
        path: '',
      });
    });

    it('will handle only path', () => {
      const result = workspace.stringToWorkspace('/path/to/workspace');

      expect(result).toEqual({path: '/path/to/workspace'});
    });
  });
});
