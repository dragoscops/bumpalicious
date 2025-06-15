import {describe, it, expect, beforeEach, vi, afterAll} from 'vitest';

import * as e from './exec.js';
import * as git from './git.js';
import {mockPino, unMockPino, setupPinoLoggingCallsTest} from '../vitest/setup.logging.tests.js';

describe('git.js module', () => {
  let execMock = null;

  beforeEach(() => {
    execMock = vi.spyOn(e, 'exec');
    mockPino(git.log);
  });

  afterAll(() => {
    unMockPino(git.log);
    execMock.mockRestore();
  });

  describe('commits object', () => {
    describe('lastMessage()', () => {
      it('returns the latest commit message', async () => {
        execMock.mockResolvedValueOnce({stdout: 'feat: add new feature\n'});

        const message = await git.commits.lastMessage();

        expect(execMock).toHaveBeenCalledWith('git', ['log', '-1', '--pretty=%B']);
        expect(message).toBe('feat: add new feature');
      });

      it('logs error and returns undefined on failure', async () => {
        execMock.mockRejectedValueOnce(new Error('Mocked error'));

        const message = await git.commits.lastMessage();

        setupPinoLoggingCallsTest('warn', [{error: 'Mocked error'}, git.warnFailedToGetLatestCommitMessage], git.log);
        expect(message).toBeNull();
      });
    });

    // TODO: must find a way to test using mkdtemp
    describe.skip('getChangedFiles()', () => {
      it('returns files that changed since the specified tag', async () => {
        const repoPath = '/path/to/repo';
        const lastTag = 'v1.0.0';
        const changedFiles = ['file1.js', 'file2.js', 'dir/file3.js'];

        execMock.mockResolvedValueOnce({
          stdout: changedFiles.join('\n'),
        });

        const result = await git.commits.getChangedFiles(repoPath, lastTag);

        expect(execMock).toHaveBeenCalledWith('git', ['diff', lastTag, '--name-only', '--', repoPath], {cwd: repoPath});
        expect(result).toEqual(changedFiles);
      });

      it('returns all tracked files when no tag is provided', async () => {
        const repoPath = '/path/to/repo';
        const trackedFiles = ['file1.js', 'file2.js', 'dir/file3.js'];

        execMock.mockResolvedValueOnce({
          stdout: trackedFiles.join('\n'),
        });

        const result = await git.commits.getChangedFiles(repoPath, null);

        expect(execMock).toHaveBeenCalledWith('git', ['ls-files'], {cwd: repoPath});
        expect(result).toEqual(trackedFiles);
      });

      it('filters out empty lines in the git command output', async () => {
        const repoPath = '/path/to/repo';
        const lastTag = 'v1.0.0';

        execMock.mockResolvedValueOnce({
          stdout: 'file1.js\n\nfile2.js\n',
        });

        const result = await git.commits.getChangedFiles(repoPath, lastTag);

        expect(result).toEqual(['file1.js', 'file2.js']);
      });
      it('logs error and exits when git command fails', async () => {
        const repoPath = '/path/to/repo';
        const lastTag = 'v1.0.0';
        const error = new Error('Git command failed');

        execMock.mockRejectedValueOnce(error);

        await git.commits.getChangedFiles(repoPath, lastTag);

        setupPinoLoggingCallsTest('error', [{repoPath, error}, git.errorRetrievingChangedFiles], git.log);
      });

      it('handles empty output from git command', async () => {
        const repoPath = '/path/to/repo';
        const lastTag = 'v1.0.0';

        execMock.mockResolvedValueOnce({
          stdout: '',
        });

        const result = await git.commits.getChangedFiles(repoPath, lastTag);

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
        execMock.mockResolvedValueOnce({});

        await git.tag.create('v1.0.0', 'Version 1.0.0 release');

        expect(execMock).toHaveBeenCalledWith('git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0 release']);
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
        execMock.mockResolvedValueOnce({stdout: 'v1.0.0'});

        const result = await git.tag.exists('v1.0.0');

        expect(execMock).toHaveBeenCalledWith('git', ['tag', '-l', 'v1.0.0']);
        expect(result).toBe(true);
      });

      it('returns false when tag does not exist', async () => {
        execMock.mockResolvedValueOnce({stdout: ''});

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
        execMock.mockResolvedValueOnce({stdout: 'v1.0.0'});

        const result = await git.tag.lastCreated();

        expect(execMock).toHaveBeenCalledWith('git', ['describe', '--tags', '--abbrev=0']);
        expect(result).toBe('v1.0.0');
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
        execMock.mockResolvedValueOnce({});

        await git.tag.remove('v1.0.0');

        expect(execMock).toHaveBeenCalledWith('git', ['tag', '-d', 'v1.0.0']);
        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagDeleted], git.log);
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
        execMock.mockResolvedValueOnce({});

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
        execMock.mockResolvedValueOnce({});

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
