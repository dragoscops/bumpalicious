"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createChildLogger = createChildLogger;
exports.maskSensitiveData = maskSensitiveData;
exports.formatError = formatError;
exports.logSafe = logSafe;
const pino_1 = __importDefault(require("pino"));
const isGitHubActionsDebug = process.env.ACTIONS_STEP_DEBUG === 'true';
const isDebugMode = process.env.DEBUG === 'true';
const LOG_LEVEL = process.env.LOG_LEVEL || (isGitHubActionsDebug || isDebugMode ? 'debug' : 'info');
const isDevelopment = process.env.NODE_ENV === 'development';
const loggerOptions = {
    level: LOG_LEVEL,
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
};
exports.logger = (0, pino_1.default)(loggerOptions);
function createChildLogger(bindings) {
    return exports.logger.child(bindings);
}
function maskSensitiveData(data) {
    const masked = { ...data };
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'authorization', 'auth'];
    for (const key of Object.keys(masked)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
            const value = masked[key];
            if (typeof value === 'string') {
                if (value.length >= 8) {
                    masked[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
                }
                else {
                    masked[key] = '***REDACTED***';
                }
            }
            else {
                masked[key] = '***REDACTED***';
            }
        }
    }
    return masked;
}
function formatError(error) {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
            ...error,
        };
    }
    return {
        message: String(error),
        type: typeof error,
    };
}
function logSafe(level, message, data) {
    if (data && typeof data === 'object' && data !== null) {
        const masked = maskSensitiveData(data);
        exports.logger[level](masked, message);
    }
    else {
        exports.logger[level](message);
    }
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map