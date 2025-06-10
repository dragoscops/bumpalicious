import core from '@actions/core';
import fs from 'fs-extra';

process.exit = vi.fn();

vi.mock('@actions/core', () => {
  const actual = vi.importActual('@actions/core');

  const def = {
    ...actual,
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    notice: vi.fn(),
    startGroup: vi.fn(),
    endGroup: vi.fn(),
  };

  return {...def, default: def};
});
