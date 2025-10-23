/**
 * Base class for loggable components
 *
 * Provides a structured logging interface with automatic context injection.
 * Each subclass gets a child logger with its class name as context.
 *
 * Usage:
 * ```typescript
 * class MyService extends Loggable {
 *   doSomething() {
 *     this.log.info('Operation started');
 *     this.log.debug({ param: value }, 'Processing data');
 *   }
 * }
 * ```
 *
 * The logger automatically includes the class name in all log messages:
 * ```
 * {"level":30,"class":"MyService","msg":"Operation started"}
 * ```
 */

import type { Logger } from 'pino';
import { logger } from './logger.js';

/**
 * Base class providing structured logging capabilities
 *
 * Automatically creates a child logger with the class name as context.
 * All log messages from the class will include the class name for easier debugging.
 */
export abstract class Loggable {
  /**
   * Child logger instance with class name context
   *
   * Available log levels:
   * - trace: Most detailed, typically for line-by-line execution
   * - debug: Detailed information for debugging
   * - info: General informational messages
   * - warn: Warning messages for potentially problematic situations
   * - error: Error messages for failures
   * - fatal: Critical errors that may cause application termination
   */
  protected readonly log: Logger;

  /**
   * Initialize loggable instance with child logger
   *
   * Creates a child logger that includes the class name in all log entries.
   */
  constructor() {
    this.log = logger.child({ class: this.constructor.name });
  }
}
