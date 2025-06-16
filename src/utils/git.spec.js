import {describe, it, expect, beforeEach, vi, afterAll} from 'vitest';

import * as git from './git.js';
import {mockPinoIn, unMockPinoIn, setupPinoLoggingCallsTest} from '../vitest/setup.logging.tests.js';
import {createWorkspacesTestFolder, updateAndCommit} from '../vitest/setup.workspaces.tests.js';
import {removeTempProjectFolder} from '../vitest/setup.fs.test.js';
import * as exec from './exec.js';
import {oldVersion} from '../vitest/setup.detect-update.tests.js';

/**
 * TODO: As seen, not all tests use mkdtemp. Need to adapt the one that can be adapted to use mkdtemp.
 */

describe('utils/git.js', () => {
  let projectFolder = '';
  let projectName = '';
  let created = [];
  let logMocks = [];
  let execMock = null;
  const lastTag = `v${oldVersion}`;
  const originalExec = exec.exec;

  beforeEach(async () => {
    logMocks = await mockPinoIn([
      'core/version',
      'core/version/detect',
      'core/version/update',
      'core/workspaces',
      'utils/changelog',
    ]);
    ({created, projectFolder, projectName} = await createWorkspacesTestFolder());
    exec.setCwd(projectFolder);

    execMock = vi.spyOn(exec, 'exec');
  });

  afterEach(async () => {
    unMockPinoIn(logMocks);
    await removeTempProjectFolder(projectFolder);
    exec.resetCwd();

    projectFolder = '';
    projectName = '';
    execMock.mockRestore();
  });

  describe('commits object', () => {
    describe('lastMessage()', () => {
      it('returns the latest commit message', async () => {
        const commitMessage = 'feat: add new feature';

        await updateAndCommit([projectFolder], commitMessage);

        const message = await git.commits.lastMessage();

        expect(message).toBe(commitMessage);
      });

      it('logs error and returns undefined on failure', async () => {
        execMock.mockRejectedValueOnce(new Error('Mocked error'));

        const message = await git.commits.lastMessage();

        setupPinoLoggingCallsTest('warn', [{error: 'Mocked error'}, git.warnFailedToGetLatestCommitMessage], git.log);
        expect(message).toBeNull();
      });
    });

    describe.only('getChangedFiles()', () => {
      it('returns files that changed since the specified tag', async () => {
        await updateAndCommit([projectFolder], 'feat: another commit');

        const result = await git.commits.getChangedFiles(projectFolder, lastTag);

        expect(result).toEqual(['update.md']);
      });

      it('returns all tracked files when no tag is provided', async () => {
        await updateAndCommit([projectFolder], 'feat: another commit');

        const result = await git.commits.getChangedFiles(projectFolder, null);

        expect(result).toEqual([
          'README.md',
          'node-project/package.json',
          'python-project/pyproject.toml',
          'update.md',
          'version',
        ]);
      });

      it('logs error and exits when git command fails', async () => {
        let callCount = 0;
        const error = new Error('Mocked git error');
        execMock.mockImplementation((...args) => {
          callCount++;
          if (callCount === 1) {
            return originalExec(...args);
          }
          throw error;
        });

        await git.commits.getChangedFiles(projectFolder, lastTag);

        setupPinoLoggingCallsTest(
          'error',
          [{repoPath: projectFolder, error}, git.errorRetrievingChangedFiles],
          git.log,
        );
      });

      it('handles empty output from git command', async () => {
        const result = await git.commits.getChangedFiles(projectFolder, lastTag);

        expect(result).toEqual([]);
      });
    });
  });

  describe('config object', () => {
    describe('set()', () => {
      it('sets git config value and logs success message', async () => {
        execMock.mockResolvedValueOnce({});

        const result = await git.config.set({'user.name': 'Test User'});

        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        setupPinoLoggingCallsTest('info', [{key: 'user.name', value: 'Test User'}, git.infoGitConfigSet], git.log);
        expect(result).toBe(true);
      });

      it('logs error message and returns false when setting config fails', async () => {
        const error = new Error('Config error');
        execMock.mockRejectedValueOnce(error);

        const result = await git.config.set({'invalid.key': 'value'});

        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'invalid.key', 'value']);
        setupPinoLoggingCallsTest('error', [{key: 'invalid.key', error}, git.errorFailedToSetGitConfig], git.log);
        expect(result).toBe(false);
      });

      it('sets multiple config values and returns true when all succeed', async () => {
        execMock.mockResolvedValue({});

        const result = await git.config.set({
          'user.name': 'Test User',
          'user.email': 'test@example.com',
        });

        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.email', 'test@example.com']);
        expect(result).toBe(true);
      });

      it('stops at first failure and returns false when setting multiple configs', async () => {
        execMock
          .mockResolvedValueOnce({}) // First call succeeds
          .mockRejectedValueOnce(new Error('Second config fails')); // Second call fails

        const result = await git.config.set({
          'user.name': 'Test User',
          'user.email': 'test@example.com',
        });

        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.email', 'test@example.com']);
        expect(result).toBe(false);
      });

      it('sets config locally when global flag is false', async () => {
        execMock.mockResolvedValueOnce({});

        const result = await git.config.set({'user.name': 'Test User'}, false);

        expect(execMock).toHaveBeenCalledWith('git', ['config', 'user.name', 'Test User']);
        expect(result).toBe(true);
      });
    });
  });

  describe('tag object', () => {
    describe('create()', () => {
      it('creates a tag with the specified name and message', async () => {
        await git.tag.create('v1.0.0', 'Version 1.0.0 release');

        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagCreated], git.log);
      });

      it('logs error when tag creation fails', async () => {
        const error = new Error('Failed to create tag');
        execMock.mockRejectedValueOnce(error);

        await git.tag.create('invalid-tag', 'message');

        setupPinoLoggingCallsTest('warn', [{tagName: 'invalid-tag', error}, git.warnFailedToCreateTag], git.log);
      });
    });

    describe('createAndPush()', () => {
      it('creates a new tag and pushes it to origin', async () => {
        // Mock tag doesn't exist yet
        execMock.mockResolvedValueOnce({stdout: ''}); // For exists check
        execMock.mockResolvedValueOnce({}); // For create
        execMock.mockResolvedValueOnce({}); // For push

        await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

        expect(execMock).toHaveBeenNthCalledWith(2, 'git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0']);
        expect(execMock).toHaveBeenNthCalledWith(3, 'git', ['push', 'origin', 'v1.0.0']);
      });

      it('removes existing tag before recreating it', async () => {
        // Mock tag already exists
        execMock.mockResolvedValueOnce({stdout: 'v1.0.0'}); // For exists check
        execMock.mockResolvedValueOnce({}); // For remove
        execMock.mockResolvedValueOnce({}); // For create
        execMock.mockResolvedValueOnce({}); // For push

        await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

        expect(execMock).toHaveBeenNthCalledWith(2, 'git', ['tag', '-d', 'v1.0.0']);
        expect(execMock).toHaveBeenNthCalledWith(3, 'git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0']);
        expect(execMock).toHaveBeenNthCalledWith(4, 'git', ['push', 'origin', 'v1.0.0']);

        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagAlreadyExists], git.log);
      });

      it('logs error when createAndPush fails', async () => {
        const error = new Error('Tag error');
        execMock.mockRejectedValueOnce(error);

        await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToCheckTagExists], git.log);
      });
    });

    describe('exists()', () => {
      it('returns true when tag exists', async () => {
        const result = await git.tag.exists(lastTag);

        expect(execMock).toHaveBeenCalledWith('git', ['tag', '-l', lastTag]);
        expect(result).toBe(true);
      });

      it('returns false when tag does not exist', async () => {
        const result = await git.tag.exists('v2.0.0');

        expect(result).toBe(false);
      });

      it('logs error and returns false when check fails', async () => {
        const error = new Error('Git error');
        execMock.mockRejectedValueOnce(error);

        const result = await git.tag.exists('v1.0.0');

        expect(result).toBe(false);
        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToCheckTagExists], git.log);
      });
    });

    describe('lastTag()', () => {
      it('returns the last created tag', async () => {
        const result = await git.tag.lastCreated();

        expect(execMock).toHaveBeenCalledWith('git', ['describe', '--tags', '--abbrev=0']);
        expect(result).toBe(lastTag);
      });

      it('logs error when no tags are found', async () => {
        const error = new Error('No tags found');
        execMock.mockRejectedValueOnce(error);
        execMock.mockRejectedValueOnce(new Error('No commits found'));

        const result = await git.tag.lastCreated();

        expect(result).toBeNull();
        setupPinoLoggingCallsTest('warn', [{error: error.message}, git.warnFailedToGetLastCreatedTag], git.log);
      });
    });

    describe('push()', () => {
      it('pushes a tag to origin', async () => {
        execMock.mockResolvedValueOnce({});

        await git.tag.push('v1.0.0');

        expect(execMock).toHaveBeenCalledWith('git', ['push', 'origin', 'v1.0.0']);
        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagPushed], git.log);
      });

      it('logs error when push fails', async () => {
        const error = new Error('Push failed');
        execMock.mockRejectedValueOnce(error);

        await git.tag.push('v1.0.0');

        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToPushTag], git.log);
      });
    });

    describe('remove()', () => {
      it('removes a tag', async () => {
        await git.tag.remove(lastTag);

        expect(execMock).toHaveBeenCalledWith('git', ['tag', '-d', lastTag]);
        setupPinoLoggingCallsTest('info', [{tagName: lastTag}, git.infoTagDeleted], git.log);
      });

      it('logs error when tag removal fails', async () => {
        const error = new Error('Removal failed');
        execMock.mockRejectedValueOnce(error);

        await git.tag.remove('v1.0.0');

        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToDeleteTag], git.log);
      });
    });
  });

  describe('branch object', () => {
    describe('create()', () => {
      it('creates a new branch', async () => {
        const result = await git.branch.create('feature/new-feature');

        expect(execMock).toHaveBeenCalledWith('git', ['checkout', '-b', 'feature/new-feature']);
        expect(result).toBe('feature/new-feature');
        setupPinoLoggingCallsTest('info', [{branchName: 'feature/new-feature'}, git.infoBranchCreated], git.log);
      });

      it('logs error when branch creation fails', async () => {
        const error = new Error('Branch creation failed');
        execMock.mockRejectedValueOnce(error);

        await git.branch.create('invalid-branch');

        setupPinoLoggingCallsTest(
          'warn',
          [{branchName: 'invalid-branch', error}, git.warnFailedToCreateBranch],
          git.log,
        );
      });
    });

    describe('createVersion()', () => {
      it('creates a version branch with correct naming convention', async () => {
        await git.branch.createVersion('1.0.0');

        expect(execMock).toHaveBeenCalledWith('git', ['checkout', '-b', 'version_bump_v1.0.0']);
      });
    });

    describe('remove()', () => {
      it('removes a branch', async () => {
        execMock.mockResolvedValueOnce({});

        await git.branch.remove('feature/old-feature');

        expect(execMock).toHaveBeenCalledWith('git', ['branch', '-d', 'feature/old-feature']);
        setupPinoLoggingCallsTest('info', [{branchName: 'feature/old-feature'}, git.infoBranchDeleted], git.log);
      });

      it('logs error when branch removal fails', async () => {
        const error = new Error('Branch removal failed');
        execMock.mockRejectedValueOnce(error);

        await git.branch.remove('non-existent-branch');

        setupPinoLoggingCallsTest(
          'warn',
          [{branchName: 'non-existent-branch', error}, git.warnFailedToDeleteBranch],
          git.log,
        );
      });
    });

    describe('push()', () => {
      it('pushes a branch to origin', async () => {
        execMock.mockResolvedValueOnce({});

        await git.branch.push('feature/branch');

        expect(execMock).toHaveBeenCalledWith('git', ['push', 'origin', 'feature/branch']);
        setupPinoLoggingCallsTest('info', [{branchName: 'feature/branch'}, git.infoBranchPushed], git.log);
      });

      it('logs error when branch push fails', async () => {
        const error = new Error('Push failed');
        execMock.mockRejectedValueOnce(error);

        await git.branch.push('feature/branch');

        setupPinoLoggingCallsTest('warn', [{branchName: 'feature/branch', error}, git.warnFailedToPushBranch], git.log);
      });
    });
  });
});
