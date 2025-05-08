import {execa} from 'execa';
import {describe, it, expect, beforeEach, vi, afterAll, beforeAll} from 'vitest';

import * as git from './git.js';
import {mockCConsole, unMockCConsole, setupLoggingCallsTest} from '../vitest/setup.logging.tests.js';

describe('git.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCConsole();
  });

  afterAll(() => {
    unMockCConsole();
  });

  describe('log object', () => {
    describe('lastMessage()', () => {
      it('returns the latest commit message', async () => {
        execa.mockResolvedValueOnce({stdout: 'feat: add new feature\n'});

        const message = await git.log.lastMessage();

        expect(execa).toHaveBeenCalledWith('git', ['log', '-1', '--pretty=%B']);
        expect(message).toBe('feat: add new feature');
      });

      it('logs error and returns undefined on failure', async () => {
        execa.mockRejectedValueOnce(new Error('Mocked error'));

        const message = await git.log.lastMessage();

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to get latest commit message'),
        ]);
        expect(message).toBeUndefined();
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

      const result = await git.getChangedFiles(repoPath, lastTag);

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining(`Error retrieving changed files in repository ${repoPath}:`),
        expect.any(Error),
      ]);
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

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to get git config'),
        ]);
        expect(config).toEqual({});
      });
    });

    describe('set()', () => {
      it('sets git config value and logs success message', async () => {
        execa.mockResolvedValueOnce({});

        await git.config.set({'user.name': 'Test User'});

        expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Git config user.name set to Test User'),
        ]);
      });

      it('logs error message when setting config fails', async () => {
        const error = new Error('Config error');
        execa.mockRejectedValueOnce(error);

        await git.config.set({'invalid.key': 'value'});

        expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'invalid.key', 'value']);
        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to set git config invalid.key'),
        ]);
      });
    });
  });

  describe('tag object', () => {
    describe('create()', () => {
      it('creates a tag with the specified name and message', async () => {
        execa.mockResolvedValueOnce({});

        await git.tag.create('v1.0.0', 'Version 1.0.0 release');

        expect(execa).toHaveBeenCalledWith('git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0 release']);
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Tag v1.0.0 created successfully'),
        ]);
      });

      it('logs error when tag creation fails', async () => {
        const error = new Error('Failed to create tag');
        execa.mockRejectedValueOnce(error);

        await git.tag.create('invalid-tag', 'message');

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to create tag invalid-tag'),
          expect.any(Error),
        ]);
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

        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Tag v1.0.0 already exists, removing it first'),
        ]);
      });

      // TODO: command contains multiple execa calls; need to mock them all
      // it('logs error when createAndPush fails', async () => {
      //   const error = new Error('Tag error');
      //   execa.mockRejectedValueOnce(error);

      //   await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

      //   setupLoggingCallsTest('error', [
      //     expect.stringContaining('ERROR'),
      //     expect.stringContaining('Failed to create and push tag v1.0.0'),
      //     expect.any(Error),
      //   ]);
      // });
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
        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to check if tag v1.0.0 exists'),
          expect.any(Error),
        ]);
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

        const result = await git.tag.lastCreated();

        expect(result).toBeUndefined();
        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to get last created tag'),
          expect.any(Error),
        ]);
      });
    });

    describe('push()', () => {
      it('pushes a tag to origin', async () => {
        execa.mockResolvedValueOnce({});

        await git.tag.push('v1.0.0');

        expect(execa).toHaveBeenCalledWith('git', ['push', 'origin', 'v1.0.0']);
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Tag v1.0.0 pushed successfully'),
        ]);
      });

      it('logs error when push fails', async () => {
        const error = new Error('Push failed');
        execa.mockRejectedValueOnce(error);

        await git.tag.push('v1.0.0');

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to push tag v1.0.0'),
          expect.any(Error),
        ]);
      });
    });

    describe('remove()', () => {
      it('removes a tag', async () => {
        execa.mockResolvedValueOnce({});

        await git.tag.remove('v1.0.0');

        expect(execa).toHaveBeenCalledWith('git', ['tag', '-d', 'v1.0.0']);
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Tag v1.0.0 deleted successfully'),
        ]);
      });

      it('logs error when tag removal fails', async () => {
        const error = new Error('Removal failed');
        execa.mockRejectedValueOnce(error);

        await git.tag.remove('v1.0.0');

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to delete tag v1.0.0'),
          expect.any(Error),
        ]);
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
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Branch feature/new-feature created successfully'),
        ]);
      });

      it('logs error when branch creation fails', async () => {
        const error = new Error('Branch creation failed');
        execa.mockRejectedValueOnce(error);

        await git.branch.create('invalid-branch');

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to create branch invalid-branch'),
          expect.any(Error),
        ]);
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
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Branch feature/old-feature deleted successfully'),
        ]);
      });

      it('logs error when branch removal fails', async () => {
        const error = new Error('Branch removal failed');
        execa.mockRejectedValueOnce(error);

        await git.branch.remove('non-existent-branch');

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to delete branch non-existent-branch'),
          expect.any(Error),
        ]);
      });
    });

    describe('push()', () => {
      it('pushes a branch to origin', async () => {
        execa.mockResolvedValueOnce({});

        await git.branch.push('feature/branch');

        expect(execa).toHaveBeenCalledWith('git', ['push', 'origin', 'feature/branch']);
        setupLoggingCallsTest('info', [
          expect.stringContaining('INFO'),
          expect.stringContaining('Branch feature/branch pushed successfully'),
        ]);
      });

      it('logs error when branch push fails', async () => {
        const error = new Error('Push failed');
        execa.mockRejectedValueOnce(error);

        await git.branch.push('feature/branch');

        setupLoggingCallsTest('error', [
          expect.stringContaining('ERROR'),
          expect.stringContaining('Failed to push branch feature/branch'),
          expect.any(Error),
        ]);
      });
    });
  });
});
