# Implementation Plan: Bumpalicious TypeScript Migration

**Plan ID**: PLAN-001
**Source Document**: `low-level-design.md`
**Created**: 2025-10-17
**Delivery Strategy**: Bottom-up incremental (utilities → services → core → orchestration)
**Estimated Duration**: 8 weeks
**Total Items**: 30 tasks

---

## Overview

This plan breaks down the TypeScript migration and API-based refactor into 30 granular tasks, ordered from foundational utilities to final integration. Each task is sized to minimize risk and enable continuous validation.

**Ordering Strategy**:

1. Foundation: TypeScript setup, types, utilities (Tasks 1-8)
2. Low-level services: File parsing, commit parsing, error handling (Tasks 9-14)
3. GitHub API integration: Git operations, PR service (Tasks 15-18)
4. Workspace adapters: Language-specific handlers (Tasks 19-26)
5. Core orchestration: Workspace tree, version service, changelog (Tasks 27-29)
6. Final integration: Entry point and end-to-end testing (Task 30)

---

## Task List

### Task 1: TypeScript Project Setup

**ID**: TSK-001
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Dependencies**: None
**Source**: Section 5.3, 10.2, 13.1

**Description**:
Set up TypeScript configuration and build tooling for the project.

**Acceptance Criteria**:

- [ ] `tsconfig.json` created extending `@templ-project/tsconfig/cjs.json`
- [ ] Compiler options configured (declaration, sourceMap, etc.)
- [ ] Build scripts added to `package.json` (`build`, `build:dev`, `type-check`)
- [ ] `.gitignore` updated to exclude `dist/` and build artifacts
- [ ] TypeScript compiles successfully with `tsc --noEmit`
- [ ] `@vercel/ncc` bundling works for CommonJS output

**Implementation Notes**:

```json
// tsconfig.json
{
  "extends": "@templ-project/tsconfig/cjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "**/*.spec.ts", "**/*.test.ts", "test/**/*", "**/fixtures/**"]
}
```

---

### Task 2: Core Type Definitions

**ID**: TSK-002
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Dependencies**: TSK-001
**Source**: Section 8.1.2

**Description**:
Create foundational TypeScript type definitions for the entire project.

**Acceptance Criteria**:

- [ ] `src/types/version.ts` created with `Version` branded type
- [ ] `src/types/workspace.ts` created with `WorkspaceConfig`, `Workspace`, `WorkspaceNode`, `WorkspaceTree` interfaces
- [ ] `src/types/action.ts` created with `ActionInputs` interface
- [ ] `src/types/git.ts` created with git operation types
- [ ] `Result<T, E>` type utility defined
- [ ] `CommitAnalysis` interface defined
- [ ] `WorkspaceType` union type defined
- [ ] All types exported from index files
- [ ] Type-level tests pass (if using `tsd`)

**Implementation Notes**:

- Use `readonly` for all properties
- Use branded types for domain-specific strings (`Version`)
- Include JSDoc comments for documentation

---

### Task 3: Custom Error Classes

**ID**: TSK-003
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Dependencies**: TSK-002
**Source**: Section 8.6

**Description**:
Implement custom error hierarchy for type-safe error handling.

**Acceptance Criteria**:

- [ ] `src/utils/errors.ts` created
- [ ] `BumpaliciousError` abstract base class implemented
- [ ] `GitOperationError` class implemented
- [ ] `WorkspaceDetectionError` class implemented
- [ ] `WorkspaceValidationError` class implemented
- [ ] `InvalidConfigurationError` class implemented
- [ ] `isRecoverableError` type guard function implemented
- [ ] Unit tests in `errors.spec.ts` with 100% coverage
- [ ] Error codes documented (e.g., `GIT_OPERATION_FAILED`)

**Implementation Notes**:

