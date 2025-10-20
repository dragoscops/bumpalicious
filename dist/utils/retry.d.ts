export interface RetryOptions {
    readonly maxAttempts?: number;
    readonly initialDelayMs?: number;
    readonly maxDelayMs?: number;
    readonly backoffFactor?: number;
    readonly jitter?: boolean;
    readonly shouldRetry?: (error: unknown) => boolean;
    readonly operationName?: string;
}
export declare function retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
export declare function createRetryFunction(options: RetryOptions): <T>(operation: () => Promise<T>, overrides?: RetryOptions) => Promise<T>;
//# sourceMappingURL=retry.d.ts.map