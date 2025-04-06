/**
 * Unit tests for logging utilities
 * @module utils/logging.spec
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import * as core from '@actions/core';
import * as logging from './logging.js';
import {mockCConsole, mockConsole, unMockCConsole, unMockConsole} from '../vitest/setup.logging.tests.js';

describe('logging.js module', () => {
  // Store original environment and console methods
  const originalEnv = {...process.env};

  beforeEach(() => {
    mockCConsole();
  });

  afterEach(() => {
    // Restore environment and console
    process.env = {...originalEnv};
    unMockCConsole();
  });

  describe('formatWorkspace()', () => {
    it('formats workspace info correctly', () => {
      const workspace = {
        name: 'test-project',
        version: '1.0.0',
        type: 'node',
      };

      const result = logging.formatWorkspace(workspace);

      // In non-GitHub Actions environment, result should include ANSI codes
      expect(result).toContain('test-project');
      expect(result).toContain('1.0.0');
      expect(result).toContain('node');
    });
  });

  describe('error()', () => {
    it('logs error messages to console in non-GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'false';

      logging.error('Test error message');

      expect(logging.cconsole.error).toHaveBeenCalledWith(expect.stringContaining('ERROR:'), 'Test error message');
    });

    it('calls core.error in GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'true';

      logging.error('Test error message');

      expect(core.error).toHaveBeenCalledWith('Test error message');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('handles Error objects as arguments', () => {
      process.env.GITHUB_ACTIONS = 'false';
      const testError = new Error('Error object');

      logging.error('Test error message', testError);

      expect(logging.cconsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR:'),
        'Test error message',
        testError,
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('includes error message in core.error when in GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      const testError = new Error('Error object');

      logging.error('Test error message', testError);

      expect(core.error).toHaveBeenCalledWith('Test error message: Error object');
    });
  });

  for (const method of ['debug', 'info', 'notice', 'warning']) {
    describe(`${method}()`, () => {
      it(`logs ${method} messages to console in non-GitHub Actions environment`, () => {
        process.env.GITHUB_ACTIONS = 'false';
        logging[method](`Test ${method} message`);

        expect(logging.cconsole[method]).toHaveBeenCalledWith(
          expect.stringContaining(logging.clabels[method]),
          `Test ${method} message`,
        );
      });

      it('calls core.info in GitHub Actions environment', () => {
        process.env.GITHUB_ACTIONS = 'true';
        logging[method]('Test info message');

        expect(core[method]).toHaveBeenCalledWith('Test info message');
      });

      it('handles additional arguments', () => {
        process.env.GITHUB_ACTIONS = 'false';
        const additionalArg = {test: 'value'};

        logging[method]('Test message', additionalArg);

        expect(logging.cconsole[method]).toHaveBeenCalledWith(
          expect.stringContaining(logging.clabels[method]),
          'Test message',
          additionalArg,
        );
      });
    });
  }

  describe('startGroup() and endGroup()', () => {
    afterEach(() => {
      unMockConsole();
    });

    beforeEach(() => {
      mockConsole();
    });

    it('logs formatted group headers in non-GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'false';

      logging.startGroup('Test Group');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('=========='));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('=== Test Group ==='));
    });

    it('calls core.startGroup and core.endGroup in GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'true';

      logging.startGroup('Test Group');
      logging.endGroup();

      expect(core.startGroup).toHaveBeenCalledWith('Test Group');
      expect(core.endGroup).toHaveBeenCalled();
    });

    it('endGroup does nothing in non-GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'false';

      logging.endGroup();

      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
