import type { Version } from '../types/version.js';
import type { Result } from '../types/result.js';
import { FileOperationError } from '../utils/errors.js';
export interface UpdaterConfig {
    readonly format: 'json' | 'toml' | 'regex';
    readonly versionPath?: string;
    readonly versionPattern?: RegExp;
    readonly versionReplacement?: string;
}
export declare function updateJsonFile(filePath: string, newVersion: Version, versionPath?: string): Promise<Result<void, FileOperationError>>;
export declare function updateTomlFile(filePath: string, newVersion: Version, versionPath?: string): Promise<Result<void, FileOperationError>>;
export declare function updateRegexFile(filePath: string, newVersion: Version, versionPattern: RegExp, versionReplacement: string): Promise<Result<void, FileOperationError>>;
export declare function configUpdater(filePath: string, newVersion: Version, config: UpdaterConfig): Promise<Result<void, FileOperationError>>;
//# sourceMappingURL=FileUpdater.d.ts.map