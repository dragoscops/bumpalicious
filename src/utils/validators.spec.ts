/**
 * Tests for runtime input validation
 */

import { describe, it, expect } from 'vitest';
import { InvalidConfigurationError } from './errors.js';
import {
  WorkspaceTypeSchema,
  WorkspaceConfigSchema,
  ActionInputsSchema,
  validateInputs,
  validateWorkspaceConfig,
  validateWorkspaceConfigs,
} from './validators.js';
import type { ActionInputs, WorkspaceConfig } from '../types/index.js';

describe('WorkspaceTypeSchema', () => {
  it('should accept valid workspace types', () => {
    expect(WorkspaceTypeSchema.parse('node')).toBe('node');
    expect(WorkspaceTypeSchema.parse('python')).toBe('python');
    expect(WorkspaceTypeSchema.parse('deno')).toBe('deno');
    expect(WorkspaceTypeSchema.parse('go')).toBe('go');
    expect(WorkspaceTypeSchema.parse('rust')).toBe('rust');
    expect(WorkspaceTypeSchema.parse('zig')).toBe('zig');
    expect(WorkspaceTypeSchema.parse('text')).toBe('text');
  });

  it('should reject invalid workspace types', () => {
    expect(() => WorkspaceTypeSchema.parse('java')).toThrow();
    expect(() => WorkspaceTypeSchema.parse('cpp')).toThrow();
    expect(() => WorkspaceTypeSchema.parse('')).toThrow();
  });
});

describe('WorkspaceConfigSchema', () => {
  it('should accept valid workspace config', () => {
    const config = { path: '.', type: 'node' };
    expect(WorkspaceConfigSchema.parse(config)).toEqual(config);
  });

  it('should accept workspace config with nested path', () => {
    const config = { path: 'packages/api', type: 'python' };
    expect(WorkspaceConfigSchema.parse(config)).toEqual(config);
  });

  it('should reject empty path', () => {
    expect(() => WorkspaceConfigSchema.parse({ path: '', type: 'node' })).toThrow('Workspace path cannot be empty');
  });

  it('should reject path with ".." for security', () => {
    expect(() => WorkspaceConfigSchema.parse({ path: '../malicious', type: 'node' })).toThrow();
  });

  it('should reject invalid type', () => {
    expect(() => WorkspaceConfigSchema.parse({ path: '.', type: 'invalid' })).toThrow();
  });

  it('should reject missing path', () => {
    expect(() => WorkspaceConfigSchema.parse({ type: 'node' })).toThrow();
  });

  it('should reject missing type', () => {
    expect(() => WorkspaceConfigSchema.parse({ path: '.' })).toThrow();
  });
});

describe('ActionInputsSchema', () => {
  const validInputs: ActionInputs = {
    token: 'ghp_test123',
    workspaces: '.:node',
    createPr: false,
    autoMerge: false,
    prBaseBranch: 'main',
    prHeadBranch: 'version-bump',
    prTitle: 'Version Bump',
    prBody: 'Automated version bump',
    commitMessage: 'chore: bump version',
    tagPrefix: 'v',
    createShortTags: true,
    changelogPreset: 'conventionalcommits',
    debug: false,
  };

  it('should accept valid action inputs', () => {
    expect(ActionInputsSchema.parse(validInputs)).toEqual(validInputs);
  });

  it('should reject empty token', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, token: '' })).toThrow('GitHub token is required');
  });

  it('should reject empty workspaces', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, workspaces: '' })).toThrow(
      'At least one workspace must be specified',
    );
  });

  it('should reject empty prBaseBranch', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, prBaseBranch: '' })).toThrow(
      'PR base branch cannot be empty',
    );
  });

  it('should reject empty prHeadBranch', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, prHeadBranch: '' })).toThrow(
      'PR head branch cannot be empty',
    );
  });

  it('should reject empty prTitle', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, prTitle: '' })).toThrow('PR title cannot be empty');
  });

  it('should accept empty prBody', () => {
    const inputs = { ...validInputs, prBody: '' };
    expect(ActionInputsSchema.parse(inputs)).toEqual(inputs);
  });

  it('should reject empty commitMessage', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, commitMessage: '' })).toThrow(
      'Commit message cannot be empty',
    );
  });

  it('should accept empty tagPrefix', () => {
    const inputs = { ...validInputs, tagPrefix: '' };
    expect(ActionInputsSchema.parse(inputs)).toEqual(inputs);
  });

  it('should reject empty changelogPreset', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, changelogPreset: '' })).toThrow(
      'Changelog preset cannot be empty',
    );
  });

  it('should reject non-boolean createPr', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, createPr: 'true' })).toThrow();
  });

  it('should reject non-boolean autoMerge', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, autoMerge: 'false' })).toThrow();
  });

  it('should reject non-boolean debug', () => {
    expect(() => ActionInputsSchema.parse({ ...validInputs, debug: 1 })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => ActionInputsSchema.parse({})).toThrow();
  });
});

