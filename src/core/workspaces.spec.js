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

  describe('fromString', () => {
    it('will parse path and type', async () => {
      const result = workspaces.fromString('.:text');

      expect(result).toEqual({path: '.', type: 'text'});
    });

    it('will parse all 4 params', async () => {
      const result = workspaces.fromString('.:text:project:1.0.0');

      expect(result).toEqual({
        name: 'project',
        path: '.',
        type: 'text',
        version: '1.0.0',
      });
    });

    it('will handle empty string', () => {
      const result = workspaces.fromString('');

      expect(result).toEqual({
        path: '',
      });
    });

    it('will handle only path', () => {
      const result = workspaces.fromString('/path/to/workspace');

      expect(result).toEqual({path: '/path/to/workspace'});
    });
  });

  describe('buildWorkspaceTree(strig[])', () => {
    it('returns empty array for empty input', () => {
      expect(workspaces.buildWorkspaceTree([])).toEqual([]);
      expect(workspaces.buildWorkspaceTree(null)).toEqual([]);
      expect(workspaces.buildWorkspaceTree(undefined)).toEqual([]);
    });

    it('creates a single node tree for a single workspace', () => {
      const workspace = {path: '/root/project', name: 'project', type: 'node', version: '1.0.0'};
      const result = workspaces.buildWorkspaceTree([workspace]);

      expect(result).toEqual([
        {
          workspace,
          children: [],
          parent: null,
        },
      ]);
    });

    it('creates a tree with parent-child relationships based on paths', () => {
      const workspaceInputs = [
        {path: '/root/project', name: 'project', type: 'node', version: '1.0.0'},
        {path: '/root/project/service1', name: 'service1', type: 'node', version: '0.5.0'},
        {path: '/root/project/service2', name: 'service2', type: 'python', version: '0.2.0'},
      ];

      const result = workspaces.buildWorkspaceTree(workspaceInputs);

      // Expect only one root node
      expect(result.length).toBe(1);

      // Verify root
      expect(result[0].workspace).toEqual(workspaceInputs[0]);
      expect(result[0].parent).toBeNull();

      // Verify children
      expect(result[0].children.length).toBe(2);

      // Check first child
      expect(result[0].children[0].workspace).toEqual(workspaceInputs[1]);
      expect(result[0].children[0].parent).toBe(result[0]);
      expect(result[0].children[0].children).toEqual([]);

      // Check second child
      expect(result[0].children[1].workspace).toEqual(workspaceInputs[2]);
      expect(result[0].children[1].parent).toBe(result[0]);
      expect(result[0].children[1].children).toEqual([]);
    });

    it('creates a tree with multiple levels of nesting', () => {
      const workspaceInputs = [
        {path: '/root/project', name: 'project', type: 'node', version: '1.0.0'},
        {path: '/root/project/service1', name: 'service1', type: 'node', version: '0.5.0'},
        {path: '/root/project/service1/submodule', name: 'submodule', type: 'node', version: '0.1.0'},
      ];

      const result = workspaces.buildWorkspaceTree(workspaceInputs);

      // Should only have one root
      expect(result.length).toBe(1);

      // Check root
      expect(result[0].workspace).toEqual(workspaceInputs[0]);

      // Check first level child
      const serviceNode = result[0].children[0];
      expect(serviceNode.workspace).toEqual(workspaceInputs[1]);
      expect(serviceNode.parent).toBe(result[0]);

      // Check second level child
      const submoduleNode = serviceNode.children[0];
      expect(submoduleNode.workspace).toEqual(workspaceInputs[2]);
      expect(submoduleNode.parent).toBe(serviceNode);
    });

    it('returns multiple roots for unrelated workspaces', () => {
      const workspaceInputs = [
        {path: '/projects/project1', name: 'project1', type: 'node', version: '1.0.0'},
        {path: '/apps/app1', name: 'app1', type: 'python', version: '0.5.0'},
      ];

      const result = workspaces.buildWorkspaceTree(workspaceInputs);

      // Should have two root nodes
      expect(result.length).toBe(2);

      // Check roots
      expect(result[0].workspace).toEqual(workspaceInputs[0]);
      expect(result[1].workspace).toEqual(workspaceInputs[1]);

      // Each should be a root (no parent)
      expect(result[0].parent).toBeNull();
      expect(result[1].parent).toBeNull();

      // No children
      expect(result[0].children).toEqual([]);
      expect(result[1].children).toEqual([]);
    });

    it('correctly identifies the closest parent in complex scenarios', () => {
      const workspaceInputs = [
        {path: '/root/project', name: 'project', type: 'node', version: '1.0.0'},
        {path: '/root', name: 'root', type: 'text', version: '0.1.0'},
        {path: '/root/project/service1', name: 'service1', type: 'node', version: '0.5.0'},
      ];

      const result = workspaces.buildWorkspaceTree(workspaceInputs);

      // Should only have one root: '/root'
      expect(result.length).toBe(1);
      expect(result[0].workspace).toEqual(workspaceInputs[1]);

      // Project should be child of root
      const projectNode = result[0].children[0];
      expect(projectNode.workspace).toEqual(workspaceInputs[0]);
      expect(projectNode.parent).toBe(result[0]);

      // Service should be child of project
      const serviceNode = projectNode.children[0];
      expect(serviceNode.workspace).toEqual(workspaceInputs[2]);
      expect(serviceNode.parent).toBe(projectNode);
    });

    it('handles multiple trees in the same workspace array', () => {
      const workspaceInputs = [
        {path: '/project1/main', name: 'main1', type: 'node', version: '1.0.0'},
        {path: '/project1/main/service', name: 'service1', type: 'node', version: '0.5.0'},
        {path: '/project2/main', name: 'main2', type: 'python', version: '0.2.0'},
        {path: '/project2/main/service', name: 'service2', type: 'python', version: '0.1.0'},
      ];

      const result = workspaces.buildWorkspaceTree(workspaceInputs);

      // Should have two root nodes
      expect(result.length).toBe(2);

      // Check first tree
      expect(result[0].workspace).toEqual(workspaceInputs[0]);
      expect(result[0].parent).toBeNull();
      expect(result[0].children.length).toBe(1);
      expect(result[0].children[0].workspace).toEqual(workspaceInputs[1]);

      // Check second tree
      expect(result[1].workspace).toEqual(workspaceInputs[2]);
      expect(result[1].parent).toBeNull();
      expect(result[1].children.length).toBe(1);
      expect(result[1].children[0].workspace).toEqual(workspaceInputs[3]);
    });
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

      const result = await workspaces.increaseWorkspacesVersions({
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

      const result = await workspaces.increaseWorkspacesVersions({
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

      const result = await workspaces.increaseWorkspacesVersions({
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
        const result = await workspaces.updateWorkspacesVersions(workspacesArray);

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
        const result = await workspaces.updateWorkspacesVersions(workspacesArray);

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
  });
});
