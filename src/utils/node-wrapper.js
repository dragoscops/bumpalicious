import * as afs from 'fs/promises';
import * as astream from 'stream/promises';

import * as nfs from 'fs';

export const fs = {
  async: {},
};

Object.entries(afs).forEach(([key, value]) => {
  if (typeof value === 'function') {
    fs.async[key] = async (...args) => {
      return value(...args).catch((error) => {
        console.error(`Error in ${key}:`, error);
        throw error;
      });
    };
  } else {
    fs.async[key] = value;
  }
});

Object.entries(nfs).forEach(([key, value]) => {
  if (typeof value === 'function') {
    fs[key] = (...args) => {
      return value(...args).catch((error) => {
        console.error(`Error in ${key}:`, error);
        throw error;
      });
    };
  } else {
    fs[key] = value;
  }
});

export const stream = {
  async: {},
};

Object.entries(astream).forEach(([key, value]) => {
  if (typeof value === 'function') {
    stream.async[key] = async (...args) => {
      return value(...args).catch((error) => {
        console.error(`Error in ${key}:`, error);
        throw error;
      });
    };
  } else {
    stream.async[key] = value;
  }
});
