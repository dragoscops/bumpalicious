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

  // describe('setupUser()', () => {
  //   it('configures git user for GitHub', async () => {
  //     await git.setupUser({platform: 'github'});

  //     expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'GitHub Actions']);
  //     expect(execa).toHaveBeenNthCalledWith(2, 'git', ['config', '--global', 'user.email', 'actions@github.com']);
  //     setupLoggingCallsTest('info', [
  //       expect.stringContaining('INFO'),
  //       expect.stringMatching(/.*Git user configured successfully/),
  //     ]);
  //   });

  //   it('adds workspace to safe directories if provided', async () => {
  //     await git.setupUser({
  //       platform: 'github',
  //       workspace: '/path/to/workspace',
  //     });

  //     expect(execa).toHaveBeenCalledWith('git', [
  //       'config',
  //       '--global',
  //       '--add',
  //       'safe.directory',
  //       '/path/to/workspace',
  //     ]);
  //   });

  //   it('logs error when failing to configure git user', async () => {
  //     execa.mockRejectedValueOnce(new Error('Mocked error'));
  //     process.env.GITHUB_WORKSPACE = '/path/to/workspace';

  //     try {
  //       await git.setupUser({platform: 'github'});

  //       setupLoggingCallsTest('error', [
  //         expect.stringContaining('ERROR'),
  //         expect.stringMatching(/.*Failed to configure git user/),
  //         expect.any(Error),
  //       ]);
  //     } finally {
  //       delete process.env.GITHUB_WORKSPACE;
  //     }
  //   });
  // });

  describe('lastCreatedTag()', () => {
    it('returns the last tag when tags are present', async () => {
      execa.mockResolvedValueOnce({stdout: 'v1.0.0\n'});

      const lastTag = await git.lastCreatedTag();

      expect(execa).toHaveBeenCalledWith('git', ['describe', '--tags', '--abbrev=0']);
      expect(lastTag).toBe('v1.0.0');
    });

    it('logs error when no tags are found', async () => {
      execa.mockRejectedValueOnce(new Error('fatal: No names found, cannot describe anything.'));

      const lastTag = await git.lastCreatedTag();

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringMatching(/.*No tags found in the repository/),
      ]);
    });
  });

  describe('lastCommitMessage()', () => {
    it('returns the latest commit message', async () => {
      execa.mockResolvedValueOnce({stdout: 'feat: add new feature\n'});

      const message = await git.lastCommitMessage();

      expect(execa).toHaveBeenCalledWith('git', ['log', '-1', '--pretty=%B']);
      expect(message).toBe('feat: add new feature');
    });

    it('returns empty string and logs error on failure', async () => {
      execa.mockRejectedValueOnce(new Error('Mocked error'));

      const message = await git.lastCommitMessage();

      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR'),
        expect.stringContaining('Failed to get latest commit message'),
      ]);
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
});
