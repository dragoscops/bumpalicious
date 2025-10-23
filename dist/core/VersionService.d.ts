import type { Version, BumpType, CommitAnalysis } from '../types/version.js';
import { Loggable } from '../utils/Loggable.js';
export declare class VersionService extends Loggable {
    constructor();
    calculateNewVersion(currentVersion: string, analysis: CommitAnalysis): Version;
    increaseVersion(currentVersion: Version, bumpType: BumpType): Version;
    private calculatePreReleaseVersion;
}
//# sourceMappingURL=VersionService.d.ts.map