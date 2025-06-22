import * as logging from '../utils/logging.js';
import {vi} from 'vitest';
import path from 'path';

const pinoMethods = ['debug', 'info', 'warn', 'error', 'fatal', 'trace'];

export const mockPino = (logger = logging.logger, filter = '*') => {
  pinoMethods.forEach((key) => {
    if (typeof logger[key] === 'function') {
      const mocked = vi.spyOn(logger, key);
      if (!process.env.DEBUG?.includes(`log:${filter}`) && !process.env.DEBUG?.includes(`log:*`)) {
        mocked.mockImplementation((...args) => {});
      }
    }
  });
};

export const unMockPino = (logger = logging.logger) => {
  pinoMethods.forEach((key) => {
    if (typeof logger[key] === 'function' && typeof logger[key].mockRestore === 'function') {
      logger[key].mockRestore();
    }
  });
};

/**
 *
 *
 */
export const mockPinoIn = async (modules = []) => {
  return Promise.all(
    ['utils/exec', 'utils/git', 'utils/fs', ...modules].map(async (mod) => {
      // - HACKy - should be `../${mod}.js`
      // For some reason, vitest import behaves differently
      // console.log(`../${mod}`);
      let imod = null;
      try {
        imod = await import(`../${mod}.js`);
      } catch (e) {
        imod = await import(`../${mod}`);
      }
      // console.log(mod, imod);
      // HACKy end
      mockPino(imod.log, path.basename(mod));
      return imod;
    }),
  );
};

export const unMockPinoIn = (modules = []) => {
  modules.forEach((mod) => {
    unMockPino(mod.log);
  });
};

export const setupPinoLoggingCallsTest = (logFunction, expectedArgs, logger = logging.logger, nth = 0) => {
  expect(logger[logFunction]).toHaveBeenCalled();
  if (nth === 0) {
    expect(logger[logFunction]).toHaveBeenCalledWith(...expectedArgs);
  } else {
    expect(logger[logFunction]).toHaveBeenNthCalledWith(nth, ...expectedArgs);
  }
};
