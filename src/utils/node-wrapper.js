import * as nfs from 'fs/promises';

export const fs = {};

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
