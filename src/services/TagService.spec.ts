/**
 * TagService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GitService } from './GitService.js';
import { TagService } from './TagService.js';
import { ok, err } from '../types/result.js';
import type { Version } from '../types/version.js';
import { GitOperationError } from '../utils/errors.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('TagService', () => {
  let tagService: TagService;
  let mockGitService: GitService;

  beforeEach(() => {
    mockGitService = {
      createTag: vi.fn(),
      tagExists: vi.fn(),
      deleteTag: vi.fn(),
      getRef: vi.fn(),
    } as unknown as GitService;

    tagService = new TagService(mockGitService);
  });

  describe('createVersionTags', () => {
    const version: Version = '2.0.0' as Version;
    const commitSha = 'abc123def456';

    it('should create master version tag', async () => {
      vi.mocked(mockGitService.createTag).mockResolvedValue(
        ok({ name: 'v2.0.0', sha: 'tag123', message: 'Release 2.0.0' }),
      );

      const result = await tagService.createVersionTags(version, commitSha);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('v2.0.0');
      }

      expect(mockGitService.createTag).toHaveBeenCalledWith({
        tagName: 'v2.0.0',
        message: 'Release 2.0.0',
        commitSha,
      });
    });

    it('should create short tag when requested', async () => {
      vi.mocked(mockGitService.createTag).mockResolvedValue(ok({ name: 'v2', sha: 'tag123', message: 'Release v2' }));
      vi.mocked(mockGitService.tagExists).mockResolvedValue(ok(false));

      const result = await tagService.createVersionTags(version, commitSha, { shortTag: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('v2.0.0');
        expect(result.value).toContain('v2');
      }

      expect(mockGitService.createTag).toHaveBeenCalledWith(
        expect.objectContaining({
          tagName: 'v2',
          message: expect.stringContaining('latest: 2.0.0'),
        }),
      );
    });

    it('should update existing short tag', async () => {
      vi.mocked(mockGitService.createTag).mockResolvedValue(ok({ name: 'v2', sha: 'tag123', message: 'Release v2' }));
      vi.mocked(mockGitService.tagExists).mockResolvedValue(ok(true));
      vi.mocked(mockGitService.deleteTag).mockResolvedValue(ok(undefined));

      const result = await tagService.createVersionTags(version, commitSha, { shortTag: true });

      expect(result.ok).toBe(true);
      expect(mockGitService.deleteTag).toHaveBeenCalledWith('v2');
      expect(mockGitService.createTag).toHaveBeenCalledWith(
        expect.objectContaining({
          tagName: 'v2',
        }),
      );
    });

    it('should not create short tag if it equals master tag', async () => {
      const singleVersion: Version = '2' as Version;
      vi.mocked(mockGitService.createTag).mockResolvedValue(ok({ name: 'v2', sha: 'tag123', message: 'Release 2' }));

      const result = await tagService.createVersionTags(singleVersion, commitSha, { shortTag: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value).toContain('v2');
      }
    });

    it('should handle master tag creation failure', async () => {
      vi.mocked(mockGitService.createTag).mockResolvedValue(
        err(new GitOperationError('createTag', 'Tag creation failed')),
      );

      const result = await tagService.createVersionTags(version, commitSha);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Tag creation failed');
      }
    });

    it('should continue if short tag creation fails', async () => {
      vi.mocked(mockGitService.createTag)
        .mockResolvedValueOnce(ok({ name: 'v2.0.0', sha: 'tag123', message: 'Release 2.0.0' }))
        .mockResolvedValueOnce(err(new GitOperationError('createTag', 'Short tag failed')));
      vi.mocked(mockGitService.tagExists).mockResolvedValue(ok(false));

      const result = await tagService.createVersionTags(version, commitSha, { shortTag: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('v2.0.0');
        expect(result.value).not.toContain('v2');
      }
    });

    it('should continue if short tag deletion fails', async () => {
      vi.mocked(mockGitService.createTag).mockResolvedValue(ok({ name: 'v2', sha: 'tag123', message: 'Release v2' }));
      vi.mocked(mockGitService.tagExists).mockResolvedValue(ok(true));
      vi.mocked(mockGitService.deleteTag).mockResolvedValue(err(new GitOperationError('deleteTag', 'Delete failed')));

      const result = await tagService.createVersionTags(version, commitSha, { shortTag: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('v2.0.0');
      }
    });
  });

  describe('createVersionTagsForBranch', () => {
    const version: Version = '2.0.0' as Version;
    const branch = 'main';

    it('should get branch HEAD and create tags', async () => {
      vi.mocked(mockGitService.getRef).mockResolvedValue(ok({ ref: 'refs/heads/main', sha: 'abc123' }));
      vi.mocked(mockGitService.createTag).mockResolvedValue(
        ok({ name: 'v2.0.0', sha: 'tag123', message: 'Release 2.0.0' }),
      );

      const result = await tagService.createVersionTagsForBranch(version, branch);

      expect(result.ok).toBe(true);
      expect(mockGitService.getRef).toHaveBeenCalledWith('heads/main');
      expect(mockGitService.createTag).toHaveBeenCalledWith(
        expect.objectContaining({
          commitSha: 'abc123',
        }),
      );
    });

    it('should handle getRef failure', async () => {
      vi.mocked(mockGitService.getRef).mockResolvedValue(err(new GitOperationError('getRef', 'Failed to get ref')));

      const result = await tagService.createVersionTagsForBranch(version, branch);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to get ref');
      }
    });
  });
});
