import * as workspace from '../workspace/index.js';

const counters = {};
let id = 0;

export const mockWorkspaceDetect = (
  type,
  values = [
    {
      name: 'text-project',
      version: '0.5.0',
    },
  ],
) => {
  const mockId = id++;
  counters[mockId] = 0;
  return vi.spyOn(workspace[type], 'detect').mockImplementation((workspacePath) => {
    return Promise.resolve(values[counters[mockId]++]);
  });
};

export const mockWorkspace = (
  type,
  values = [
    {
      name: 'text-project',
      version: '0.5.0',
    },
  ],
) => {
  const mockId = id++;
  counters[mockId] = 0;
  return {
    detect: vi.spyOn(workspace[type], 'detect').mockImplementation((workspacePath) => {
      return Promise.resolve(values[counters[mockId]++]);
    }),
    updateVersion: vi.spyOn(workspace[type], 'updateVersion').mockImplementation((workspacePath) => {
      return Promise.resolve();
    }),
  };
};

export const unMockWorkspace = (mock) => {
  mock.detect.mockRestore();
  mock.updateVersion.mockRestore();
};
