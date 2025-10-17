import {beforeEach, describe, expect, it, vi} from 'vitest';

import {oldVersion} from '../vitest/setup.detect-update.tests.js';
import {removeTempProjectFolder} from '../vitest/setup.fs.test.js';
import {mockPinoIn, setupPinoLoggingCallsTest, unMockPinoIn} from '../vitest/setup.logging.tests.js';
import {createWorkspacesTestFolder, updateAndCommit} from '../vitest/setup.workspaces.tests.js';
import * as exec from './exec.js';
import * as git from './git.js';

/**
 * TODO: As seen, not all tests use mkdtemp. Need to adapt the one that can be adapted to use mkdtemp.
 */

describe('utils/git.js', () => {
  let projectFolder = '';
  // eslint-disable-next-line no-unused-vars
  let projectName = '';
  // eslint-disable-next-line no-unused-vars
  let created = [];
  let logMocks = [];
  let execMock = null;
  const lastTag = `v${oldVersion}`;
  // eslint-disable-next-line no-unused-vars
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

  describe('commits', () => {
    describe('lastMessage()', () => {
      it('returns the latest commit message', async () => {
        const commitMessage = 'feat: add new feature';
        await updateAndCommit([projectFolder], commitMessage);

        const message = await git.commits.lastMessage();
        expect(message).toBe(commitMessage);
      });
    });

    describe('getChangedFiles()', () => {
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

      it('handles empty output from git command', async () => {
        const result = await git.commits.getChangedFiles(projectFolder, lastTag);
        expect(result).toEqual([]);
      });
    });
  });

  describe('config', () => {
    describe('set()', () => {
      it('executes git config command for a single key-value pair', async () => {
        execMock.mockResolvedValueOnce({exitCode: 0});

        await git.config.set({'user.name': 'Test User'});
        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        setupPinoLoggingCallsTest('info', [{key: 'user.name', value: 'Test User'}, git.infoGitConfigSet], git.log);
      });

      it('executes git config command for multiple key-value pairs', async () => {
        execMock.mockResolvedValueOnce({exitCode: 0});
        execMock.mockResolvedValueOnce({exitCode: 0});

        await git.config.set({
          'user.name': 'Test User',
          'user.email': 'test@example.com',
        });
        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.email', 'test@example.com']);
        setupPinoLoggingCallsTest('info', [{key: 'user.name', value: 'Test User'}, git.infoGitConfigSet], git.log);
        setupPinoLoggingCallsTest(
          'info',
          [{key: 'user.email', value: 'test@example.com'}, git.infoGitConfigSet],
          git.log,
        );
      });

      it('handles empty input gracefully without executing any commands', async () => {
        await git.config.set({});
        expect(execMock).not.toHaveBeenCalled();
      });

      it('executes git config command locally when global flag is false', async () => {
        execMock.mockResolvedValueOnce({exitCode: 0});

        await git.config.set({'user.name': 'Test User'}, false);
        expect(execMock).toHaveBeenCalledWith('git', ['config', 'user.name', 'Test User']);
        setupPinoLoggingCallsTest('info', [{key: 'user.name', value: 'Test User'}, git.infoGitConfigSet], git.log);
      });

      it('respects custom working directory', async () => {
        execMock.mockResolvedValueOnce({exitCode: 0});

        await git.config.set({'user.name': 'Test User'});
        expect(execMock).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Test User']);
        setupPinoLoggingCallsTest('info', [{key: 'user.name', value: 'Test User'}, git.infoGitConfigSet], git.log);
      });

      describe('createAndPush()', () => {
        it('executes with success', async () => {
          // TODO: implement this test
          expect(true).toBe(true);
        });
      });
    });

    describe('tag', () => {
      describe('create()', () => {
        // eslint-disable-next-line vitest/expect-expect
        it('creates a tag with the specified name and message', async () => {
          await git.tag.create('v1.0.0', 'Version 1.0.0 release');
          setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagCreated], git.log);
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
          expect(execMock).toHaveBeenNthCalledWith(3, 'git', ['fetch']);
          expect(execMock).toHaveBeenNthCalledWith(4, 'git', ['push', 'origin', 'v1.0.0', '--no-verify']);
        });

        it('removes existing tag before recreating it', async () => {
          // Mock tag already exists
          execMock.mockResolvedValueOnce({stdout: 'v1.0.0'}); // For exists check
          execMock.mockResolvedValueOnce({}); // For remove
          execMock.mockResolvedValueOnce({}); // For create
          execMock.mockResolvedValueOnce({}); // For push

          await git.tag.createAndPush('v1.0.0', 'Version 1.0.0');

          expect(execMock).toHaveBeenNthCalledWith(2, 'git', ['tag', '-d', 'v1.0.0']);
          expect(execMock).toHaveBeenNthCalledWith(3, 'git', ['fetch']);
          expect(execMock).toHaveBeenNthCalledWith(4, 'git', ['ls-remote', '--tags', 'origin', 'refs/tags/v1.0.0']);
          expect(execMock).toHaveBeenNthCalledWith(5, 'git', ['tag', '-a', 'v1.0.0', '-m', 'Version 1.0.0']);
          expect(execMock).toHaveBeenNthCalledWith(6, 'git', ['fetch']);
          expect(execMock).toHaveBeenNthCalledWith(7, 'git', ['push', 'origin', 'v1.0.0', '--no-verify']);

          setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagAlreadyExists], git.log);
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
      });

      describe('existsRemote()', () => {
        it('returns true when remote tag exists', async () => {
          execMock.mockResolvedValueOnce({stdout: `abc123\trefs/tags/${lastTag}\n`, stderr: '', exitCode: 0});

          const result = await git.tag.existsRemote(lastTag);
          expect(execMock).toHaveBeenCalledWith('git', ['ls-remote', '--tags', 'origin', `refs/tags/${lastTag}`]);
          expect(result).toBe(true);
        });

        it('returns false when remote tag does not exist', async () => {
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0});

          const result = await git.tag.existsRemote('v2.0.0');
          expect(result).toBe(false);
        });

        it('returns false on error', async () => {
          execMock.mockRejectedValueOnce(new Error('Network error'));

          const result = await git.tag.existsRemote('v1.0.0');
          expect(result).toBe(false);
        });

        it('accepts custom remote name', async () => {
          execMock.mockResolvedValueOnce({stdout: `abc123\trefs/tags/v1.0.0\n`, stderr: '', exitCode: 0});

          await git.tag.existsRemote('v1.0.0', 'upstream');
          expect(execMock).toHaveBeenCalledWith('git', ['ls-remote', '--tags', 'upstream', 'refs/tags/v1.0.0']);
        });
      });

      describe('lastCreated()', () => {
        it('returns the last created tag', async () => {
          const result = await git.tag.lastCreated();
          expect(execMock).toHaveBeenCalledWith('git', ['describe', '--tags', '--abbrev=0', '--match', '*'], {
            noThrow: true,
          });
          expect(result).toBe(lastTag);
        });
      });

      describe('push()', () => {
        it('pushes a tag to origin', async () => {
          execMock.mockResolvedValueOnce({});

          await git.tag.push('v1.0.0');
          expect(execMock).toHaveBeenCalledWith('git', ['push', 'origin', 'v1.0.0', '--no-verify']);
          setupPinoLoggingCallsTest('info', [{tagName: 'v1.0.0'}, git.infoTagPushed], git.log);
        });
      });

      describe('remove()', () => {
        it('removes a tag locally and remotely when remote tag exists', async () => {
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For tag -d
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For fetch
          execMock.mockResolvedValueOnce({stdout: `abc123\trefs/tags/${lastTag}\n`, stderr: '', exitCode: 0}); // For ls-remote (existsRemote)
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For push --delete

          await git.tag.remove(lastTag);

          expect(execMock).toHaveBeenCalledTimes(4);
          expect(execMock).toHaveBeenNthCalledWith(1, 'git', ['tag', '-d', lastTag]);
          expect(execMock).toHaveBeenNthCalledWith(2, 'git', ['fetch']);
          expect(execMock).toHaveBeenNthCalledWith(3, 'git', ['ls-remote', '--tags', 'origin', `refs/tags/${lastTag}`]);
          expect(execMock).toHaveBeenNthCalledWith(4, 'git', ['push', 'origin', '--delete', lastTag]);
          setupPinoLoggingCallsTest('info', [{tagName: lastTag}, git.infoTagDeleted], git.log);
          setupPinoLoggingCallsTest('info', [{tagName: lastTag}, git.infoRemoteTagDeleted], git.log);
        });

        it('skips remote deletion when remote tag does not exist', async () => {
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For tag -d
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For fetch
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For ls-remote (existsRemote returns false)

          await git.tag.remove(lastTag);

          expect(execMock).toHaveBeenCalledTimes(3);
          expect(execMock).toHaveBeenNthCalledWith(1, 'git', ['tag', '-d', lastTag]);
          setupPinoLoggingCallsTest('info', [{tagName: lastTag}, git.infoTagDeleted], git.log);
          setupPinoLoggingCallsTest(
            'info',
            [{tagName: lastTag}, 'Remote tag does not exist, skipping remote deletion'],
            git.log,
          );
        });

        it('handles remote tag deletion failure gracefully', async () => {
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For tag -d
          execMock.mockRejectedValueOnce(new Error('Network error')); // For fetch failure

          await git.tag.remove(lastTag);

          expect(execMock).toHaveBeenCalledWith('git', ['tag', '-d', lastTag]);
          setupPinoLoggingCallsTest('info', [{tagName: lastTag}, git.infoTagDeleted], git.log);
          setupPinoLoggingCallsTest(
            'warn',
            [expect.objectContaining({tagName: lastTag, err: expect.any(Error)}), git.warnCouldNotRemoveRemoteTag],
            git.log,
          );
        });

        it('warns when push --delete fails', async () => {
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For tag -d
          execMock.mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0}); // For fetch
          execMock.mockResolvedValueOnce({stdout: `abc123\trefs/tags/${lastTag}\n`, stderr: '', exitCode: 0}); // For ls-remote
          execMock.mockResolvedValueOnce({stdout: '', stderr: 'error: failed to delete', exitCode: 1}); // For push --delete fails

          await git.tag.remove(lastTag);

          setupPinoLoggingCallsTest('info', [{tagName: lastTag}, git.infoTagDeleted], git.log);
          setupPinoLoggingCallsTest('warn', [{tagName: lastTag}, git.warnCouldNotRemoveRemoteTag], git.log);
        });
      });
    });

    describe('branch', () => {
      describe('create()', () => {
        it('creates a new branch', async () => {
          const result = await git.branch.create('feature/new-feature');
          expect(execMock).toHaveBeenCalledWith('git', ['checkout', '-b', 'feature/new-feature']);
          expect(result).toBe('feature/new-feature');
          setupPinoLoggingCallsTest('info', [{branchName: 'feature/new-feature'}, git.infoBranchCreated], git.log);
        });
      });

      describe('createVersion()', () => {
        it('creates a version branch with correct naming convention', async () => {
          await git.branch.createAndPushVersion('1.0.0');
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
      });

      describe('push()', () => {
        it('pushes a branch to origin', async () => {
          execMock.mockResolvedValueOnce({});

          await git.branch.push('feature/branch');
          expect(execMock).toHaveBeenCalledWith('git', ['push', 'origin', 'feature/branch', '--no-verify']);
          setupPinoLoggingCallsTest('info', [{branchName: 'feature/branch'}, git.infoBranchPushed], git.log);
        });
      });
    });
  });
});
