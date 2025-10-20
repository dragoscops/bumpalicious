import type { Logger } from 'pino';
export declare const logger: Logger;
export declare function createChildLogger(bindings: Record<string, unknown>): Logger;
export declare function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown>;
export declare function formatError(error: Error | unknown): Record<string, unknown>;
export declare function logSafe(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', message: string, data?: Record<string, unknown>): void;
export default logger;
//# sourceMappingURL=logger.d.ts.map