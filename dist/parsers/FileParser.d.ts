import type { Result } from '../types/result.js';
import type { ProjectInfo } from '../types/workspace.js';
import { FileOperationError } from '../utils/errors.js';
export interface ParserConfig {
    readonly format: 'json' | 'toml' | 'regex';
    readonly versionPath?: string;
    readonly namePath?: string;
    readonly versionPattern?: RegExp;
    readonly namePattern?: RegExp;
}
export declare function parseJsonFile(filePath: string, versionPath?: string, namePath?: string): Promise<Result<ProjectInfo, FileOperationError>>;
export declare function parseTomlFile(filePath: string, versionPath?: string, namePath?: string): Promise<Result<ProjectInfo, FileOperationError>>;
export declare function parseRegexFile(filePath: string, versionPattern: RegExp, namePattern?: RegExp, defaultName?: string): Promise<Result<ProjectInfo, FileOperationError>>;
export declare function configParser(filePath: string, config: ParserConfig): Promise<Result<ProjectInfo, FileOperationError>>;
export declare const VERSION_PATTERNS: {
    readonly PYTHON_SETUP: RegExp;
    readonly PYTHON_INIT: RegExp;
    readonly PYTHON_SETUP_CFG: RegExp;
    readonly GO_VERSION_COMMENT: RegExp;
    readonly GENERIC: RegExp;
};
export declare const NAME_PATTERNS: {
    readonly PYTHON_SETUP: RegExp;
    readonly PYTHON_SETUP_CFG: RegExp;
};
//# sourceMappingURL=FileParser.d.ts.map