import cp from 'child_process';
import {logger} from './logging.js';
import core from '@actions/core';

export const log = logger.child({module: 'utils/exec'});

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
      log.info(
        {command: `${command} ${args.join(' ')}`, stdout, stderr, code: exitCode, options},
        'exec command finished',
      );
      if (command === 'git' && exitCode !== 0) {
        core.error('Failed to run git command');
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