```typescript
abstract class BumpaliciousError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

---

### Task 4: Logger Utility

**ID**: TSK-004
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 2 hours
**Dependencies**: TSK-002
**Source**: Section 5.3

**Description**:
Migrate logging utility to TypeScript with structured logging support.

**Acceptance Criteria**:

- [ ] `src/utils/logger.ts` created
- [ ] Pino logger configured with TypeScript types
- [ ] Child logger creation method implemented
- [ ] Log level configuration from environment
- [ ] Pretty printing for development
- [ ] JSON output for production
- [ ] Unit tests in `logger.spec.ts` covering all log levels
- [ ] No sensitive data logged (token masking)

---

### Task 5: Retry Logic Utility

**ID**: TSK-005
**Type**: Task
**Priority**: P2 (Medium)
**Estimate**: 2 hours
**Dependencies**: TSK-003, TSK-004
**Source**: Section 6.3

**Description**:
Implement retry logic with exponential backoff for network operations.

**Acceptance Criteria**:

- [ ] `src/utils/retry.ts` created
- [ ] `retry<T>` function with configurable attempts
- [ ] Exponential backoff strategy implemented
- [ ] Jitter added to prevent thundering herd
- [ ] Retry on specific error types only
- [ ] Max retry count: 3 (configurable)
- [ ] Unit tests in `retry.spec.ts` with mock timers
- [ ] Integration with logger for retry attempts

---

### Task 6: Input Validation with Zod

**ID**: TSK-006
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Dependencies**: TSK-002
**Source**: Section 8.8

**Description**:
Implement runtime input validation using Zod schemas.

**Acceptance Criteria**:

- [ ] `src/utils/validators.ts` created
- [ ] `WorkspaceTypeSchema` Zod enum defined
- [ ] `WorkspaceConfigSchema` Zod object defined
- [ ] `ActionInputsSchema` Zod object defined
- [ ] `validateInputs` function implemented
- [ ] Meaningful error messages for validation failures
- [ ] Unit tests in `validators.spec.ts` covering valid/invalid inputs
- [ ] Integration with action input parsing

---

### Task 7: Workspace Input Parser

**ID**: TSK-007
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Dependencies**: TSK-002, TSK-006
**Source**: Section 8.1.4

**Description**:
Parse and validate workspace input string from action.yml.

**Acceptance Criteria**:

- [ ] `parseWorkspacesInput` function implemented
- [ ] Support both `;` and `,` separators
- [ ] Parse format: `"path:type;path2:type2"`
- [ ] Normalize paths (`.` and `./` handling)
- [ ] Validate workspace types
- [ ] Throw `InvalidConfigurationError` on malformed input
- [ ] Unit tests covering various input formats
- [ ] Edge case tests (empty string, single workspace, invalid format)

**Test Cases**:

```typescript
".:node;packages/api:python" → [{path: ".", type: "node"}, {path: "packages/api", type: "python"}]
".:node,tools:go" → [{path: ".", type: "node"}, {path: "tools", type: "go"}]
"invalid" → throws InvalidConfigurationError
```

---

### Task 8: Test Fixtures Setup

**ID**: TSK-008
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 2 hours
**Dependencies**: TSK-002
**Source**: Section 9.5

**Description**:
Create reusable test fixtures for unit and integration tests.

**Acceptance Criteria**:

- [ ] `src/core/fixtures/workspaces.ts` created with mock workspaces
- [ ] `src/core/fixtures/versions.ts` created with version samples
- [ ] `src/parsers/fixtures/commit-messages.ts` created
- [ ] `test/fixtures/repos/setup.ts` created with `setupTestRepo` function
- [ ] Mock repository templates for node, python, monorepo
- [ ] Fixtures typed with proper interfaces
- [ ] Documentation for using fixtures in tests

---

### Task 9: Conventional Commit Parser

**ID**: TSK-009
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 4 hours
**Dependencies**: TSK-002, TSK-003
**Source**: Section 8.1.2, FR-002

**Description**:
Implement parser for conventional commit messages to determine version bump type.

**Acceptance Criteria**:

- [ ] `src/parsers/ConventionalCommitParser.ts` created
- [ ] Parse `feat:` → minor bump
- [ ] Parse `fix:` → patch bump
- [ ] Parse `BREAKING CHANGE:` or `feat!:` → major bump
- [ ] Parse `pre-release:identifier` → extract identifier
- [ ] Handle scopes (e.g., `feat(api):`)
- [ ] Return `CommitAnalysis` object
- [ ] Unit tests in `ConventionalCommitParser.spec.ts` covering all patterns
- [ ] Test pre-release scenarios (alpha, beta, rc)

**Test Cases**:

```typescript
"feat: add feature" → {type: "minor", breaking: false}
"fix: bug" → {type: "patch", breaking: false}
"feat!: breaking" → {type: "major", breaking: true}
"feat: feature pre-release:alpha" → {type: "minor", preRelease: "alpha"}
```

---

### Task 10: Generic File Parser

**ID**: TSK-010
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 3 hours
**Dependencies**: TSK-002, TSK-003
**Source**: Section 8.5

**Description**:
Create generic file parser for extracting version and name from various file formats.

**Acceptance Criteria**:

- [ ] `src/parsers/FileParser.ts` created
- [ ] `configParser` function implemented
- [ ] Support JSON parsing (for `package.json`)
- [ ] Support TOML parsing (for `pyproject.toml`, `Cargo.toml`)
- [ ] Support regex extraction (for `setup.py`, `__init__.py`)
- [ ] Handle nested paths (e.g., `project.version`)
- [ ] Return `Result<ProjectInfo>` type
- [ ] Unit tests for each parser type
- [ ] Test with real-world config files

---

### Task 11: Generic File Updater

**ID**: TSK-011
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 3 hours
**Dependencies**: TSK-010
**Source**: Section 8.5 (update.js migration)

**Description**:
Create generic file updater for modifying version numbers in various formats.

**Acceptance Criteria**:

- [ ] `src/parsers/FileUpdater.ts` created
- [ ] `configUpdater` function implemented
- [ ] Support JSON updates
- [ ] Support TOML updates
- [ ] Support regex-based updates
- [ ] Detect existing version before update
- [ ] Return `Result<boolean>` indicating success
- [ ] Unit tests with temporary files
- [ ] Rollback on failure

---

### Task 12: Base Workspace Adapter

**ID**: TSK-012
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Dependencies**: TSK-002, TSK-010, TSK-011
**Source**: Section 8.5

**Description**:
Create abstract base class for workspace type adapters.

**Acceptance Criteria**:

- [ ] `src/core/adapters/BaseAdapter.ts` created
- [ ] Abstract methods: `detect()`, `update()`
- [ ] Abstract properties: `type`, `supportedFiles`
- [ ] Protected methods: `createParser()`, `createUpdater()`
- [ ] Type-safe return values with `Result<T>`
- [ ] Documentation for implementing adapters
- [ ] Unit tests for base behavior (if testable)

**Implementation Notes**:

```typescript
abstract class BaseWorkspaceAdapter {
  abstract readonly type: WorkspaceType;
  abstract readonly supportedFiles: ReadonlyArray<string>;
  abstract detect(path: string): Promise<Result<ProjectInfo>>;
  abstract update(path: string, version: Version): Promise<Result<void>>;
  protected abstract createParser(filePath: string): FileParser;
  protected abstract createUpdater(filePath: string): FileUpdater;
}
```

---

### Task 13: Node.js Workspace Adapter

**ID**: TSK-013
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Dependencies**: TSK-012
**Source**: Section 8.5, FR-001

**Description**:
Implement workspace adapter for Node.js projects.

**Acceptance Criteria**:

- [ ] `src/core/adapters/NodeAdapter.ts` created
- [ ] Detect version from `package.json` and `jsr.json`
- [ ] Update both files if present
- [ ] Handle missing files gracefully
- [ ] Unit tests in `NodeAdapter.spec.ts`
- [ ] Test with fixtures (real `package.json` files)
- [ ] Test edge cases (malformed JSON, missing version)

---

### Task 14: Python Workspace Adapter

**ID**: TSK-014
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 3 hours
**Dependencies**: TSK-012
**Source**: FR-001

**Description**:
Implement workspace adapter for Python projects.

**Acceptance Criteria**:

- [ ] `src/core/adapters/PythonAdapter.ts` created
- [ ] Detect from `pyproject.toml`, `poetry.toml`, `setup.py`, `setup.cfg`, `__init__.py`
- [ ] Support multiple file formats (TOML, Python regex)
- [ ] Update all matching files
- [ ] Unit tests in `PythonAdapter.spec.ts`
- [ ] Test with real Python project structures

---

### Task 15: Deno Workspace Adapter

**ID**: TSK-015
**Type**: Task
**Priority**: P2 (Medium)
**Estimate**: 2 hours
**Dependencies**: TSK-012
**Source**: FR-001

**Description**:
Implement workspace adapter for Deno projects.

**Acceptance Criteria**:

- [ ] `src/core/adapters/DenoAdapter.ts` created
- [ ] Detect from `deno.json`, `deno.jsonc`, `jsr.json`
- [ ] Handle JSON with comments (JSONC)
- [ ] Unit tests in `DenoAdapter.spec.ts`
- [ ] Test with Deno project fixtures

---

### Task 16: Go Workspace Adapter

**ID**: TSK-016
**Type**: Task
**Priority**: P2 (Medium)
**Estimate**: 2 hours
**Dependencies**: TSK-012
**Source**: FR-001

**Description**:
Implement workspace adapter for Go projects.

**Acceptance Criteria**:

- [ ] `src/core/adapters/GoAdapter.ts` created
- [ ] Detect from `go.mod` comments, `version.go`, `version.txt`
- [ ] Handle Go module version format
- [ ] Unit tests in `GoAdapter.spec.ts`
- [ ] Test with Go project fixtures

---

### Task 17: Rust Workspace Adapter

**ID**: TSK-017
**Type**: Task
**Priority**: P2 (Medium)
**Estimate**: 2 hours
**Dependencies**: TSK-012
**Source**: FR-001

**Description**:
Implement workspace adapter for Rust projects.

**Acceptance Criteria**:

- [ ] `src/core/adapters/RustAdapter.ts` created
- [ ] Detect from `Cargo.toml`
- [ ] Parse TOML `[package]` section
- [ ] Unit tests in `RustAdapter.spec.ts`
- [ ] Test with Rust project fixtures

---

### Task 18: Zig Workspace Adapter

**ID**: TSK-018
**Type**: Task
**Priority**: P2 (Medium)
**Estimate**: 2 hours
**Dependencies**: TSK-012
**Source**: FR-001

**Description**:
Implement workspace adapter for Zig projects.

**Acceptance Criteria**:

- [ ] `src/core/adapters/ZigAdapter.ts` created
- [ ] Detect from `build.zig`, `build.zig.zon`
- [ ] Parse Zig syntax for version
- [ ] Unit tests in `ZigAdapter.spec.ts`
- [ ] Test with Zig project fixtures

---

### Task 19: Text Workspace Adapter

**ID**: TSK-019
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 1 hour
**Dependencies**: TSK-012
**Source**: FR-001

**Description**:
Implement fallback workspace adapter for text-based version files.

**Acceptance Criteria**:

- [ ] `src/core/adapters/TextAdapter.ts` created
- [ ] Detect from `version`, `version.txt`, `VERSION`, `VERSION.txt`
- [ ] Simple text file read/write
- [ ] Unit tests in `TextAdapter.spec.ts`
- [ ] Test with plain text fixtures

---

### Task 20: Workspace Adapter Factory

**ID**: TSK-020
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 2 hours
**Dependencies**: TSK-013 through TSK-019
**Source**: Section 5.2

**Description**:
Create factory for instantiating workspace adapters by type.

**Acceptance Criteria**:

- [ ] `src/core/adapters/AdapterFactory.ts` created
- [ ] `getAdapter(type: WorkspaceType)` function
- [ ] Return appropriate adapter instance
- [ ] Throw error for unknown types
- [ ] Unit tests for factory
- [ ] Singleton pattern (if needed for performance)

---

### Task 21: GitHub API Service

**ID**: TSK-021
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Dependencies**: TSK-002, TSK-003, TSK-005
**Source**: Section 8.3

**Description**:
Create wrapper service for GitHub API (Octokit) with retry logic.

**Acceptance Criteria**:

- [ ] `src/services/GitHubService.ts` created
- [ ] Initialize Octokit with token
- [ ] Repository context (owner, repo) from environment
- [ ] Retry logic for API calls
- [ ] Rate limit handling
- [ ] Unit tests in `GitHubService.spec.ts` with mocked Octokit
- [ ] Test rate limit scenarios

---

### Task 22: Git Operations Service

**ID**: TSK-022
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 4 hours
**Dependencies**: TSK-021
**Source**: Section 8.3, OBJ-02

**Description**:
Implement Git operations using GitHub API (replace shell commands).

**Acceptance Criteria**:

- [ ] `src/services/GitOperations.ts` created
- [ ] `createTag()` using `octokit.git.createTag` and `createRef`
- [ ] `createCommit()` using `octokit.git.createCommit`
- [ ] `updateRef()` for branch updates
- [ ] `getChangedFiles()` using `octokit.repos.compareCommits`
- [ ] `getLastTag()` using `octokit.repos.listTags`
- [ ] Fallback to git CLI for unsupported operations
- [ ] Unit tests with mocked Octokit
- [ ] Integration tests with test repository

**API Examples**:

```typescript
async createTag(tagName: string, message: string, commitSha: string): Promise<Result<GitTag>>
async createCommit(message: string, tree: string, parents: string[]): Promise<Result<Commit>>
async getChangedFiles(base: string, head: string, path?: string): Promise<Result<string[]>>
```

---

### Task 23: Pull Request Service

**ID**: TSK-023
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 3 hours
**Dependencies**: TSK-021
**Source**: Section 8.2.2, FR-004

**Description**:
Implement pull request creation and management service.

**Acceptance Criteria**:

- [ ] `src/services/PRService.ts` created
- [ ] `create()` method for PR creation
- [ ] `merge()` method with auto-merge support
- [ ] `hasMerged()` polling method with timeout
- [ ] `exists()` check for existing PRs
- [ ] Build PR body with workspace versions (from Section 8.2.2)
- [ ] Unit tests with mocked Octokit
- [ ] Test PR body formatting

---

### Task 24: Repository Service

**ID**: TSK-024
**Type**: Task
**Priority**: P2 (Medium)
**Estimate**: 2 hours
**Dependencies**: TSK-021
**Source**: Section 5.3

**Description**:
Implement repository queries and file operations.

**Acceptance Criteria**:

- [ ] `src/services/RepositoryService.ts` created
- [ ] `getFileContent()` method
- [ ] `updateFile()` method
- [ ] `getCommits()` method for history
- [ ] Unit tests with mocked Octokit
- [ ] Error handling for missing files

---

### Task 25: Workspace Tree Builder

**ID**: TSK-025
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 5 hours
**Dependencies**: TSK-002, TSK-003, TSK-020
**Source**: Section 8.1.3

**Description**:
Implement workspace tree builder with hierarchy validation.

**Acceptance Criteria**:

- [ ] `src/core/WorkspaceTreeBuilder.ts` created
- [ ] `build()` method taking flat workspace list
- [ ] Identify root workspace (shortest path)
- [ ] Validate only one root exists
- [ ] Build recursive tree structure
- [ ] Validate change propagation (children → root)
- [ ] Return `WorkspaceTree` with `masterVersion`
- [ ] Throw `WorkspaceValidationError` for violations
- [ ] Unit tests covering valid/invalid hierarchies
- [ ] Test error: multiple roots
- [ ] Test error: children changed but root unchanged

**Test Cases**:

```typescript
// Valid: single root
workspaces: [{path: ".", ...}, {path: "packages/api", ...}]

