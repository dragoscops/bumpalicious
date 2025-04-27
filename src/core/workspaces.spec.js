import {describe, it, expect, beforeEach, vi, afterAll, beforeAll, afterEach} from 'vitest';

import * as workspaces from './workspaces.js';
import * as git from '../utils/git.js';
import {
  mockCConsole,
  mockConsole,
  unMockConsole,
  unMockCConsole,
  setupLoggingCallsTest,
} from '../vitest/setup.logging.tests.js';
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
      mockConsole(['warning']);
      mockCConsole(['warning']);
    });

    afterEach(() => {
      unMockCConsole(['warning']);
      unMockConsole(['warning']);
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

        expect(detectMock.detect).toHaveBeenCalledWith(workspacePath);
        expect(result).toEqual({
          path: workspacePath,
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

        setupLoggingCallsTest('warning', [
          expect.stringContaining('WARNING'),
          expect.stringContaining('Could not detect version for workspace'),
        ]);
        expect(result.version).toBe('0.1.0');
      } finally {
        detectMock.mockRestore();
      }
    });

    it('handles unknown workspace type by falling back to text', async () => {
      const workspacePath = '/test/workspace';
      const workspaceType = 'unknown';
      const detectMock = mockWorkspaceDetect('text', [
        {
          name: 'text-project',
          version: '0.5.0',
        },
      ]);

      try {
        const result = await workspaces.enrichWorkspace(workspacePath, workspaceType);

        setupLoggingCallsTest('warning', [
          expect.stringContaining('WARNING'),
          expect.stringContaining('Unknown workspace type'),
        ]);
        expect(result.type).toBe('unknown');
      } finally {
        detectMock.mockRestore();
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

        expect(detectMocks.node).toHaveBeenCalledWith('/test/workspace1');
        expect(detectMocks.python).toHaveBeenCalledWith('/test/workspace2');

        expect(result).toEqual([
          {path: '/test/workspace1', type: 'node', name: 'node-project', version: '0.5.0'},
          {path: '/test/workspace2', type: 'python', name: 'python-project', version: '0.6.0'},
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
      mockConsole();
      mockCConsole();
    });

    afterEach(() => {
      unMockCConsole();
      unMockConsole();
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
        if (path === '/test/workspace1') {
          return Promise.resolve(['file1.js', 'file2.js']);
        }
        return Promise.resolve([]);
      });

      try {
        const result = await workspaces.enrichChangedWorkspaces(input, 'v1.0.0');

        expect(detectMocks.node).toHaveBeenCalledWith('/test/workspace1');

        expect(result).toEqual([{path: '/test/workspace1', type: 'node', name: 'node-project', version: '1.0.0'}]);
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
      mockConsole();
      mockCConsole();
    });

    afterEach(() => {
      unMockCConsole();
      unMockConsole();
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

      const result = await workspaces.increaseVersionForWorkspaces({
        workspaces: input,
        commitMessage: 'feat: add new feature; pre-release: beta',
      });

      setupLoggingCallsTest('info', [
        expect.stringContaining('INFO'),
        expect.stringContaining('Pre-release identifier found '),
      ]);
      expect(result[0].version).toBe('1.1.0-beta.0');
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
      mockConsole(['warning', 'info', 'notice', 'error']);
      mockCConsole(['warning', 'info', 'notice', 'error']);
      vi.spyOn(process, 'chdir').mockImplementation(() => {});
    });

    afterEach(() => {
      unMockCConsole(['warning', 'info', 'notice', 'error']);
      unMockConsole(['warning', 'info', 'notice', 'error']);
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
        expect(updateMocks.node.updateVersion).toHaveBeenCalledWith({
          projectPath: '/test/workspace1',
          newVersion: '1.1.0',
        });
        expect(updateMocks.python.updateVersion).toHaveBeenCalledWith({
          projectPath: '/test/workspace2',
          newVersion: '0.5.0',
        });

        // Verify process.chdir was called to switch to each workspace directory
        expect(process.chdir).toHaveBeenCalledWith('/test/workspace1');
        expect(process.chdir).toHaveBeenCalledWith('/test/workspace2');

        // setupLoggingCallsTest('notice', [
        //   expect.stringContaining('NOTICE '),
        //   expect.stringContaining('Updated node-project version to 1.1.0'),
        // ]);
        setupLoggingCallsTest('notice', [
          expect.stringContaining('NOTICE'),
          expect.stringContaining('Updated python-project version to 0.5.0'),
        ]);

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
        expect(updateMock.updateVersion).toHaveBeenCalledWith({projectPath: '/test/workspace', newVersion: '1.0.0'});

        // Verify result contains the updated workspace
        expect(result).toEqual(workspacesArray);

        // Verify appropriate logging
        setupLoggingCallsTest('notice', [
          expect.stringContaining('NOTICE'),
          expect.stringContaining('Updated unknown-project version to 1.0.0'),
        ]);
      } finally {
        unMockWorkspace(updateMock);
      }
    });

    describe('updateVersionsForWorkspaces(Workspace[])', () => {
      beforeEach(() => {
        mockConsole();
        mockCConsole();
        vi.mock('../utils/changelog.js', () => ({
          generateWorkspaceChangelog: vi.fn().mockResolvedValue(true),
        }));
      });

      afterEach(() => {
        unMockCConsole();
        unMockConsole();
        vi.restoreAllMocks();
      });

      it('updates versions and generates changelogs for all workspaces', async () => {
        const input = [
          {path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'},
          {path: '/test/workspace2', type: 'python', name: 'project2', version: '2.0.0'},
        ];

        vi.spyOn(process, 'chdir').mockImplementation(() => {});

        const nodeMock = vi.fn().mockResolvedValue();
        const pythonMock = vi.fn().mockResolvedValue();

        vi.mock(
          '../workspace/index.js',
          () => ({
            node: {updateVersion: nodeMock},
            python: {updateVersion: pythonMock},
          }),
          {virtual: true},
        );

        const changelog = await import('../utils/changelog.js');

        const result = await workspaces.updateVersionsForWorkspaces(input, {generateChangelog: true});

        expect(nodeMock).toHaveBeenCalledWith({
          projectPath: '/test/workspace1',
          newVersion: '1.0.0',
        });
        expect(pythonMock).toHaveBeenCalledWith({
          projectPath: '/test/workspace2',
          newVersion: '2.0.0',
        });
        expect(changelog.generateWorkspaceChangelog).toHaveBeenCalledTimes(2);
        expect(result).toEqual(input);
      });

      it('skips changelog generation when option is disabled', async () => {
        const input = [{path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'}];

        vi.spyOn(process, 'chdir').mockImplementation(() => {});

        const nodeMock = vi.fn().mockResolvedValue();

        vi.mock(
          '../workspace/index.js',
          () => ({
            node: {updateVersion: nodeMock},
          }),
          {virtual: true},
        );

        const changelog = await import('../utils/changelog.js');

        const result = await workspaces.updateVersionsForWorkspaces(input, {generateChangelog: false});

        expect(nodeMock).toHaveBeenCalledWith({
          projectPath: '/test/workspace1',
          newVersion: '1.0.0',
        });
        expect(changelog.generateWorkspaceChangelog).not.toHaveBeenCalled();
        expect(result).toEqual(input);
      });
    });
  });

  describe('generateChangelogsForChangedWorkspaces', () => {
    beforeEach(() => {
      mockConsole();
      mockCConsole();

      vi.mock('../utils/changelog.js', () => ({
        generateWorkspacesChangelogs: vi.fn().mockResolvedValue([
          {workspace: {name: 'project1'}, success: true},
          {workspace: {name: 'project2'}, success: true},
        ]),
      }));
    });

    afterEach(() => {
      unMockCConsole();
      unMockConsole();
      vi.restoreAllMocks();
    });

    it('generates changelogs for changed workspaces', async () => {
      const input = [
        {path: '/test/workspace1', type: 'node'},
        {path: '/test/workspace2', type: 'python'},
      ];

      // Mock enrichChangedWorkspaces to return workspaces
      vi.spyOn(workspaces, 'enrichChangedWorkspaces').mockResolvedValue([
        {path: '/test/workspace1', type: 'node', name: 'project1', version: '1.0.0'},
        {path: '/test/workspace2', type: 'python', name: 'project2', version: '2.0.0'},
      ]);

      const changelog = await import('../utils/changelog.js');

      const result = await workspaces.generateChangelogsForChangedWorkspaces(input, 'v1.0.0', {
        preset: 'conventionalcommits',
        append: true,
      });

      expect(workspaces.enrichChangedWorkspaces).toHaveBeenCalledWith(input, 'v1.0.0');
      expect(changelog.generateWorkspacesChangelogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({name: 'project1'}),
          expect.objectContaining({name: 'project2'}),
        ]),
        {preset: 'conventionalcommits', append: true},
      );
      expect(result.length).toBe(2);
    });

    it('returns empty array when no workspaces have changed', async () => {
      const input = [
        {path: '/test/workspace1', type: 'node'},
        {path: '/test/workspace2', type: 'python'},
      ];

      // Mock enrichChangedWorkspaces to return empty array
      vi.spyOn(workspaces, 'enrichChangedWorkspaces').mockResolvedValue([]);

      const changelog = await import('../utils/changelog.js');

      const result = await workspaces.generateChangelogsForChangedWorkspaces(input, 'v1.0.0');

      expect(workspaces.enrichChangedWorkspaces).toHaveBeenCalledWith(input, 'v1.0.0');
      expect(changelog.generateWorkspacesChangelogs).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
