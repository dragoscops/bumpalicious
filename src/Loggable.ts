import { logger } from './utils/logger';

export class Loggable {
  protected readonly log;

  constructor() {
    this.log = logger.child({ class: this.constructor.name });
  }
}
