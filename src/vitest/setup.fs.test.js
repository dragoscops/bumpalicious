import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {exec} from '../utils/exec';

/**
 * Creates a temporary folder for testing purposes.
 *
 * @param {string} prefix - Prefix for the temporary folder name, defaults to 'node'.
 * @returns {Promise<string>} - A promise that resolves to the path of the created temporary folder.
 */
export const createTempProjectFolder = async (prefix = 'node') => {
  let tempDir = await fs.mkdtemp(path.join(tmpdir(), `${prefix}-`));
  tempDir = await fs.realpath(tempDir);

  for (const args of [['config', '--global', 'init.defaultBranch', 'main'], ['init']]) {
    await exec('git', args, {cwd: tempDir});
  }

  await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\nThis is a test project.');

  return tempDir;
};

export const removeTempProjectFolder = async (folderPath) => {
  if (folderPath) {
    return fs.rm(folderPath, {recursive: true});
  }
};
