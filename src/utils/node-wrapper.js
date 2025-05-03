import * as afs from 'fs/promises';
import * as astream from 'stream/promises';

import * as nfs from 'fs';

export const fs = {
  async: {
    /** @type typeof import('fs/promises').access */
    access: async (...args) => afs.access(...args),
    /** @type typeof import('fs/promises').readFile */
    readFile: async (...args) => afs.readFile(...args),
    /** @type typeof import('fs/promises').writeFile */
    writeFile: async (...args) => afs.writeFile(...args),
    /** @type typeof import('fs/promises').unlink */
    unlink: async (...args) => afs.unlink(...args),
  },
  /** @type typeof import('fs').createWriteStream */
  createWriteStream: (...args) => nfs.createWriteStream(...args),

  /** @type typeof import('fs').constants / */
  constants: nfs.constants,
};

// Object.entries(afs).forEach(([key, value]) => {
//   if (typeof value === 'function') {
//     fs.async[key] = async (...args) => {
//       return value(...args).catch((error) => {
//         console.error(`Error in ${key}:`, error);
//         throw error;
//       });
//     };
//   } else {
//     fs.async[key] = value;
//   }
// });

export const stream = {
  async: {
    /** @type typeof import('stream/promises').pipeline */
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
