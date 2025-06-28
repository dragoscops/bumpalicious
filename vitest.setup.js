import core from '@actions/core';
import fs from 'fs-extra';

process.exit = vi.fn();

vi.mock('@actions/core', () => {
  const actual = vi.importActual('@actions/core');

  const def = {
    ...actual,
    getInput: vi.fn((name, _options) => {
      if (name === 'pr_version_prefix') {
        return 'version_bump';
      }
      return 'value';
    }),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    notice: vi.fn(),
    startGroup: vi.fn(),
    endGroup: vi.fn(),
    setFailed: vi.fn(),
  };

  return { ...def, default: def };
});
