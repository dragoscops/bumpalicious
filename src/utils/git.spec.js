import {execa} from 'execa';
import {describe, it, expect, beforeEach, vi, afterAll} from 'vitest';

import * as git from './git.js';
import {mockPino, unMockPino, setupPinoLoggingCallsTest} from '../vitest/setup.logging.tests.js';

describe('git.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPino(git.log);
  });

  afterAll(() => {
    unMockPino(git.log);
  });

  describe('gitLog object', () => {
    describe('lastMessage()', () => {
      it('returns the latest commit message', async () => {
        execa.mockResolvedValueOnce({stdout: 'feat: add new feature\n'});

        const message = await git.gitLog.lastMessage();

        expect(execa).toHaveBeenCalledWith('git', ['log', '-1', '--pretty=%B']);
        expect(message).toBe('feat: add new feature');
      });

      it('logs error and returns undefined on failure', async () => {
        execa.mockRejectedValueOnce(new Error('Mocked error'));

        const message = await git.gitLog.lastMessage();

        setupPinoLoggingCallsTest('warn', [{error: 'Mocked error'}, git.warnFailedToGetLatestCommitMessage], git.log);
        expect(message).toBeNull();
      });
    });
  });

  describe('getChangedFiles()', () => {
    it('returns files that changed since the specified tag', async () => {
      const repoPath = '/path/to/repo';
      const lastTag = 'v1.0.0';
      const changedFiles = ['file1.js', 'file2.js', 'dir/file3.js'];

      execa.mockResolvedValueOnce({
        stdout: changedFiles.join('\n'),
      });

      const result = await git.getChangedFiles(repoPath, lastTag);

      expect(execa).toHaveBeenCalledWith('git', ['diff', lastTag, '--name-only', '--', repoPath], {cwd: repoPath});
      expect(result).toEqual(changedFiles);
    });

    it('returns all tracked files when no tag is provided', async () => {
      const repoPath = '/path/to/repo';
      const trackedFiles = ['file1.js', 'file2.js', 'dir/file3.js'];

      execa.mockResolvedValueOnce({
        stdout: trackedFiles.join('\n'),
      });

      const result = await git.getChangedFiles(repoPath, null);

      expect(execa).toHaveBeenCalledWith('git', ['ls-files'], {cwd: repoPath});
      expect(result).toEqual(trackedFiles);
    });

    it('filters out empty lines in the git command output', async () => {
      const repoPath = '/path/to/repo';
      const lastTag = 'v1.0.0';

      execa.mockResolvedValueOnce({
        stdout: 'file1.js\n\nfile2.js\n',
      });

      const result = await git.getChangedFiles(repoPath, lastTag);

      expect(result).toEqual(['file1.js', 'file2.js']);
    });
    it('logs error and exits when git command fails', async () => {
      const repoPath = '/path/to/repo';
      const lastTag = 'v1.0.0';
      const error = new Error('Git command failed');

      execa.mockRejectedValueOnce(error);

      await git.getChangedFiles(repoPath, lastTag);

      setupPinoLoggingCallsTest('error', [{repoPath, error}, git.errorRetrievingChangedFiles], git.log);
    });

    it('handles empty output from git command', async () => {
      const repoPath = '/path/to/repo';
      const lastTag = 'v1.0.0';

      execa.mockResolvedValueOnce({
        stdout: '',
      });

      const result = await git.getChangedFiles(repoPath, lastTag);

      expect(result).toEqual([]);
    });
  });

  describe('config object', () => {
    describe('get()', () => {
      it('parses git config and returns a key-value object when no key is provided', async () => {
        // Mock git config output with some common properties
        const mockConfigOutput = `
          user.name=GitHub Actions
          user.email=actions@github.com
          core.editor=vim
          alias.st=status
          remote.origin.url=https://github.com/user/repo.git
        `;
        execa.mockResolvedValueOnce({stdout: mockConfigOutput});

        const config = await git.config.get();

        expect(execa).toHaveBeenCalledWith('git', ['config', '--list']);
        expect(config).toEqual({
          'user.name': 'GitHub Actions',
          'user.email': 'actions@github.com',
          'core.editor': 'vim',
          'alias.st': 'status',
          'remote.origin.url': 'https://github.com/user/repo.git',
        });
      });

      it('returns subset of keys that start with provided key prefix', async () => {
        const mockConfigOutput = `
          user.name=GitHub Actions
          user.email=actions@github.com
          core.editor=vim
          alias.st=status
          alias.co=checkout
          alias.br=branch
          remote.origin.url=https://github.com/user/repo.git
        `;
        execa.mockResolvedValueOnce({stdout: mockConfigOutput});

        const config = await git.config.get('alias');

        expect(execa).toHaveBeenCalledWith('git', ['config', '--list']);
        expect(config).toEqual({
          'alias.st': 'status',
          'alias.co': 'checkout',
          'alias.br': 'branch',
        });
      });

      it('returns empty object when no keys match the provided prefix', async () => {
        const mockConfigOutput = `
          user.name=GitHub Actions
          user.email=actions@github.com
          core.editor=vim
        `;
        execa.mockResolvedValueOnce({stdout: mockConfigOutput});

        const config = await git.config.get('nonexistent');

        expect(config).toEqual({});
      });

      it('handles empty git config', async () => {
        execa.mockResolvedValueOnce({stdout: ''});

        const config = await git.config.get();

        expect(config).toEqual({});
      });

      it('handles git config with invalid format', async () => {
        // Some lines might not have a valid key=value format
        const mockConfigOutput = `
          user.name=GitHub Actions
          invalid line
          core.editor=vim
        `;
        execa.mockResolvedValueOnce({stdout: mockConfigOutput});

        const config = await git.config.get();

        // Should skip the invalid line
        expect(config).toEqual({
          'user.name': 'GitHub Actions',
          'core.editor': 'vim',
        });
      });

      it('logs error and returns empty object on failure', async () => {
        execa.mockRejectedValueOnce(new Error('Git command failed'));

        const config = await git.config.get();

        setupPinoLoggingCallsTest('warn', [{error: 'Git command failed'}, git.warnFailedToGetGitConfig], git.log);
        expect(config).toEqual({});
      });
    });

    describe('set()', () => {
      it('sets git config value and logs success message', async () => {
        execa.mockResolvedValueOnce({});

        await git.config.set({'user.name': 'Test User'});

        expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        setupPinoLoggingCallsTest('info', [{key: 'user.name', value: 'Test User'}, git.infoGitConfigSet], git.log);
      });

      it('logs error message when setting config fails', async () => {
        const error = new Error('Config error');
        execa.mockRejectedValueOnce(error);

        await git.config.set({'invalid.key': 'value'});

        expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'invalid.key', 'value']);
        setupPinoLoggingCallsTest(
          'warn',
          [{key: 'invalid.key', error: 'Config error'}, git.warnFailedToSetGitConfig],
          git.log,
        );
      });
    });
  });

  describe('tag object', () => {
    describe('create()', () => {
      it('creates a tag with the specified name and message', async () => {
        execa.mockResolvedValueOnce({});

        await git.tag.create('v1.0.0', 'Version 1.0.0 release');

        expect(execa).toHaveBeenCalledWith('git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0 release']);
        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagCreated], git.log);
      });

      it('logs error when tag creation fails', async () => {
        const error = new Error('Failed to create tag');
        execa.mockRejectedValueOnce(error);

        await git.tag.create('invalid-tag', 'message');

        setupPinoLoggingCallsTest('warn', [{tagName: 'invalid-tag', error}, git.warnFailedToCreateTag], git.log);
      });
    });

    describe('createAndPush()', () => {
      it('creates a new tag and pushes it to origin', async () => {
        // Mock tag doesn't exist yet
        execa.mockResolvedValueOnce({stdout: ''}); // For exists check
        execa.mockResolvedValueOnce({}); // For create
        execa.mockResolvedValueOnce({}); // For push

        await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

        expect(execa).toHaveBeenNthCalledWith(2, 'git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0']);
        expect(execa).toHaveBeenNthCalledWith(3, 'git', ['push', 'origin', 'v1.0.0']);
      });

      it('removes existing tag before recreating it', async () => {
        // Mock tag already exists
        execa.mockResolvedValueOnce({stdout: 'v1.0.0'}); // For exists check
        execa.mockResolvedValueOnce({}); // For remove
        execa.mockResolvedValueOnce({}); // For create
        execa.mockResolvedValueOnce({}); // For push

        await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

        expect(execa).toHaveBeenNthCalledWith(2, 'git', ['tag', '-d', 'v1.0.0']);
        expect(execa).toHaveBeenNthCalledWith(3, 'git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0']);
        expect(execa).toHaveBeenNthCalledWith(4, 'git', ['push', 'origin', 'v1.0.0']);

        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagAlreadyExists], git.log);
      });

      it('logs error when createAndPush fails', async () => {
        const error = new Error('Tag error');
        execa.mockRejectedValueOnce(error);

        await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToCheckTagExists], git.log);
      });
    });

    describe('exists()', () => {
      it('returns true when tag exists', async () => {
        execa.mockResolvedValueOnce({stdout: 'v1.0.0'});

        const result = await git.tag.exists('v1.0.0');

        expect(execa).toHaveBeenCalledWith('git', ['tag', '-l', 'v1.0.0']);
        expect(result).toBe(true);
      });

      it('returns false when tag does not exist', async () => {
        execa.mockResolvedValueOnce({stdout: ''});

        const result = await git.tag.exists('v2.0.0');

        expect(result).toBe(false);
      });

      it('logs error and returns false when check fails', async () => {
        const error = new Error('Git error');
        execa.mockRejectedValueOnce(error);

        const result = await git.tag.exists('v1.0.0');

        expect(result).toBe(false);
        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToCheckTagExists], git.log);
      });
    });

    describe('lastTag()', () => {
      it('returns the last created tag', async () => {
        execa.mockResolvedValueOnce({stdout: 'v1.0.0'});

        const result = await git.tag.lastCreated();

        expect(execa).toHaveBeenCalledWith('git', ['describe', '--tags', '--abbrev=0']);
        expect(result).toBe('v1.0.0');
      });

      it('logs error when no tags are found', async () => {
        const error = new Error('No tags found');
        execa.mockRejectedValueOnce(error);
        execa.mockRejectedValueOnce(new Error('No commits found'));

        const result = await git.tag.lastCreated();

        expect(result).toBeNull();
        setupPinoLoggingCallsTest('warn', [{error: error.message}, git.warnFailedToGetLastCreatedTag], git.log);
      });
    });

    describe('push()', () => {
      it('pushes a tag to origin', async () => {
        execa.mockResolvedValueOnce({});

        await git.tag.push('v1.0.0');

        expect(execa).toHaveBeenCalledWith('git', ['push', 'origin', 'v1.0.0']);
        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagPushed], git.log);
      });

      it('logs error when push fails', async () => {
        const error = new Error('Push failed');
        execa.mockRejectedValueOnce(error);

        await git.tag.push('v1.0.0');

        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToPushTag], git.log);
      });
    });

    describe('remove()', () => {
      it('removes a tag', async () => {
        execa.mockResolvedValueOnce({});

        await git.tag.remove('v1.0.0');

        expect(execa).toHaveBeenCalledWith('git', ['tag', '-d', 'v1.0.0']);
        setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagDeleted], git.log);
      });

      it('logs error when tag removal fails', async () => {
        const error = new Error('Removal failed');
        execa.mockRejectedValueOnce(error);

        await git.tag.remove('v1.0.0');

        setupPinoLoggingCallsTest('warn', [{tagName: 'v1.0.0', error}, git.warnFailedToDeleteTag], git.log);
      });
    });
  });

  describe('branch object', () => {
    describe('create()', () => {
      it('creates a new branch', async () => {
        execa.mockResolvedValueOnce({});

        const result = await git.branch.create('feature/new-feature');

        expect(execa).toHaveBeenCalledWith('git', ['checkout', '-b', 'feature/new-feature']);
        expect(result).toBe('feature/new-feature');
        setupPinoLoggingCallsTest('info', [{branchName: 'feature/new-feature'}, git.infoBranchCreated], git.log);
      });

      it('logs error when branch creation fails', async () => {
        const error = new Error('Branch creation failed');
        execa.mockRejectedValueOnce(error);

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
        execa.mockResolvedValueOnce({});

        await git.branch.createVersion('1.0.0');

        expect(execa).toHaveBeenCalledWith('git', ['checkout', '-b', 'version_bump_v1.0.0']);
      });
    });

    describe('remove()', () => {
      it('removes a branch', async () => {
        execa.mockResolvedValueOnce({});

        await git.branch.remove('feature/old-feature');

        expect(execa).toHaveBeenCalledWith('git', ['branch', '-d', 'feature/old-feature']);
        setupPinoLoggingCallsTest('info', [{branchName: 'feature/old-feature'}, git.infoBranchDeleted], git.log);
      });

      it('logs error when branch removal fails', async () => {
        const error = new Error('Branch removal failed');
        execa.mockRejectedValueOnce(error);

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
        execa.mockResolvedValueOnce({});

        await git.branch.push('feature/branch');

        expect(execa).toHaveBeenCalledWith('git', ['push', 'origin', 'feature/branch']);
        setupPinoLoggingCallsTest('info', [{branchName: 'feature/branch'}, git.infoBranchPushed], git.log);
      });

      it('logs error when branch push fails', async () => {
        const error = new Error('Push failed');
        execa.mockRejectedValueOnce(error);

        await git.branch.push('feature/branch');

        setupPinoLoggingCallsTest('warn', [{branchName: 'feature/branch', error}, git.warnFailedToPushBranch], git.log);
      });
    });
  });
});
