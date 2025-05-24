import * as core from '@actions/core';
import * as logging from '../utils/logging.js';

export const mockCConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(logging.cconsole)).forEach((key) => {
    if (typeof logging.cconsole[key] === 'function') {
      vi.spyOn(logging.cconsole, key).mockImplementation((...args) => {});
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
      vi.spyOn(console, key).mockImplementation((...args) => {});
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

export const setupLoggingCallsTest = (logFunction, expectedArgs, nth = 0) => {
  if (!process.env.GITHUB_ACTIONS || process.env.GITHUB_ACTIONS === 'false') {
    expect(logging.cconsole[logFunction]).toHaveBeenCalled();
    if (nth === 0) {
      expect(logging.cconsole[logFunction]).toHaveBeenCalledWith(...expectedArgs);
    } else {
      expect(logging.cconsole[logFunction]).toHaveBeenNthCalledWith(nth, ...expectedArgs);
    }
  } else {
    expect(core[logFunction]).toHaveBeenCalled();

    if (nth === 0) {
      expect(core[logFunction]).toHaveBeenCalledWith(expectedArgs[1]);
    } else {
      expect(core[logFunction]).toHaveBeenNthCalledWith(nth, expectedArgs[1]);
    }
  }
};
