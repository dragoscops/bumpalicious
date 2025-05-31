import * as logging from '../utils/logging.js';
import {vi} from 'vitest';

const pinoMethods = ['debug', 'info', 'warn', 'error', 'fatal', 'trace'];

export const mockPino = (logger = logging.logger) => {
  pinoMethods.forEach((key) => {
    if (typeof logger[key] === 'function') {
      vi.spyOn(logger, key).mockImplementation((...args) => {});
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

export const setupPinoLoggingCallsTest = (logFunction, expectedArgs, logger = logging.logger, nth = 0) => {
  expect(logger[logFunction]).toHaveBeenCalled();
  if (nth === 0) {
    expect(logger[logFunction]).toHaveBeenCalledWith(...expectedArgs);
  } else {
    expect(logger[logFunction]).toHaveBeenNthCalledWith(nth, ...expectedArgs);
  }
};
