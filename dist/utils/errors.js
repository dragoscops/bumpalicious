"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCalculationError = exports.FileOperationError = exports.GitHubAPIError = exports.InvalidConfigurationError = exports.WorkspaceValidationError = exports.WorkspaceDetectionError = exports.GitOperationError = exports.BumpaliciousError = void 0;
exports.isRecoverableError = isRecoverableError;
exports.isBumpaliciousError = isBumpaliciousError;
exports.getErrorMessage = getErrorMessage;
exports.wrapError = wrapError;
class BumpaliciousError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = this.constructor.name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    getFullMessage() {
        if (this.cause) {
            const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
            return `${this.message} (caused by: ${causeMessage})`;
        }
        return this.message;
    }
}
exports.BumpaliciousError = BumpaliciousError;
class GitOperationError extends BumpaliciousError {
    code = 'GIT_OPERATION_FAILED';
    recoverable = false;
    constructor(operation, message, cause) {
        super(`Git operation '${operation}' failed: ${message}`, cause);
    }
}
exports.GitOperationError = GitOperationError;
class WorkspaceDetectionError extends BumpaliciousError {
    code = 'WORKSPACE_DETECTION_FAILED';
    recoverable = false;
    constructor(workspace, message, cause) {
        super(`Workspace detection failed for '${workspace}': ${message}`, cause);
    }
}
exports.WorkspaceDetectionError = WorkspaceDetectionError;
class WorkspaceValidationError extends BumpaliciousError {
    code = 'WORKSPACE_VALIDATION_FAILED';
    recoverable = false;
    constructor(message, cause) {
        super(`Workspace validation failed: ${message}`, cause);
    }
}
exports.WorkspaceValidationError = WorkspaceValidationError;
class InvalidConfigurationError extends BumpaliciousError {
    code = 'INVALID_CONFIGURATION';
    recoverable = false;
    constructor(parameter, message, cause) {
        super(`Invalid configuration for '${parameter}': ${message}`, cause);
    }
}
exports.InvalidConfigurationError = InvalidConfigurationError;
class GitHubAPIError extends BumpaliciousError {
    statusCode;
    code = 'GITHUB_API_FAILED';
    recoverable = true;
    constructor(operation, message, statusCode, cause) {
        super(`GitHub API operation '${operation}' failed: ${message}`, cause);
        this.statusCode = statusCode;
    }
}
exports.GitHubAPIError = GitHubAPIError;
class FileOperationError extends BumpaliciousError {
    code = 'FILE_OPERATION_FAILED';
    recoverable = false;
    constructor(filePath, operation, message, cause) {
        super(`File operation '${operation}' failed for '${filePath}': ${message}`, cause);
    }
}
exports.FileOperationError = FileOperationError;
class VersionCalculationError extends BumpaliciousError {
    code = 'VERSION_CALCULATION_FAILED';
    recoverable = false;
    constructor(message, cause) {
        super(`Version calculation failed: ${message}`, cause);
    }
}
exports.VersionCalculationError = VersionCalculationError;
function isRecoverableError(error) {
    if (error instanceof BumpaliciousError) {
        return error.recoverable;
    }
    return false;
}
function isBumpaliciousError(error) {
    return error instanceof BumpaliciousError;
}
function getErrorMessage(error) {
    if (error instanceof BumpaliciousError) {
        return error.getFullMessage();
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function wrapError(error, context) {
    if (isBumpaliciousError(error)) {
        return error;
    }
    const message = getErrorMessage(error);
    return new GitOperationError('unknown', `${context}: ${message}`, error);
}
//# sourceMappingURL=errors.js.map