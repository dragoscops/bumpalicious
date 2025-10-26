export declare abstract class BumpaliciousError extends Error {
    readonly cause?: unknown | undefined;
    abstract readonly code: string;
    abstract readonly recoverable: boolean;
    constructor(message: string, cause?: unknown | undefined);
    getFullMessage(): string;
}
export declare class GitOperationError extends BumpaliciousError {
    readonly code = "GIT_OPERATION_FAILED";
    readonly recoverable = false;
    constructor(operation: string, message: string, cause?: unknown);
}
export declare class WorkspaceDetectionError extends BumpaliciousError {
    readonly code = "WORKSPACE_DETECTION_FAILED";
    readonly recoverable = false;
    constructor(workspace: string, message: string, cause?: unknown);
}
export declare class WorkspaceValidationError extends BumpaliciousError {
    readonly code = "WORKSPACE_VALIDATION_FAILED";
    readonly recoverable = false;
    constructor(message: string, cause?: unknown);
}
export declare class InvalidConfigurationError extends BumpaliciousError {
    readonly code = "INVALID_CONFIGURATION";
    readonly recoverable = false;
    constructor(parameter: string, message: string, cause?: unknown);
}
export declare class GitHubAPIError extends BumpaliciousError {
    readonly statusCode?: number | undefined;
    readonly code = "GITHUB_API_FAILED";
    readonly recoverable = true;
    constructor(operation: string, message: string, statusCode?: number | undefined, cause?: unknown);
}
export declare class FileOperationError extends BumpaliciousError {
    readonly code = "FILE_OPERATION_FAILED";
    readonly recoverable = false;
    constructor(filePath: string, operation: string, message: string, cause?: unknown);
}
export declare class VersionCalculationError extends BumpaliciousError {
    readonly code = "VERSION_CALCULATION_FAILED";
    readonly recoverable = false;
    constructor(message: string, cause?: unknown);
}
export declare function isRecoverableError(error: unknown): boolean;
export declare function isBumpaliciousError(error: unknown): error is BumpaliciousError;
export declare function getErrorMessage(error: unknown): string;
export declare function wrapError(error: unknown, context: string): BumpaliciousError;
//# sourceMappingURL=errors.d.ts.map