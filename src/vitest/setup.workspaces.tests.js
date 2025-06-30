import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createJsonFile,
  createPythonPyProjectTomlFile,
  createTextVersionFile,
  oldVersion,
} from './setup.detect-update.tests';
import {createTempProjectFolder} from './setup.fs.test';
import {exec} from '../utils/exec.js';
import {logger} from '../utils/logging.js';

export const log = logger.child({module: `${projectName}/vitest`});

/**
 *
 * @return {string}
 */
export const createWorkspacesTestFolder = async (options) => {
  options = {
    workspaces: {
      node: {
        name: 'node-project',
        version: '0.0.1',
      },
      python: {
        name: 'python-project',
        version: '0.0.2',
      },
    },
  };

  const projectFolder = await createTempProjectFolder('workspace').then((folder) => folder.replace(/\\/g, '/'));
  const projectName = path.basename(projectFolder);

  // default text version
  await createTextVersionFile(path.join(projectFolder, 'version'));

  const created = [];
  for (const workspaceType in options.workspaces) {
    const project = options.workspaces[workspaceType];
    const workspacePath = path.join(projectFolder, project.name).replace(/\\/g, '/');
    await fs.mkdir(workspacePath, {recursive: true});

    const create =
      workspaceType === 'node'
        ? createJsonFile
        : workspaceType === 'python'
          ? createPythonPyProjectTomlFile
          : createTextVersionFile;

    await create(
      path.join(
        workspacePath,
        workspaceType === 'node' ? 'package.json' : workspaceType === 'python' ? 'pyproject.toml' : 'version',
      ),
      {name: project.name, version: project.version},
    );

    created.push({
      path: workspacePath,
      type: workspaceType,
      ...project,
    });
  }

  for (const command of [
    ['add', '.'],
    ['commit', '-am', 'chore: project init'],
    ['tag', '-a', `v${oldVersion}`, '-m', `init project with ${oldVersion} version`],
  ]) {
    const {exitCode} = await exec('git', command, {cwd: projectFolder});
    if (exitCode !== 0) {
      log.error({stderr, exitCode, command: ['git', ...command]}, 'Command failed');
      project.exit(1);
    }
  }
  return {
    ...options,
    projectFolder,
    projectName,
    created,
  };
};

export const updateAndCommit = async (paths = [], message = '') => {
  for (const p of paths) {
    await fs.writeFile(path.join(p, 'update.md'), Date.now().toString());
    for (const command of [
      ['add', '.'],
      ['commit', '-am', message || `updated ${Date.now()}`],
    ]) {
      await exec('git', command, {cwd: p});
    }
  }
};
