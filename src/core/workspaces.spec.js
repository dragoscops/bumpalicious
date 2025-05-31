import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';

import * as workspaces from './workspaces.js';
import * as changelog from '../utils/changelog.js';
import * as git from '../utils/git.js';
import {mockPino, unMockPino} from '../vitest/setup.logging.tests.js';
import {mockWorkspaceDetect, mockWorkspace, unMockWorkspace} from '../vitest/setup.workspace.tests.js';

describe('workspace.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(process, 'chdir').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('enrichWorkspace(string, string)', () => {
    beforeEach(() => {
      mockPino(workspaces.log);
    });

    afterEach(() => {
      unMockPino(workspaces.log);
    });

    it('detects workspace details using the appropriate detector', async () => {
      const workspacePath = '/test/workspace';
      const workspaceType = 'node';
      const detectMock = mockWorkspace('node', [
        {
          name: 'test-project',
          version: '1.0.0',
        },
      ]);

      try {
        const result = await workspaces.enrichWorkspace(workspacePath, workspaceType);

        expect(detectMock.detect).toHaveBeenCalledWith(expect.stringContaining('test\\workspace'));
        expect(result).toEqual({
          path: expect.stringContaining('test\\workspace'),
          type: workspaceType,
          name: 'test-project',
          version: '1.0.0',
        });
      } finally {
        unMockWorkspace(detectMock);
      }
    });

    it('falls back to directory name when name detection fails', async () => {
      const workspacePath = '/test/awesome-project';
      const workspaceType = 'node';
      const detectMock = mockWorkspaceDetect('node', [
        {
          name: '',
          version: '1.0.0',
        },
      ]);

      try {
        const result = await workspaces.enrichWorkspace(workspacePath, workspaceType);

        expect(detectMock).toHaveBeenCalled();
        expect(result.name).toBe('awesome-project');
      } finally {
        detectMock.mockRestore();
      }
    });

    it('falls back to default version when version detection fails', async () => {
      const workspacePath = '/test/workspace';
      const workspaceType = 'node';
      const detectMock = mockWorkspaceDetect('node', [
        {
          name: 'test-project',
          version: '',
        },
      ]);

      try {
        const result = await workspaces.enrichWorkspace(workspacePath, workspaceType);

        expect(result.version).toBe('');
      } finally {
        detectMock.mockRestore();
      }
    });

    it('handles unknown workspace type by falling back to text', async () => {
      const workspacePath = '/test/workspace';
      const workspaceType = 'unknown';
      mockPino(workspaces.log);
      const detectMock = mockWorkspaceDetect('text', [
        {
          name: 'text-project',
          version: '0.5.0',
        },
      ]);

      try {
        const result = await workspaces.enrichWorkspace(workspacePath, workspaceType);

        expect(workspaces.log.warn).toHaveBeenCalledWith(
          {workspaceType: 'unknown', workspacePath: expect.stringContaining('test\\workspace')},
          'Unknown workspace type, defaulting to text',
        );
        expect(result.type).toBe('unknown');
      } finally {
        detectMock.mockRestore();
        unMockPino(workspaces.log);
      }
    });
  });

  describe('enrichWorkspaces(Workspace[])', () => {
    it('enriches multiple workspaces', async () => {
      const input = [
        {path: '/test/workspace1', type: 'node'},
        {path: '/test/workspace2', type: 'python'},
      ];
      const detectMocks = {
        node: mockWorkspaceDetect('node', [
          {
            name: 'node-project',
            version: '0.5.0',
          },
        ]),
        python: mockWorkspaceDetect('python', [
          {
            name: 'python-project',
            version: '0.6.0',
          },
        ]),
      };

      try {
        const result = await workspaces.enrichWorkspaces(input);

        expect(detectMocks.node).toHaveBeenCalledWith(expect.stringContaining('test\\workspace1'));
        expect(detectMocks.python).toHaveBeenCalledWith(expect.stringContaining('test\\workspace2'));

        expect(result).toEqual([
          {path: expect.stringContaining('test\\workspace1'), type: 'node', name: 'node-project', version: '0.5.0'},
          {path: expect.stringContaining('test\\workspace2'), type: 'python', name: 'python-project', version: '0.6.0'},
        ]);
      } finally {
        detectMocks.node.mockRestore();
        detectMocks.python.mockRestore();
      }
    });

    it('handles empty workspaces array', async () => {
      const result = await workspaces.enrichWorkspaces([]);
      expect(result).toEqual([]);
    });
  });

  describe('enrichChangedWorkspaces', () => {
    beforeEach(() => {
      mockPino(workspaces.log);
    });

    afterEach(() => {
      unMockPino(workspaces.log);
    });

    it('only enriches workspaces with changed files', async () => {
      const input = [
        {path: '/test/workspace1', type: 'node'},
        {path: '/test/workspace2', type: 'python'},
      ];
      const detectMocks = {
        node: mockWorkspaceDetect('node', [
          {
            name: 'node-project',
            version: '1.0.0',
          },
        ]),
        python: mockWorkspaceDetect('python', [
          {
            name: 'python-project',
            version: '0.6.0',
          },
        ]),
      };
      vi.spyOn(git, 'getChangedFiles').mockImplementation((path) => {
        if (path.includes('workspace1')) {
          return Promise.resolve(['file1.js', 'file2.js']);
        }
        return Promise.resolve([]);
      });

      try {
        const result = await workspaces.enrichChangedWorkspaces(input, 'v1.0.0');

        expect(detectMocks.node).toHaveBeenCalledWith(expect.stringContaining('test\\workspace1'));

        expect(result).toEqual([{path: expect.stringContaining('test\\workspace1'), type: 'node', name: 'node-project', version: '1.0.0'}]);
      } finally {
        detectMocks.node.mockRestore();
        detectMocks.python.mockRestore();
        git.getChangedFiles.mockRestore();
      }
    });

    it('returns empty array when no workspaces have changes', async () => {
      const input = [
        {path: '/test/workspace1', type: 'node'},
        {path: '/test/workspace2', type: 'python'},
      ];
      vi.spyOn(git, 'getChangedFiles').mockResolvedValue([]);

      try {
        const result = await workspaces.enrichChangedWorkspaces(input, 'v1.0.0');

        expect(result).toEqual([]);
      } finally {
        git.getChangedFiles.mockRestore();
      }
    });
  });

  describe('increaseWorkspacesVersions', () => {
    beforeEach(() => {
      mockPino(workspaces.log);
    });

    afterEach(() => {
      unMockPino(workspaces.log);
    });

    it('increases versions based on commit message', async () => {
      const input = [
        {path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'},
        {path: '/test/workspace2', type: 'python', name: 'project2', version: '2.3.1'},
      ];

      const result = await workspaces.increaseVersionForWorkspaces({
        workspaces: input,
        commitMessage: 'feat: add new feature',
      });

      expect(result).toEqual([
        {
          path: '/test/workspace1',
          type: 'node',
          name: 'project1',
          version: '1.1.0',
        },
        {
          path: '/test/workspace2',
          type: 'python',
          name: 'project2',
          version: '2.4.0',
        },
      ]);
    });

    it('handles pre-release identifiers in commit message', async () => {
      const input = [{path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'}];
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
      const input = [{path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'}];

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
      vi.spyOn(process, 'chdir').mockImplementation(() => {});
    });

    afterEach(() => {
      unMockPino(workspaces.log);
    });

    it('updates versions for supported workspace types', async () => {
      const workspacesArray = [
        {path: '/test/workspace1', name: 'node-project', type: 'node', version: '1.1.0'},
        {path: '/test/workspace2', name: 'python-project', type: 'python', version: '0.5.0'},
      ];

      const updateMocks = {
        node: mockWorkspace('node'),
        python: mockWorkspace('python'),
      };

      try {
        const result = await workspaces.updateVersionsForWorkspaces(workspacesArray);

        // Verify update was called for each workspace
        expect(updateMocks.node.update).toHaveBeenCalledWith(
          expect.stringContaining('test/workspace1'),
          '1.1.0',
        );
        expect(updateMocks.python.update).toHaveBeenCalledWith(
          expect.stringContaining('test/workspace2'),
          '0.5.0',
        );

        // Verify the result contains the updated workspaces
        expect(result).toEqual(workspacesArray);
      } finally {
        unMockWorkspace(updateMocks.node);
        unMockWorkspace(updateMocks.python);
      }
    });

    it('falls back to text updater for unsupported workspace types', async () => {
      const workspacesArray = [{path: '/test/workspace', name: 'unknown-project', type: 'unknown', version: '1.0.0'}];

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
          {path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'},
          {path: '/test/workspace2', type: 'python', name: 'project2', version: '2.0.0'},
        ];
        vi.spyOn(process, 'chdir').mockImplementation(() => {});

        const updateMock = {
          node: mockWorkspace('node', {}),
          python: mockWorkspace('python', {}),
        };

        const result = await workspaces.updateVersionsForWorkspaces(input, {generateChangelog: true});
        expect(updateMock.node.update).toHaveBeenCalledWith(
          '/test/workspace1',
          '1.0.0',
        );
        expect(updateMock.python.update).toHaveBeenCalledWith(
          '/test/workspace2',
          '2.0.0',
        );
        expect(changelog.generateWorkspaceChangelog).toHaveBeenCalledTimes(2);
        expect(result).toEqual(input);
      });

      it('skips changelog generation when option is disabled', async () => {
        const input = [{path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'}];
        vi.spyOn(process, 'chdir').mockImplementation(() => {});

        const nodeMock = mockWorkspace('node', {});

        const changelog = await import('../utils/changelog.js');
        const result = await workspaces.updateVersionsForWorkspaces(input, {generateChangelog: false});
        expect(nodeMock.update).toHaveBeenCalledWith(
          '/test/workspace1',
          '1.0.0',
        );
        expect(changelog.generateWorkspaceChangelog).not.toHaveBeenCalled();
        expect(result).toEqual(input);
      });
    });
  });

  // describe('generateChangelogsForChangedWorkspaces', () => {
  //   let gwc = null;
  //   beforeEach(() => {
  //     mockConsole();
  //     mockCConsole();
  //     gwc = vi.spyOn(changelog, 'generateWorkspaceChangelog').mockResolvedValue();
  //   });

  //   afterEach(() => {
  //     unMockCConsole();
  //     unMockConsole();
  //     gwc.mockRestore();

  //     vi.restoreAllMocks();
  //   });

  //   it('generates changelogs for changed workspaces', async () => {
  //     const input = [
  //       {path: '/test/workspace1', type: 'node'},
  //       {path: '/test/workspace2', type: 'python'},
  //     ];

  //     // Mock enrichChangedWorkspaces to return workspaces
  //     vi.spyOn(workspaces, 'enrichChangedWorkspaces').mockResolvedValue([
  //       {path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'},
  //       {path: '/test/workspace2', type: 'python', name: 'project2', version: '2.0.0'},
  //     ]);

  //     try {
  //       const result = await workspaces.generateChangelogsForChangedWorkspaces(input, 'v1.0.0', {
  //         preset: 'conventionalcommits',
  //         append: true,
  //       });

  //       expect(workspaces.enrichChangedWorkspaces).toHaveBeenCalledWith(input, 'v1.0.0');
  //       expect(changelog.generateWorkspacesChangelogs).toHaveBeenCalledWith(
  //         expect.arrayContaining([
  //           expect.objectContaining({name: 'project1'}),
  //           expect.objectContaining({name: 'project2'}),
  //         ]),
  //         {preset: 'conventionalcommits', append: true},
  //       );
  //       expect(result.length).toBe(2);
  //     } finally {
  //       workspaces.enrichChangedWorkspaces.mockRestore();
  //     }
  //   });

  //   // it('returns empty array when no workspaces have changed', async () => {
  //   //   const input = [
  //   //     {path: '/test/workspace1', type: 'node'},
  //   //     {path: '/test/workspace2', type: 'python'},
  //   //   ];

  //   //   // Mock enrichChangedWorkspaces to return empty array
  //   //   vi.spyOn(workspaces, 'enrichChangedWorkspaces').mockResolvedValue([]);

  //   //   const changelog = await import('../utils/changelog.js');

  //   //   const result = await workspaces.generateChangelogsForChangedWorkspaces(input, 'v1.0.0');

  //   //   expect(workspaces.enrichChangedWorkspaces).toHaveBeenCalledWith(input, 'v1.0.0');
  //   //   expect(changelog.generateWorkspacesChangelogs).not.toHaveBeenCalled();
  //   //   expect(result).toEqual([]);
  //   // });
  // });
});
