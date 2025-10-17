import core from '@actions/core';
import cp from 'node:child_process';
import { projectName } from '../constants.js';
import { logger } from './logging.js';

export const log = logger.child({ module: `${projectName}/utils/exec` });

/**
 * @typedef {import('child_process').SpawnOptions & { noThrow?: boolean }} ExecOptions
 */

/**
 * Executes a command in a child process and returns a promise that resolves with the command's output.
 *
 * @param {string} command - The command to execute.
 * @param {Array<string>} args - The arguments to pass to the command.
 * @param {ExecOptions} [options] - Options for the child process.
 */
export const exec = async (command, args, options) => {
  options = {
    cwd: exec.cwd,
    noThrow: false,
    ...options,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      ...(options?.env ?? {}),
    },
  };

  return new Promise((resolve, reject) => {
    const ps = cp.spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (data) => {
      stdout += data;
    });
    ps.stderr.on('data', (data) => {
      stderr += data;
    });
    ps.on('close', (exitCode) => {
      log.info({ command: `${command} ${args.join(' ')}`, stdout, stderr, exitCode, options }, 'exec command finished');
      if (exitCode !== 0 && options.noThrow === false) {
        const errorMessage = `Failed to run command: ${command} '${args.join("', '")}' with exit code ${exitCode}`;
        core.warning(errorMessage);
        log.warn({ command, args, options, stdout, stderr, exitCode }, errorMessage);
        // TODO: still not sure whether to reject when exec is failing; I would rather have the caller handle it
        // return reject(errorMessage);
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
};

/**
 * Sets the current working directory for the exec function.
 *
 * @param {string} cwd - The current working directory to set for the exec command.
 * @return {void}
 */
export const setCwd = (cwd) => {
  exec.cwd = cwd;
};

/**
 * Resets the current working directory for the exec function to the process's current working directory.
 */
export const resetCwd = () => {
  exec.cwd = process.cwd();
};

resetCwd();
