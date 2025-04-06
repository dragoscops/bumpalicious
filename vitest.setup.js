import core from '@actions/core';
import {execa} from 'execa';
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

vi.mock('fs-extra', async () => {
  const actual = await vi.importActual('fs-extra');
  const def = {
    ...actual,
    pathExists: vi.fn().mockImplementation((path) => Promise.resolve(path.endsWith(def.existingFile))),
    // pathExists: vi.fn().mockImplementation((path) => {
    //   console.log(path, def.existingFile, path.endsWith(def.existingFile))
    //   return Promise.resolve(path.endsWith(def.existingFile))
    // }),
    readJson: vi.fn(),
    readFile: vi.fn(),
    writeJson: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),

    existingFile: '',
  };

  return {...def, default: def};
});

// Mock the execa module
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({stdout: ''}),
}));
