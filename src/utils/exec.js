import cp from 'node:child_process';
import core from '@actions/core';
import {logger} from './logging.js';
import {projectName} from '../constants.js';

export const log = logger.child({module: `${projectName}/utils/exec`});

/**
 * @typedef {import('child_process').SpawnOptions} ExecOptions
 */

/**
 * Executes a command in a child process and returns a promise that resolves with the command's output.
 *
 * @param {string} command - The command to execute.
 * @param {Array<string>} args - The arguments to pass to the command.
 * @param {ExecOptions} [options] - Options for the child process.
 */
export const exec = async (command, args, options) =>
  new Promise((resolve) => {
    const ps = cp.spawn(command, args, {
      cwd: exec.cwd,
      ...options,
    });
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (data) => {
      stdout += data;
    });
    ps.stderr.on('data', (data) => {
      stderr += data;
    });
    ps.on('close', (exitCode) => {
      log.info({command: `${command} ${args.join(' ')}`, stdout, stderr, exitCode, options}, 'exec command finished');
      if (exitCode !== 0) {
        core.setFailed(`Failed to run command: ${command} '${args.join("', '")}'`);
      }
      resolve({stdout, stderr, exitCode});
    });
  });

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
