import type { Logger } from 'pino';
export declare abstract class Loggable {
    protected readonly log: Logger;
    constructor();
}
