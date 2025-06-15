import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';

import * as workspaces from './workspaces.js';
import * as changelog from '../utils/changelog.js';
import * as git from '../utils/git.js';
import * as exec from '../utils/exec.js';
import * as version from './version.js';
import * as detect from './version/detect.js';
import * as update from './version/update.js';
import {mockPinoIn, unMockPinoIn} from '../vitest/setup.logging.tests.js';
import {removeTempProjectFolder} from '../vitest/setup.fs.test.js';
import {createWorkspacesTestFolder, updateAndCommit} from '../vitest/setup.workspaces.tests.js';
import {oldVersion, projectNameValue} from '../vitest/setup.detect-update.tests.js';

import path from 'path';

const logs = [workspaces, git, exec, changelog, version, detect, update];

describe('workspaces.js module', () => {
  let projectFolder = '';
  let projectName = '';
  let created = [];
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn([
      'core/version',
      'core/version/detect',
      'core/version/update',
      'core/workspaces',
      'utils/changelog',
    ]);
    ({created, projectFolder, projectName} = await createWorkspacesTestFolder());
  });

  afterEach(async () => {
    unMockPinoIn(logMocks);
    await removeTempProjectFolder(projectFolder);

    projectFolder = '';
    projectName = '';
  });

  describe('enrichWorkspace(string, string)', () => {
    it('detects workspace details using the appropriate detector', async () => {
      const nodeWorkspace = path.join(projectFolder, 'node-project');
      const result = await workspaces.enrichWorkspace(nodeWorkspace, 'node');

      expect(result).toEqual(created[0]);
    });

    it('falls back to directory name when name detection fails', async () => {
      const result = await workspaces.enrichWorkspace(projectFolder, 'node');

      expect(result.name).toBe(projectName);
    });

    it('falls back to null version when version detection fails', async () => {
      const result = await workspaces.enrichWorkspace(projectFolder, 'node');

      expect(result.version).toBe(null);
    });

    it('handles unknown workspace type by falling back to text', async () => {
      const result = await workspaces.enrichWorkspace(projectFolder, 'unknown');

      expect(workspaces.log.warn).toHaveBeenCalledWith(
        {workspaceType: 'unknown', workspacePath: projectFolder},
        'Unknown workspace type, defaulting to text',
      );
      expect(result.type).toBe('unknown');
      expect(result.version).toBe(oldVersion);
    });
  });

  describe('enrichWorkspaces(Workspace[])', () => {
    it('enriches multiple workspaces', async () => {
      const result = await workspaces.enrichWorkspaces(created);

      expect(result).toEqual(created);
    });

    it('handles empty workspaces array', async () => {
      const result = await workspaces.enrichWorkspaces([]);
      expect(result).toEqual([]);
    });
  });

  describe('enrichChangedWorkspaces', () => {
    it.only('only enriches workspaces with changed files', async () => {
      await updateAndCommit([created[0].path]);

      const result = await workspaces.enrichChangedWorkspaces(created, `v${oldVersion}`);

      expect(result).toEqual([{...created[0]}]);
    });

    it('returns empty array when no workspaces have changes', async () => {
      const result = await workspaces.enrichChangedWorkspaces(created, `v${oldVersion}`);

      expect(result).toEqual([]);
    });
  });

  describe('increaseWorkspacesVersions', () => {
    it('increases versions based on commit message', async () => {
      await updateAndCommit([created[0].path]);

      const result = await workspaces.increaseVersionForWorkspaces({
        workspaces: created,
        commitMessage: 'feat: add new feature',
      });

      expect(result).toEqual([
        {
          ...created[0],
          version: '0.1.0',
        },
        {
          ...created[1],
          version: '0.1.0',
        },
      ]);
    });

    it('handles pre-release identifiers in commit message', async () => {
      await updateAndCommit([created[0].path]);
      const result = await workspaces.increaseVersionForWorkspaces({
        workspaces: [created[0]],
        commitMessage: 'feat: add new feature; pre-release: beta',
      });

      expect(workspaces.log.info).toHaveBeenCalledWith(
        {
          workspaceName: created[0].name,
          oldVersion: '0.0.1',
          newVersion: '0.1.0-beta.0',
        },
        'Increasing workspace version',
      );
      expect(result[0].version).toBe('0.1.0-beta.0');
    });

    it('skips version increase when commit message does not indicate change', async () => {
      await updateAndCommit([created[0].path]);

      const result = await workspaces.increaseVersionForWorkspaces({
        workspaces: [created[0]],
        commitMessage: 'docs: update readme',
      });

      expect(result).toEqual([]);
    });
  });

  describe('updateVersionsForWorkspaces(Workspace[])', () => {
    it('updates versions for supported workspace types', async () => {
      await updateAndCommit([created[0].path, created[1].path]);

      created[0].version = '0.1.0';
      created[1].version = '0.1.0';

      const result = await workspaces.updateVersionsForWorkspaces(created);

      expect(result).toEqual([
        {...created[0], version: '0.1.0'},
        {...created[1], version: '0.1.0'},
      ]);
    });

    it('falls back to text updater for unsupported workspace types', async () => {
      const workspacesArray = [
        {
          path: projectFolder,
          name: projectName,
          type: 'unknown',
          version: '2.0.0',
        },
      ];

      const result = await workspaces.updateVersionsForWorkspaces(workspacesArray);

      // Verify result contains the updated workspace
      expect(result).toEqual(workspacesArray);
    });

    it('updates versions and generates changelogs for all workspaces', async () => {
      vi.spyOn(changelog, 'generateWorkspaceChangelog').mockResolvedValue();

      try {
        const result = await workspaces.updateVersionsForWorkspaces(created, {generateChangelog: true});

        expect(changelog.generateWorkspaceChangelog).toHaveBeenCalledTimes(2);
        expect(result).toEqual(created);
      } finally {
        changelog.generateWorkspaceChangelog.mockRestore();
      }
    });

    it('skips changelog generation when option is disabled', async () => {
      vi.spyOn(changelog, 'generateWorkspaceChangelog').mockResolvedValue();

      try {
        const result = await workspaces.updateVersionsForWorkspaces(created, {generateChangelog: false});

        expect(changelog.generateWorkspaceChangelog).not.toHaveBeenCalled();
        expect(result).toEqual(created);
      } finally {
        changelog.generateWorkspaceChangelog.mockRestore();
      }
    });
  });

  describe('generateChangelogsForChangedWorkspaces', () => {
    it('generates changelogs for changed workspaces', async () => {
      await updateAndCommit(created.map((c) => c.path));
      const lastTag = `v${oldVersion}`;

      vi.spyOn(changelog, 'generateWorkspacesChangelogs');

      try {
        const result = await workspaces.generateChangelogsForChangedWorkspaces(created, lastTag, {
          preset: 'conventionalcommits',
          append: true,
        });

        expect(changelog.generateWorkspacesChangelogs).toHaveBeenCalledWith(created, {
          preset: 'conventionalcommits',
          append: true,
        });
        expect(result.length).toBe(2);
      } finally {
        changelog.generateWorkspacesChangelogs.mockRestore();
      }
    });

    it('returns empty array when no workspaces have changed', async () => {
      vi.spyOn(changelog, 'generateWorkspacesChangelogs');
      const lastTag = `v${oldVersion}`;

      try {
        const result = await workspaces.generateChangelogsForChangedWorkspaces(created, lastTag);

        expect(changelog.generateWorkspacesChangelogs).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      } finally {
        changelog.generateWorkspacesChangelogs.mockRestore();
      }
    });
  });
});
