import {execa} from 'execa';
import fs from 'fs/promises';
import path from 'path';
import {tmpdir} from 'os';

/**
 * Creates a temporary folder for testing purposes.
 *
 * @param {string} prefix - Prefix for the temporary folder name, defaults to 'node'.
 * @returns {Promise<string>} - A promise that resolves to the path of the created temporary folder.
 */
export const createTempProjectFolder = async (prefix = 'node') => {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), `${prefix}-`));
  await execa(['git', 'init'], {cwd: tempDir});
  await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\nThis is a test project.');
  return tempDir;
};

export const removeTempProjectFolder = async (folderPath) => {
  if (folderPath) {
    return fs.rm(folderPath, {recursive: true});
  }
};