describe('validateInputs', () => {
  const validInputs: ActionInputs = {
    token: 'ghp_test123',
    workspaces: '.:node',
    createPr: false,
    autoMerge: false,
    prBaseBranch: 'main',
    prHeadBranch: 'version-bump',
    prTitle: 'Version Bump',
    prBody: 'Automated version bump',
    commitMessage: 'chore: bump version',
    tagPrefix: 'v',
    createShortTags: true,
    changelogPreset: 'conventionalcommits',
    debug: false,
  };

  it('should return validated inputs for valid data', () => {
    expect(validateInputs(validInputs)).toEqual(validInputs);
  });

  it('should throw InvalidConfigurationError for invalid inputs', () => {
    expect(() => validateInputs({ ...validInputs, token: '' })).toThrow(InvalidConfigurationError);
  });

  it('should include field paths in error message', () => {
    try {
      validateInputs({ ...validInputs, token: '' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigurationError);
      expect((error as InvalidConfigurationError).message).toContain('action inputs');
      expect((error as InvalidConfigurationError).message).toContain('token');
    }
  });

  it('should handle multiple validation errors', () => {
    try {
      validateInputs({ ...validInputs, token: '', workspaces: '' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigurationError);
      const message = (error as InvalidConfigurationError).message;
      expect(message).toContain('action inputs');
    }
  });

  it('should wrap unknown errors', () => {
    expect(() => validateInputs(null)).toThrow(InvalidConfigurationError);
  });
});

describe('validateWorkspaceConfig', () => {
  it('should return validated config for valid data', () => {
    const config = { path: '.', type: 'node' as const };
    expect(validateWorkspaceConfig(config)).toEqual(config);
  });

  it('should throw InvalidConfigurationError for invalid config', () => {
    expect(() => validateWorkspaceConfig({ path: '', type: 'node' })).toThrow(InvalidConfigurationError);
  });

  it('should include field paths in error message', () => {
    try {
      validateWorkspaceConfig({ path: '', type: 'node' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigurationError);
      expect((error as InvalidConfigurationError).message).toContain('workspace configuration');
      expect((error as InvalidConfigurationError).message).toContain('path');
    }
  });

  it('should reject path with ".."', () => {
    expect(() => validateWorkspaceConfig({ path: '../bad', type: 'node' })).toThrow(InvalidConfigurationError);
  });

  it('should wrap unknown errors', () => {
    expect(() => validateWorkspaceConfig(null)).toThrow(InvalidConfigurationError);
  });
});

describe('validateWorkspaceConfigs', () => {
  const validConfigs: WorkspaceConfig[] = [
    { path: '.', type: 'node' },
    { path: 'packages/api', type: 'python' },
  ];

  it('should return validated configs for valid array', () => {
    expect(validateWorkspaceConfigs(validConfigs)).toEqual(validConfigs);
  });

  it('should accept single workspace', () => {
    const configs = [{ path: '.', type: 'node' as const }];
    expect(validateWorkspaceConfigs(configs)).toEqual(configs);
  });

  it('should throw InvalidConfigurationError for non-array', () => {
    expect(() => validateWorkspaceConfigs('not an array')).toThrow(InvalidConfigurationError);
    expect(() => validateWorkspaceConfigs('not an array')).toThrow('must be an array');
  });

  it('should throw InvalidConfigurationError for empty array', () => {
    expect(() => validateWorkspaceConfigs([])).toThrow(InvalidConfigurationError);
    expect(() => validateWorkspaceConfigs([])).toThrow('at least one workspace');
  });

  it('should throw InvalidConfigurationError for invalid config in array', () => {
    const configs = [
      { path: '.', type: 'node' },
      { path: '', type: 'python' },
    ];

    try {
      validateWorkspaceConfigs(configs);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigurationError);
      expect((error as InvalidConfigurationError).message).toContain('workspaces[1]');
    }
  });

  it('should include index in error message', () => {
    const configs = [
      { path: '.', type: 'node' },
      { path: '', type: 'python' },
      { path: 'pkg', type: 'go' },
    ];

    try {
      validateWorkspaceConfigs(configs);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigurationError);
      expect((error as InvalidConfigurationError).message).toContain('workspaces[1]');
    }
  });

  it('should wrap unknown errors', () => {
    const configs = [{ path: '.', type: 'node' }, null];
    expect(() => validateWorkspaceConfigs(configs)).toThrow(InvalidConfigurationError);
  });
});
