export type Version = string & {
    readonly __brand: 'Version';
};
export declare function isVersion(value: string): value is Version;
export declare function toVersion(value: string): Version;
export type BumpType = 'major' | 'minor' | 'patch' | 'pre-release';
export type PreReleaseIdentifier = 'alpha' | 'beta' | 'rc';
export interface CommitAnalysis {
    readonly type: BumpType;
    readonly breaking: boolean;
    readonly preRelease?: PreReleaseIdentifier;
    readonly scope?: string;
    readonly message: string;
}
export interface VersionCalculation {
    readonly current: Version;
    readonly next: Version;
    readonly bump: BumpType;
    readonly commits: ReadonlyArray<CommitAnalysis>;
}
//# sourceMappingURL=version.d.ts.map