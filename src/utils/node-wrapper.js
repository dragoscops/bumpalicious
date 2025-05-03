import * as afs from 'fs/promises';
import * as astream from 'stream/promises';

import * as nfs from 'fs';

export const fs = {
  async: {},
  /** @type import('fs').createWriteStream */
  createWriteStream: (...args) => nfs.createWriteStream(...args),
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

export const stream = {
  async: {
    /** @type import('stream/promises').pipeline */
    pipeline: (...args) => astream.pipeline(...args),
  },
};

// Object.entries(astream).forEach(([key, value]) => {
//   if (typeof value === 'function') {
//     stream.async[key] = async (...args) => {
//       return value(...args).catch((error) => {
//         console.error(`Error in ${key}:`, error);
//         throw error;
//       });
//     };
//   } else {
//     stream.async[key] = value;
//   }
// });
