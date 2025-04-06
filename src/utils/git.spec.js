import {execa} from 'execa';
import {describe, it, expect, beforeEach, vi, afterAll, beforeAll} from 'vitest';

import * as git from './git.js';
import * as logging from './logging.js';
import {mockConsole, unMockConsole} from '../vitest/setup.detect-update.tests.js';

describe('git.js module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole();
  });

  afterAll(() => {
    unMockConsole();
  });

  describe('setupUser()', () => {
    it('configures git user for GitHub', async () => {
      await git.setupUser({platform: 'github'});

      expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'GitHub Actions']);
      expect(execa).toHaveBeenNthCalledWith(2, 'git', ['config', '--global', 'user.email', 'actions@github.com']);
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/.*Git user configured successfully/));
    });

    it('configures git user for Gitea', async () => {
      await git.setupUser({platform: 'gitea'});

      expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'user.name', 'Gitea CI']);
      expect(execa).toHaveBeenCalledWith('git', ['config', '--global', 'user.email', 'ci@gitea.com']);
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/.*Git user configured successfully/));
    });

    it('adds workspace to safe directories if provided', async () => {
      await git.setupUser({
        platform: 'github',
        workspace: '/path/to/workspace',
      });

      expect(execa).toHaveBeenCalledWith('git', [
        'config',
        '--global',
        '--add',
        'safe.directory',
        '/path/to/workspace',
      ]);
    });

    it('log error when unsupported platform is given', async () => {
      await git.setupUser({platform: 'unsupported'})

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unsupported platform: unsupported'));
    });

    it('logs error when ', async () => {
      execa.mockRejectedValueOnce(new Error('Mocked error'));
      process.env.GITHUB_WORKSPACE = '/path/to/workspace';

      try {
      await git.setupUser({platform: 'github'})

      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/.*Failed to configure git user/));
      } finally {
        delete process.env.GITHUB_WORKSPACE;
      }
    });
  });

  describe('lastCreatedTag()', () => {
    it('returns the last tag when tags are present', async () => {
      execa.mockResolvedValueOnce({stdout: 'v1.0.0\n'});

      const lastTag = await git.lastCreatedTag();

      expect(execa).toHaveBeenCalledWith('git', ['describe', '--tags', '--abbrev=0']);
      expect(lastTag).toBe('v1.0.0');
    });

    it('returns null and logs warning when no tags are found', async () => {
      execa.mockRejectedValueOnce(new Error('fatal: No names found, cannot describe anything.'));

      const lastTag = await git.lastCreatedTag();

      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/.*No tags found in the repository/));
      expect(lastTag).toBeNull();
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

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get latest commit message'));
      expect(message).toBe('');
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

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error retrieving changed files in repository ${repoPath}:`),
      );
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

  // describe("hasUncommittedChanges", () => {
  //   it("returns true when there are uncommitted changes", async () => {
  //     execa.mockResolvedValueOnce({ stdout: " M modified_file.js\n" });

  //     const hasChanges = await hasUncommittedChanges();

  //     expect(execa).toHaveBeenCalledWith("git", ["status", "--porcelain"]);
  //     expect(hasChanges).toBe(true);
  //   });

  //   it("returns false when there are no uncommitted changes", async () => {
  //     execa.mockResolvedValueOnce({ stdout: "\n" });

  //     const hasChanges = await hasUncommittedChanges();

  //     expect(execa).toHaveBeenCalledWith("git", ["status", "--porcelain"]);
  //     expect(hasChanges).toBe(false);
  //   });

  //   it("returns true and logs error on failure", async () => {
  //     execa.mockRejectedValueOnce(new Error("Mocked error"));

  //     const hasChanges = await hasUncommittedChanges();

  //     expect(logging.error).toHaveBeenCalledWith(
  //       "Failed to check for uncommitted changes",
  //       expect.any(Error),
  //     );
  //     expect(hasChanges).toBe(true);
  //   });
  // });

  // describe("commitVersionChanges", () => {
  //   it("commits version changes with all files when no files are specified", async () => {
  //     const message = "chore: Release v1.0.0";

  //     const result = await commitVersionChanges({ message });

  //     expect(execa).toHaveBeenNthCalledWith(1, "git", ["add", "."]);
  //     expect(execa).toHaveBeenNthCalledWith(2, "git", [
  //       "commit",
  //       "-m",
  //       message,
  //     ]);
  //     expect(logging.success).toHaveBeenCalledWith(
  //       `Created commit: ${message}`,
  //     );
  //     expect(result).toBe(true);
  //   });

  //   it("commits version changes with specified files", async () => {
  //     const message = "chore: Release v1.0.0";
  //     const files = ["package.json", "CHANGELOG.md"];

  //     const result = await commitVersionChanges({ message, files });

  //     expect(execa).toHaveBeenNthCalledWith(1, "git", [
  //       "add",
  //       "package.json",
  //       "CHANGELOG.md",
  //     ]);
  //     expect(execa).toHaveBeenNthCalledWith(2, "git", [
  //       "commit",
  //       "-m",
  //       message,
  //     ]);
  //     expect(result).toBe(true);
  //   });

  //   it("commits version changes with --no-verify when noVerify is true", async () => {
  //     const message = "chore: Release v1.0.0";

  //     const result = await commitVersionChanges({ message, noVerify: true });

  //     expect(execa).toHaveBeenNthCalledWith(1, "git", ["add", "."]);
  //     expect(execa).toHaveBeenNthCalledWith(2, "git", [
  //       "commit",
  //       "-m",
  //       message,
  //       "--no-verify",
  //     ]);
  //     expect(result).toBe(true);
  //   });

  //   it("returns false and logs error on failure", async () => {
  //     execa.mockRejectedValueOnce(new Error("Mocked error"));
  //     const message = "chore: Release v1.0.0";

  //     const result = await commitVersionChanges({ message });

  //     expect(logging.error).toHaveBeenCalledWith(
  //       "Failed to commit version changes",
  //       expect.any(Error),
  //     );
  //     expect(result).toBe(false);
  //   });
  // });

  // describe("createVersionTag", () => {
  //   it("creates a tag successfully", async () => {
  //     const tagName = "v1.0.0";
  //     const message = "Release v1.0.0";

  //     const result = await createVersionTag({ tagName, message });

  //     expect(execa).toHaveBeenCalledWith("git", [
  //       "tag",
  //       "-a",
  //       tagName,
  //       "-m",
  //       message,
  //     ]);
  //     expect(logging.success).toHaveBeenCalledWith(`Created tag: ${tagName}`);
  //     expect(result).toBe(true);
  //   });

  //   it("creates a tag with force when force is true", async () => {
  //     const tagName = "v1.0.0";
  //     const message = "Release v1.0.0";

  //     const result = await createVersionTag({
  //       tagName,
  //       message,
  //       force: true,
  //     });

  //     expect(execa).toHaveBeenCalledWith("git", [
  //       "tag",
  //       "-a",
  //       tagName,
  //       "-m",
  //       message,
  //       "-f",
  //     ]);
  //     expect(result).toBe(true);
  //   });

  //   it("returns false and logs error on failure", async () => {
  //     execa.mockRejectedValueOnce(new Error("Mocked error"));
  //     const tagName = "v1.0.0";
  //     const message = "Release v1.0.0";

  //     const result = await createVersionTag({ tagName, message });

  //     expect(logging.error).toHaveBeenCalledWith(
  //       `Failed to create version tag ${tagName}`,
  //       expect.any(Error),
  //     );
  //     expect(result).toBe(false);
  //   });
  // });

  // describe("pushChanges", () => {
  //   it("pushes changes and tags to remote", async () => {
  //     const result = await pushChanges({});

  //     expect(execa).toHaveBeenNthCalledWith(1, "git", ["push", "origin"]);
  //     expect(execa).toHaveBeenNthCalledWith(2, "git", [
  //       "push",
  //       "origin",
  //       "--tags",
  //     ]);
  //     expect(logging.success).toHaveBeenCalledWith(
  //       "Pushed changes and tags to origin",
  //     );
  //     expect(result).toBe(true);
  //   });

  //   it("pushes changes to specified branch", async () => {
  //     const branch = "develop";
  //     await pushChanges({ branch });

  //     expect(execa).toHaveBeenCalledWith("git", ["push", "origin", branch]);
  //   });

  //   it("pushes changes with force when forcePush is true", async () => {
  //     await pushChanges({ forcePush: true });

  //     expect(execa).toHaveBeenCalledWith("git", ["push", "--force", "origin"]);
  //   });

  //   it("pushes changes with --no-verify when noVerify is true", async () => {
  //     await pushChanges({ noVerify: true });

  //     expect(execa).toHaveBeenNthCalledWith(1, "git", [
  //       "push",
  //       "--no-verify",
  //       "origin",
  //     ]);
  //     expect(execa).toHaveBeenNthCalledWith(2, "git", [
  //       "push",
  //       "--no-verify",
  //       "origin",
  //       "--tags",
  //     ]);
  //   });

  //   it("returns false and logs error on failure", async () => {
  //     execa.mockRejectedValueOnce(new Error("Mocked error"));

  //     const result = await pushChanges({});

  //     expect(logging.error).toHaveBeenCalledWith(
  //       "Failed to push changes",
  //       expect.any(Error),
  //     );
  //     expect(result).toBe(false);
  //   });
  // });

  // describe("getRemoteUrl", () => {
  //   it("returns the remote URL", async () => {
  //     execa.mockResolvedValueOnce({ stdout: "git@github.com:user/repo.git\n" });

  //     const remoteUrl = await getRemoteUrl("origin");

  //     expect(execa).toHaveBeenCalledWith("git", [
  //       "remote",
  //       "get-url",
  //       "origin",
  //     ]);
  //     expect(remoteUrl).toBe("git@github.com:user/repo.git");
  //   });

  //   it("returns null and logs error on failure", async () => {
  //     execa.mockRejectedValueOnce(new Error("Mocked error"));

  //     const remoteUrl = await getRemoteUrl("origin");

  //     expect(logging.error).toHaveBeenCalledWith(
  //       "Failed to get URL for remote origin",
  //       expect.any(Error),
  //     );
  //     expect(remoteUrl).toBeNull();
  //   });
  // });

  // describe("getCurrentBranch", () => {
  //   it("returns the current branch name", async () => {
  //     execa.mockResolvedValueOnce({ stdout: "main\n" });

  //     const branchName = await getCurrentBranch();

  //     expect(execa).toHaveBeenCalledWith("git", [
  //       "symbolic-ref",
  //       "--short",
  //       "HEAD",
  //     ]);
  //     expect(branchName).toBe("main");
  //   });

  //   it("returns null and logs warning when in detached HEAD state", async () => {
  //     execa.mockRejectedValueOnce(new Error("Mocked error"));

  //     const branchName = await getCurrentBranch();

  //     expect(logging.warning).toHaveBeenCalledWith(
  //       "Failed to get current branch name, might be in detached HEAD state",
  //     );
  //     expect(branchName).toBeNull();
  //   });
  // });
});
