import {execa} from 'execa';
import fs from 'fs-extra';

process.exit = vi.fn();

// Mock toml module
vi.mock('@iarna/toml', () => {
  const def = {
    parse: vi.fn(),
  };

  return {...def, default: def};
});

vi.mock('fs-extra', async () => {
  const actual = await vi.importActual('fs-extra');
  const def = {
    ...actual,
    pathExists: vi.fn().mockImplementation((path) => Promise.resolve(path.endsWith(def.existingFile))),
    readJson: vi.fn(),
    readFile: vi.fn(),
    writeJson: vi.fn(),
    writeFile: vi.fn(),

    existingFile: '',
  };

  return {...def, default: def};
});

// Mock the execa module
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({stdout: ''}),
}));
