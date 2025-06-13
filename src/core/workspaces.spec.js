import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import * as workspaces from './workspaces.js';
import * as changelog from '../utils/changelog.js';
import * as git from '../utils/git.js';
import { mockPino, unMockPino } from '../vitest/setup.logging.tests.js';
import { removeTempProjectFolder } from '../vitest/setup.fs.test.js';
import { createWorkspacesTestFolder, updateAndCommit } from '../vitest/setup.workspaces.tests.js';
import { oldVersion, projectNameValue } from '../vitest/setup.detect-update.tests.js';

import path from 'path';

describe('workspaces.js module', () => {
  let projectFolder = '';
  let projectName = '';
  let created = [];
  beforeEach(async () => {
    mockPino(workspaces.log);
    ({ created, projectFolder, projectName } = await createWorkspacesTestFolder());
  });

  afterEach(async () => {
    unMockPino(workspaces.log);
    // await removeTempProjectFolder(projectFolder);

    projectFolder = '';
    projectName = '';
  });

  describe.only('enrichWorkspace(string, string)', () => {
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
        { workspaceType: 'unknown', workspacePath: projectFolder },
        'Unknown workspace type, defaulting to text',
      );
      expect(result.type).toBe('unknown');
      expect(result.version).toBe(oldVersion);
    });
  });

  describe.only('enrichWorkspaces(Workspace[])', () => {
    it('enriches multiple workspaces', async () => {
      const result = await workspaces.enrichWorkspaces(created);

      expect(result).toEqual(created);
    });

    it('handles empty workspaces array', async () => {
      const result = await workspaces.enrichWorkspaces([]);
      expect(result).toEqual([]);
    });
  });

  describe.only('enrichChangedWorkspaces', () => {
    it('only enriches workspaces with changed files', async () => {
      await updateAndCommit([created[0].path]);

      const result = await workspaces.enrichChangedWorkspaces([...created], `v${oldVersion}`);

      expect(result).toEqual([{ ...created[0] }]);
    });

    it('returns empty array when no workspaces have changes', async () => {
      const result = await workspaces.enrichChangedWorkspaces([...created], `v${oldVersion}`);

      expect(result).toEqual([]);
    });
  });

  describe('increaseWorkspacesVersions', () => {
    beforeEach(() => {
      mockPino(workspaces.log);
    });

    afterEach(() => {
      unMockPino(workspaces.log);
    });

    it.only('increases versions based on commit message', async () => {
      await updateAndCommit([created[0].path]);

      console.log(created)

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
      const input = [{ path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0' }];
      mockPino(workspaces.log);

      try {
        const result = await workspaces.increaseVersionForWorkspaces({
          workspaces: input,
          commitMessage: 'feat: add new feature; pre-release: beta',
        });

        expect(workspaces.log.info).toHaveBeenCalledWith(
          {
            workspaceName: 'project1',
            oldVersion: '1.0.0',
            newVersion: '1.1.0-beta.0',
          },
          'Increasing workspace version',
        );
        expect(result[0].version).toBe('1.1.0-beta.0');
      } finally {
        unMockPino(workspaces.log);
      }
    });

    it('skips version increase when commit message does not indicate change', async () => {
      const input = [{ path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0' }];

      const result = await workspaces.increaseVersionForWorkspaces({
        workspaces: input,
        commitMessage: 'docs: update readme',
      });

      expect(result).toEqual([]);
    });
  });

  describe('updateWorkspacesVersions(Workspace[])', () => {
    beforeEach(() => {
      mockPino(workspaces.log);
      vi.spyOn(process, 'chdir').mockImplementation(() => { });
    });

    afterEach(() => {
      unMockPino(workspaces.log);
    });

    it('updates versions for supported workspace types', async () => {
      const workspacesArray = [
        { path: '/test/workspace1', name: 'node-project', type: 'node', version: '1.1.0' },
        { path: '/test/workspace2', name: 'python-project', type: 'python', version: '0.5.0' },
      ];

      const updateMocks = {
        node: mockWorkspace('node'),
        python: mockWorkspace('python'),
      };

      try {
        const result = await workspaces.updateVersionsForWorkspaces(workspacesArray);

        // Verify update was called for each workspace
        expect(updateMocks.node.update).toHaveBeenCalledWith(expect.stringContaining('test/workspace1'), '1.1.0');
        expect(updateMocks.python.update).toHaveBeenCalledWith(expect.stringContaining('test/workspace2'), '0.5.0');

        // Verify the result contains the updated workspaces
        expect(result).toEqual(workspacesArray);
      } finally {
        unMockWorkspace(updateMocks.node);
        unMockWorkspace(updateMocks.python);
      }
    });

    it('falls back to text updater for unsupported workspace types', async () => {
      const workspacesArray = [{ path: '/test/workspace', name: 'unknown-project', type: 'unknown', version: '1.0.0' }];

      const updateMock = mockWorkspace('text', {});

      try {
        const result = await workspaces.updateVersionsForWorkspaces(workspacesArray);

        // Verify text update was called
        expect(updateMock.update).toHaveBeenCalledWith(expect.stringContaining('test/workspace'), '1.0.0');

        // Verify result contains the updated workspace
        expect(result).toEqual(workspacesArray);
      } finally {
        unMockWorkspace(updateMock);
      }
    });

    describe('updateVersionsForWorkspaces(Workspace[])', () => {
      let gwc = null;
      beforeEach(() => {
        mockPino(workspaces.log);
        gwc = vi.spyOn(changelog, 'generateWorkspaceChangelog').mockResolvedValue();
      });
      afterEach(() => {
        unMockPino(workspaces.log);
        gwc.mockRestore();

        vi.restoreAllMocks();
      });

      it('updates versions and generates changelogs for all workspaces', async () => {
        const input = [
          { path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0' },
          { path: '/test/workspace2', type: 'python', name: 'project2', version: '2.0.0' },
        ];
        vi.spyOn(process, 'chdir').mockImplementation(() => { });

        const updateMock = {
          node: mockWorkspace('node', {}),
          python: mockWorkspace('python', {}),
        };

        const result = await workspaces.updateVersionsForWorkspaces(input, { generateChangelog: true });
        expect(updateMock.node.update).toHaveBeenCalledWith('/test/workspace1', '1.0.0');
        expect(updateMock.python.update).toHaveBeenCalledWith('/test/workspace2', '2.0.0');
        expect(changelog.generateWorkspaceChangelog).toHaveBeenCalledTimes(2);
        expect(result).toEqual(input);
      });

      it('skips changelog generation when option is disabled', async () => {
        const input = [{ path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0' }];
        vi.spyOn(process, 'chdir').mockImplementation(() => { });

        const nodeMock = mockWorkspace('node', {});

        const changelog = await import('../utils/changelog.js');
        const result = await workspaces.updateVersionsForWorkspaces(input, { generateChangelog: false });
        expect(nodeMock.update).toHaveBeenCalledWith('/test/workspace1', '1.0.0');
        expect(changelog.generateWorkspaceChangelog).not.toHaveBeenCalled();
        expect(result).toEqual(input);
      });
    });
  });

  describe('generateChangelogsForChangedWorkspaces', () => {
    let gwc = null;
    beforeEach(() => {
      mockConsole();
      mockCConsole();
      gwc = vi.spyOn(changelog, 'generateWorkspaceChangelog').mockResolvedValue();
    });

    afterEach(() => {
      unMockCConsole();
      unMockConsole();
      gwc.mockRestore();

      vi.restoreAllMocks();
    });

    it('generates changelogs for changed workspaces', async () => {
      const input = [
        { path: '/test/workspace1', type: 'node' },
        { path: '/test/workspace2', type: 'python' },
      ];

      // Mock enrichChangedWorkspaces to return workspaces
      vi.spyOn(workspaces, 'enrichChangedWorkspaces').mockResolvedValue([
        { path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0' },
        { path: '/test/workspace2', type: 'python', name: 'project2', version: '2.0.0' },
      ]);

      try {
        const result = await workspaces.generateChangelogsForChangedWorkspaces(input, 'v1.0.0', {
          preset: 'conventionalcommits',
          append: true,
        });

        expect(workspaces.enrichChangedWorkspaces).toHaveBeenCalledWith(input, 'v1.0.0');
        expect(changelog.generateWorkspacesChangelogs).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ name: 'project1' }),
            expect.objectContaining({ name: 'project2' }),
          ]),
          { preset: 'conventionalcommits', append: true },
        );
        expect(result.length).toBe(2);
      } finally {
        workspaces.enrichChangedWorkspaces.mockRestore();
      }
    });

    // it('returns empty array when no workspaces have changed', async () => {
    //   const input = [
    //     {path: '/test/workspace1', type: 'node'},
    //     {path: '/test/workspace2', type: 'python'},
    //   ];

    //   // Mock enrichChangedWorkspaces to return empty array
    //   vi.spyOn(workspaces, 'enrichChangedWorkspaces').mockResolvedValue([]);

    //   const changelog = await import('../utils/changelog.js');

    //   const result = await workspaces.generateChangelogsForChangedWorkspaces(input, 'v1.0.0');

    //   expect(workspaces.enrichChangedWorkspaces).toHaveBeenCalledWith(input, 'v1.0.0');
    //   expect(changelog.generateWorkspacesChangelogs).not.toHaveBeenCalled();
    //   expect(result).toEqual([]);
    // });
  });
});