// Invalid: multiple roots
workspaces: [{path: ".", ...}, {path: "tools", ...}]

// Invalid: child changed but root didn't
workspaces: [{path: ".", hasChanges: false}, {path: "pkg/a", hasChanges: true}]
```

---

### Task 26: Version Service

**ID**: TSK-026
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 4 hours
**Dependencies**: TSK-009, TSK-002
**Source**: Section 5.2, FR-002

**Description**:
Implement semantic version calculation based on commit messages.

**Acceptance Criteria**:

- [ ] `src/core/VersionService.ts` created
- [ ] `calculateNewVersion()` using conventional commits
- [ ] `increaseVersion()` with semver logic
- [ ] Handle pre-release identifiers (alpha, beta, rc)
- [ ] Increment pre-release number if same identifier
- [ ] Return `Version` branded type
- [ ] Unit tests in `VersionService.spec.ts`
- [ ] Test all bump types (major, minor, patch, pre-release)
- [ ] Test pre-release scenarios from FR-006

**Test Cases**:

```typescript
"1.0.0" + "feat: feature" → "1.1.0"
"1.0.0" + "fix: bug" → "1.0.1"
"1.0.0" + "feat!: breaking" → "2.0.0"
"1.0.0" + "feat: x pre-release:alpha" → "1.1.0-alpha.0"
"1.2.0-alpha.0" + "feat: y pre-release:alpha" → "1.2.0-alpha.1" (not 1.3.0-alpha.0)
```

---

### Task 27: Changelog Service

**ID**: TSK-027
**Type**: Task
**Priority**: P1 (High)
**Estimate**: 4 hours
**Dependencies**: TSK-002, TSK-003
**Source**: Section 8.4, FR-003

**Description**:
Implement changelog generation using conventional-changelog.

**Acceptance Criteria**:

- [ ] `src/core/ChangelogService.ts` created
- [ ] `generateForWorkspace()` method
- [ ] Use `conventional-changelog-core` library
- [ ] Create `CHANGELOG.md` if missing
- [ ] Prepend new entries to existing changelog
- [ ] Support multiple preset formats (conventionalcommits, angular, etc.)
- [ ] For root workspace, append child workspace summary
- [ ] Unit tests in `ChangelogService.spec.ts`
- [ ] Test with mock git history
- [ ] Test changelog merging

---

### Task 28: Workspace Manager (Orchestration)

**ID**: TSK-028
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 6 hours
**Dependencies**: TSK-020, TSK-022, TSK-023, TSK-025, TSK-026, TSK-027
**Source**: Section 5.2, FR-005

**Description**:
Implement main workspace manager orchestrating the entire workflow.

**Acceptance Criteria**:

- [ ] `src/core/WorkspaceManager.ts` created
- [ ] `enrichWorkspaces()` - detect name/version for each workspace
- [ ] `detectChangedWorkspaces()` - find workspaces with changes since last tag
- [ ] `buildWorkspaceTree()` - create hierarchical structure
- [ ] `calculateVersions()` - determine new versions
- [ ] `updateVersionFiles()` - write new versions
- [ ] `generateChangelogs()` - create/update changelogs
- [ ] `createVersionCommit()` or `createVersionPR()` based on input
- [ ] `createVersionTags()` - create git tags (including short tags)
- [ ] Handle PR auto-merge workflow
- [ ] Unit tests in `WorkspaceManager.spec.ts`
- [ ] Mock all dependencies

**Main Flow**:

```typescript
1. Parse & validate inputs
2. Get last tag
3. Enrich workspaces (detect versions)
4. Detect changed files
5. Build workspace tree
6. Validate tree (single root, change propagation)
7. Calculate new versions
8. Update version files
9. Generate changelogs
10. Create PR or commit
11. Create tags
```

---

### Task 29: Action Entry Point

**ID**: TSK-029
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Dependencies**: TSK-006, TSK-007, TSK-028
**Source**: Section 5.3

**Description**:
Implement main entry point for GitHub Action.

**Acceptance Criteria**:

- [ ] `src/index.ts` created
- [ ] Read inputs from `@actions/core`
- [ ] Parse workspaces input
- [ ] Validate inputs with Zod
- [ ] Initialize services (GitHub, WorkspaceManager)
- [ ] Execute workflow
- [ ] Set outputs (`tag` version)
- [ ] Handle errors with `core.setFailed()`
- [ ] Log all steps with `core.notice()`
- [ ] Unit tests in `index.spec.ts`
- [ ] Test error scenarios

---

### Task 30: Integration & End-to-End Testing

**ID**: TSK-030
**Type**: Task
**Priority**: P0 (Critical)
**Estimate**: 6 hours
**Dependencies**: TSK-029
**Source**: Section 9.4

**Description**:
Comprehensive integration and E2E tests for complete workflows.

**Acceptance Criteria**:

- [ ] `test/workflows/version-bump.test.ts` - full workflow test
- [ ] `test/workflows/pr-creation.test.ts` - PR workflow test
- [ ] `test/workflows/monorepo.test.ts` - monorepo scenarios
- [ ] `test/e2e/single-workspace.test.ts` - single workspace tests
- [ ] `test/e2e/multi-workspace.test.ts` - multi-workspace tests
- [ ] Test with real repository structures (in temp directories)
- [ ] Test workspace tree validation errors
- [ ] Test version propagation (child → root)
- [ ] Test changelog generation
- [ ] Test PR body formatting
- [ ] Test short tag creation
- [ ] Test pre-release workflows
- [ ] All tests pass
- [ ] Overall test coverage ≥ 80% (NFR-003)
- [ ] Performance tests (NFR-002)

**Scenarios to Test**:

1. Single Node.js workspace version bump
2. Monorepo with multiple languages
3. Child workspace changes → root version bumps
4. Pre-release version workflow
5. PR creation with auto-merge
6. Error: multiple root workspaces
7. Error: root unchanged but children changed
8. Changelog generation and merging
9. Short tag creation (v2.1 for v2.1.0)

---

## Release Plan

### Alpha Release (Week 4)

**Items**: TSK-001 through TSK-020
**Features**:

- TypeScript foundation
- All workspace adapters
- File parsing/updating

**Testing**: Unit tests for foundation and adapters

---

### Beta Release (Week 6)

**Items**: TSK-021 through TSK-027
**Features**:

- GitHub API integration
- Version calculation
- Changelog generation

**Testing**: Service integration tests

---

### RC Release (Week 7)

**Items**: TSK-028 through TSK-029
**Features**:

- Complete workflow orchestration
- Entry point implementation

**Testing**: Integration tests

---

### v3.0.0 Release (Week 8)

**Items**: TSK-030 + Polish
**Features**:

- Complete E2E testing
- Documentation updates
- Performance optimization
- Migration guide

**Testing**: Full E2E test suite

---

## Success Metrics

| Metric            | Target                        | Measurement            |
| ----------------- | ----------------------------- | ---------------------- |
| Type Coverage     | 100% (no `any`)               | TypeScript compiler    |
| Test Coverage     | ≥ 80%                         | Vitest coverage report |
| API-based Git Ops | ≥ 90%                         | Code review            |
| Build Size        | ≤ 5MB                         | `@vercel/ncc` output   |
| Performance       | < 30s single, < 2min monorepo | E2E tests              |
| Breaking Changes  | 0                             | Compatibility tests    |

---

## Risk Mitigation

| Risk                    | Mitigation                               |
| ----------------------- | ---------------------------------------- |
| GitHub API limitations  | Implement fallback to git CLI            |
| Test coverage gaps      | Mandatory review of coverage reports     |
| Performance regression  | Benchmark tests in CI                    |
| Breaking changes        | Compatibility test suite with old inputs |
| Migration timeline slip | Weekly progress reviews, MVP approach    |

---

## Dependencies Graph

```
TSK-001 (TS Setup)
  ├─→ TSK-002 (Types)
  │     ├─→ TSK-003 (Errors)
  │     ├─→ TSK-004 (Logger)
  │     ├─→ TSK-006 (Validation)
  │     ├─→ TSK-008 (Fixtures)
  │     ├─→ TSK-009 (Commit Parser)
  │     └─→ TSK-010 (File Parser)
  │           └─→ TSK-011 (File Updater)
  │                 └─→ TSK-012 (Base Adapter)
  │                       ├─→ TSK-013 (Node)
  │                       ├─→ TSK-014 (Python)
  │                       ├─→ TSK-015 (Deno)
  │                       ├─→ TSK-016 (Go)
  │                       ├─→ TSK-017 (Rust)
  │                       ├─→ TSK-018 (Zig)
  │                       └─→ TSK-019 (Text)
  │                             └─→ TSK-020 (Factory)
  ├─→ TSK-005 (Retry)
  └─→ TSK-007 (Input Parser)

