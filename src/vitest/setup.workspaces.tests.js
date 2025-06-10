import {
  createJsonFile,
  createPythonPyProjectTomlFile,
  createTextVersionFile,
  oldVersion,
} from './setup.detect-update.tests';
import {createTempProjectFolder} from './setup.fs.test';

import path from 'path';
import fs from 'fs/promises';
import {exec} from '../utils/exec.js';

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

  const projectFolder = await createTempProjectFolder('workspace');
  const projectName = path.basename(projectFolder);

  // default text version
  await createTextVersionFile(path.join(projectFolder, 'version'));

  const created = [];
  for (const workspaceType in options.workspaces) {
    const project = options.workspaces[workspaceType];
    const workspacePath = path.join(projectFolder, project.name);
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
    await exec('git', command, {cwd: projectFolder});
  }
  return {
    ...options,
    projectFolder,
    projectName,
    created,
  };
};

export const updateAndCommit = async (paths = []) => {
  for (const p of paths) {
    await fs.writeFile(path.join(p, 'update.md'), Date.now().toString());
    for (const command of [
      ['add', '.'],
      ['commit', '-am', `updated ${Date.now()}`],
    ]) {
      await exec('git', command, {cwd: p});
    }
  }
};
