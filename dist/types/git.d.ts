export interface GitTag {
    readonly name: string;
    readonly sha: string;
    readonly message?: string;
}
export interface GitCommit {
    readonly sha: string;
    readonly message: string;
    readonly author: {
        readonly name: string;
        readonly email: string;
    };
    readonly date: string;
}
export interface GitTree {
    readonly sha: string;
    readonly url: string;
}
export interface GitRef {
    readonly ref: string;
    readonly sha: string;
}
export interface FileChange {
    readonly path: string;
    readonly status: 'added' | 'modified' | 'removed' | 'renamed';
    readonly additions: number;
    readonly deletions: number;
}
export interface GitComparison {
    readonly base: string;
    readonly head: string;
    readonly files: ReadonlyArray<FileChange>;
    readonly commits: ReadonlyArray<GitCommit>;
}
export interface CreateTagParams {
    readonly tagName: string;
    readonly message: string;
    readonly commitSha: string;
    readonly taggerName?: string;
    readonly taggerEmail?: string;
}
export interface CreateCommitParams {
    readonly message: string;
    readonly tree: string;
    readonly parents: ReadonlyArray<string>;
    readonly author?: {
        readonly name: string;
        readonly email: string;
    };
}
export interface UpdateRefParams {
    readonly ref: string;
    readonly sha: string;
    readonly force?: boolean;
}
export interface FileContent {
    readonly path: string;
    readonly content: string;
    readonly encoding: 'base64' | 'utf-8';
    readonly sha: string;
    readonly size: number;
}
export interface GetFileContentParams {
    readonly path: string;
    readonly ref?: string;
}
export interface UpdateFileParams {
    readonly path: string;
    readonly content: string;
    readonly message: string;
    readonly sha?: string;
    readonly branch?: string;
}
export interface FileUpdateResponse {
    readonly sha: string;
    readonly commit: {
        readonly sha: string;
        readonly message: string;
    };
}
export interface RepositoryInfo {
    readonly owner: string;
    readonly repo: string;
}
//# sourceMappingURL=git.d.ts.map