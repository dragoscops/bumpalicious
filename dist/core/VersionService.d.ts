import type { Version, BumpType, CommitAnalysis } from '../types/version.js';
export declare class VersionService {
    calculateNewVersion(currentVersion: string, analysis: CommitAnalysis): Version;
    increaseVersion(currentVersion: Version, bumpType: BumpType): Version;
    private calculatePreReleaseVersion;
}
//# sourceMappingURL=VersionService.d.ts.map