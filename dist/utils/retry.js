"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
exports.createRetryFunction = createRetryFunction;
const errors_js_1 = require("./errors.js");
const logger_js_1 = require("./logger.js");
const DEFAULT_OPTIONS = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2,
    jitter: true,
    shouldRetry: errors_js_1.isRecoverableError,
};
function calculateDelay(attempt, options) {
    const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffFactor, attempt);
    let delay = Math.min(exponentialDelay, options.maxDelayMs);
    if (options.jitter) {
        delay = Math.random() * delay;
    }
    return Math.floor(delay);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retry(operation, options = {}) {
    const config = {
        ...DEFAULT_OPTIONS,
        ...options,
    };
    const operationName = options.operationName || 'operation';
    let lastError;
    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
            if (attempt > 0) {
                logger_js_1.logger.debug(`Retry attempt ${attempt + 1}/${config.maxAttempts} for ${operationName}`);
            }
            const result = await operation();
            if (attempt > 0) {
                logger_js_1.logger.info(`${operationName} succeeded on attempt ${attempt + 1}`);
            }
            return result;
        }
        catch (error) {
            lastError = error;
            const shouldRetry = config.shouldRetry(error);
            if (!shouldRetry) {
                logger_js_1.logger.debug({ error: error instanceof Error ? error.message : String(error) }, `${operationName} failed with non-retryable error`);
                throw error;
            }
            if (attempt >= config.maxAttempts - 1) {
                logger_js_1.logger.warn({ error: error instanceof Error ? error.message : String(error) }, `${operationName} failed after ${config.maxAttempts} attempts`);
                break;
            }
            const delay = calculateDelay(attempt, config);
            logger_js_1.logger.debug({
                attempt: attempt + 1,
                maxAttempts: config.maxAttempts,
                error: error instanceof Error ? error.message : String(error),
            }, `${operationName} failed, retrying in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastError;
}
function createRetryFunction(options) {
    return (operation, overrides) => {
        return retry(operation, { ...options, ...overrides });
    };
}
//# sourceMappingURL=retry.js.map