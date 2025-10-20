import { z } from 'zod';
import type { ActionInputs, WorkspaceConfig } from '../types/index.js';
export declare const WorkspaceTypeSchema: z.ZodEnum<{
    node: "node";
    python: "python";
    deno: "deno";
    go: "go";
    rust: "rust";
    zig: "zig";
    text: "text";
}>;
export declare const WorkspaceConfigSchema: z.ZodObject<{
    path: z.ZodString;
    type: z.ZodEnum<{
        node: "node";
        python: "python";
        deno: "deno";
        go: "go";
        rust: "rust";
        zig: "zig";
        text: "text";
    }>;
}, z.core.$strip>;
export declare const ActionInputsSchema: z.ZodObject<{
    token: z.ZodString;
    workspaces: z.ZodString;
    createPr: z.ZodBoolean;
    autoMerge: z.ZodBoolean;
    prBaseBranch: z.ZodString;
    prHeadBranch: z.ZodString;
    prTitle: z.ZodString;
    prBody: z.ZodString;
    commitMessage: z.ZodString;
    tagPrefix: z.ZodString;
    createShortTags: z.ZodBoolean;
    changelogPreset: z.ZodString;
    debug: z.ZodBoolean;
}, z.core.$strip>;
export declare function validateInputs(inputs: unknown): ActionInputs;
export declare function validateWorkspaceConfig(config: unknown): WorkspaceConfig;
export declare function validateWorkspaceConfigs(configs: unknown): ReadonlyArray<WorkspaceConfig>;
//# sourceMappingURL=validators.d.ts.map