TSK-003 + TSK-005 → TSK-021 (GitHub Service)
  ├─→ TSK-022 (Git Operations)
  ├─→ TSK-023 (PR Service)
  └─→ TSK-024 (Repository Service)

TSK-020 + TSK-022 + TSK-023 → TSK-028 (Workspace Manager)
TSK-025 (Tree Builder) → TSK-028
TSK-026 (Version Service) → TSK-028
TSK-027 (Changelog Service) → TSK-028

TSK-028 + TSK-006 + TSK-007 → TSK-029 (Entry Point)
TSK-029 → TSK-030 (E2E Tests)
```

---

## Completion Report

**Total Tasks**: 30
**Critical Path**: TSK-001 → TSK-002 → TSK-012 → TSK-020 → TSK-028 → TSK-029 → TSK-030
**Estimated Duration**: 8 weeks (96 hours of development)
**Parallel Work Opportunities**: Adapters (TSK-013 to TSK-019), Services (TSK-021 to TSK-024)

**Task IDs (Priority Order)**:

1. TSK-001 - TypeScript Project Setup (P0)
2. TSK-002 - Core Type Definitions (P0)
3. TSK-003 - Custom Error Classes (P0)
4. TSK-006 - Input Validation with Zod (P0)
5. TSK-007 - Workspace Input Parser (P0)
6. TSK-009 - Conventional Commit Parser (P0)
7. TSK-012 - Base Workspace Adapter (P0)
8. TSK-013 - Node.js Workspace Adapter (P0)
9. TSK-021 - GitHub API Service (P0)
10. TSK-022 - Git Operations Service (P0)
11. TSK-025 - Workspace Tree Builder (P0)
12. TSK-026 - Version Service (P0)
13. TSK-028 - Workspace Manager (P0)
14. TSK-029 - Action Entry Point (P0)
15. TSK-030 - Integration & E2E Testing (P0)
16. TSK-004 - Logger Utility (P1)
17. TSK-008 - Test Fixtures Setup (P1)
18. TSK-010 - Generic File Parser (P1)
19. TSK-011 - Generic File Updater (P1)
20. TSK-014 - Python Workspace Adapter (P1)
21. TSK-019 - Text Workspace Adapter (P1)
22. TSK-020 - Workspace Adapter Factory (P1)
23. TSK-023 - Pull Request Service (P1)
24. TSK-027 - Changelog Service (P1)
25. TSK-005 - Retry Logic Utility (P2)
26. TSK-015 - Deno Workspace Adapter (P2)
27. TSK-016 - Go Workspace Adapter (P2)
28. TSK-017 - Rust Workspace Adapter (P2)
29. TSK-018 - Zig Workspace Adapter (P2)
30. TSK-024 - Repository Service (P2)

---

**Plan Status**: ✅ Ready for Implementation
**Next Action**: Begin TSK-001 (TypeScript Project Setup)
