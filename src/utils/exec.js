import cp from 'child_process';

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
    ps.on('close', (code) => {
      resolve({stdout, stderr, exitCode: code});
    });
  });

export const setCwd = (cwd) => {
  exec.cwd = cwd;
};

export const resetCwd = () => {
  exec.cwd = process.cwd();
};

resetCwd();
