import core from '@actions/core';
import * as logging from '../utils/logging.js';

export const mockCConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(logging.cconsole)).forEach((key) => {
    if (typeof logging.cconsole[key] === 'function') {
      logging.cconsole[key] = vi.fn();
    }
  });
};

export const unMockCConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(logging.cconsole)).forEach((key) => {
    if (typeof console[key] === 'function' && typeof logging.cconsole[key].mockRestore === 'function') {
      logging.cconsole[key].mockRestore();
    }
  });
};

export const mockConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(console)).forEach((key) => {
    if (typeof console[key] === 'function') {
      console[key] = vi.fn();
    }
  });
};

export const unMockConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(console)).forEach((key) => {
    if (typeof console[key] === 'function' && typeof console[key].mockRestore === 'function') {
      console[key].mockRestore();
    }
  });
};

export const setupLoggingCallsTest = (logFunction, expectedArgs) => {
  if (!process.env.GITHUB_ACTIONS || process.env.GITHUB_ACTIONS === 'false') {
    expect(logging.cconsole[logFunction]).toHaveBeenCalled();
    expect(logging.cconsole[logFunction]).toHaveBeenCalledWith(...expectedArgs);
  } else {
    expect(core[logFunction]).toHaveBeenCalled();
    expect(core[logFunction]).toHaveBeenCalledWith(expectedArgs[1]);
  }
};
