# Bumpalicious

> A type-safe GitHub Action for intelligent version management in multi-language monorepos and single projects.

[![MIT License](https://img.shields.io/github/license/dragoscops/bumpalicious.svg?style=flat-square)](https://github.com/dragoscops/bumpalicious/blob/master/LICENSE)
[![Marketplace](https://img.shields.io/badge/GitHub%20Actions-Marketplace-blue.svg?style=flat-square)](https://github.com/marketplace/actions/bumpalicious)

<!-- [![Downloads](https://img.shields.io/github/downloads/dragoscops/bumpalicious/total.svg?style=flat-square)](https://github.com/dragoscops/bumpalicious/releases) -->
<!-- [![Used by](https://img.shields.io/github/workflow/status/search?query=uses%3Adragoscops%2Fbumpalicious&style=flat-square&label=used%20by)](https://github.com/search?q=uses%3Adragoscops%2Fbumpalicious&type=code) -->

![Jscpd](https://raw.githubusercontent.com/dragoscops/bumpalicious/v3/.jscpd/jscpd-badge.svg?sanitize=true)
[![Test Bumpalicious Action](https://github.com/dragoscops/bumpalicious/actions/workflows/ci.yml/badge.svg)](https://github.com/dragoscops/bumpalicious/actions/workflows/ci.yml)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/dragoscops/version-update?labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit%20Reviews)

<!-- Donation Badges -->

[![Donate to this project using Patreon](https://img.shields.io/badge/patreon-donate-yellow.svg)](https://patreon.com/dragoscirjan)
[![Donate to this project using Paypal](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QBP6DEBJDEMV2&source=url)

## What's New in v3 🎉

**Major improvements:**

- 🔒 **Type-Safe**: Fully rewritten in TypeScript for compile-time safety
- 🔐 **Secure**: GitHub API-based operations eliminate shell injection vulnerabilities
- ✅ **Reliable**: Validates PR status checks before auto-merging
- 🌳 **Smart Monorepo**: Hierarchical workspace tree with intelligent version propagation
- 📦 **Better PRs**: Rich PR descriptions with complete workspace version information
- 🚀 **Performant**: Optimized with parallel processing and caching

## Table of Contents

- [Bumpalicious](#bumpalicious)
  - [What's New in v3 🎉](#whats-new-in-v3-)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
    - [Supported Languages and Project Types](#supported-languages-and-project-types)
    - [Additional Features](#additional-features)
  - [Monorepo Support](#monorepo-support)
    - [How It Works](#how-it-works)
    - [Workspace Hierarchy Rules](#workspace-hierarchy-rules)
    - [Example PR Body](#example-pr-body)
  - [Usage](#usage)
    - [Using with Pull Requests](#using-with-pull-requests)
    - [Manual PR Merge Workflow](#manual-pr-merge-workflow)
  - [Inputs](#inputs)
    - [Workspace Types](#workspace-types)
  - [Outputs](#outputs)
  - [Examples](#examples)
    - [Basic Usage (Single Project)](#basic-usage-single-project)
    - [Language-Specific Examples](#language-specific-examples)
      - [Node.js Project](#nodejs-project)
      - [Python Project](#python-project)
      - [Deno Project](#deno-project)
      - [Go Project](#go-project)
      - [Rust Project](#rust-project)
      - [Zig Project](#zig-project)
      - [Text-based Version Files](#text-based-version-files)
    - [Monorepo Examples](#monorepo-examples)
      - [Multi-language Monorepo](#multi-language-monorepo)
    - [Advanced Examples](#advanced-examples)
      - [With Custom Branch](#with-custom-branch)
      - [With Custom Changelog Preset](#with-custom-changelog-preset)
      - [With Pull Request and Auto-merge](#with-pull-request-and-auto-merge)
      - [With Custom PR Branch Prefix](#with-custom-pr-branch-prefix)
      - [Pre-release Workflow](#pre-release-workflow)
      - [Production Release Workflow](#production-release-workflow)
  - [Version Bump Rules](#version-bump-rules)
    - [Breaking Changes](#breaking-changes)
    - [Pre-release Version Handling](#pre-release-version-handling)
  - [Changelog Generation](#changelog-generation)
    - [Changelog Features](#changelog-features)
    - [Changelog Generation Process](#changelog-generation-process)
    - [Conventional Commits Format](#conventional-commits-format)
    - [Example CHANGELOG.md](#example-changelogmd)
    - [Monorepo Changelogs](#monorepo-changelogs)
  - [Troubleshooting](#troubleshooting)
    - ["No workspaces have changed" Error](#no-workspaces-have-changed-error)
    - [PR Not Auto-Merging](#pr-not-auto-merging)
    - [Double Version Bump After PR Merge](#double-version-bump-after-pr-merge)
    - [Workspace Not Detected](#workspace-not-detected)
    - [Permission Errors](#permission-errors)

## Features

- 🎯 **Intelligent Version Detection**: Automatically identifies and updates version files across multiple project types
- 🔐 **Secure by Design**: GitHub API-based operations prevent shell injection vulnerabilities
- ✅ **PR Status Validation**: Waits for required checks before auto-merging pull requests
- 🌍 **Multi-Language Support**: Native support for 7+ programming languages and ecosystems
- 📦 **Monorepo Ready**: Hierarchical workspace management with smart version propagation
- 📝 **Rich Changelogs**: Automatically generates detailed CHANGELOG.md from conventional commits
- 🚀 **Zero Configuration**: Works out-of-the-box with sensible defaults
- ⚡ **Fast & Efficient**: Parallel processing and intelligent caching

### Supported Languages and Project Types

- **Deno**: `deno.json`, `deno.jsonc`, `jsr.json`, `package.json`
- **Go**: `go.mod` (with version comments), `version.go`, `version.txt`, `VERSION.txt`
- **Node.js**: `package.json`, `jsr.json`
- **Python**: `pyproject.toml`, `poetry.toml`, `setup.py`, `setup.cfg`, `__init__.py`
- **Rust**: `Cargo.toml`
- **Zig**: `build.zig`, `build.zig.zon`
- **Text-based**: `version`, `version.txt`, `VERSION`, `VERSION.txt`

### Additional Features

- Smart pre-release version handling that understands semantic versioning
- Updates version numbers according to conventional commits
- Supports monorepos with multiple project types
- Generates changelogs using conventional commits specification
- Creates well-formatted CHANGELOG.md files for each workspace
- Includes changelog content in pull request descriptions
- Creates Git tags with optional short version tags (e.g., v1.2 for v1.2.3)

## Monorepo Support

Bumpalicious v3 features advanced monorepo support with **hierarchical workspace trees**:

### How It Works

1. **Root Workspace**: The first workspace in your configuration (typically `.`) acts as the root
2. **Child Workspaces**: Any workspace with a path nested under the root
3. **Version Propagation**: Changes in child workspaces automatically propagate to the root
4. **Master Version Tag**: The root workspace version becomes the primary Git tag

### Workspace Hierarchy Rules

```yaml
workspaces: ".:node;packages/api:python;packages/ui:node"
```

- **Root** (`.`): Must be listed first, controls the master version
- **Children** (`packages/*`): Nested paths inherit from root
- **Version Propagation**: If ANY child changes, root MUST change
- **Error Prevention**: Action fails if child changes but root version doesn't

### Example PR Body

When creating a PR in a monorepo, you'll get a rich description:

```markdown
# Version Update: my-monorepo 2.1.0

## 📦 Workspace Versions

### 🏠 Root: my-monorepo

**Version**: `2.1.0` | **Path**: `.` | **Type**: `node`

### 📁 Child Workspaces

- 🔄 **api-service** `1.5.0` (packages/api) - python
- 🔄 **ui-components** `3.2.1` (packages/ui) - node

## 📝 Changelogs

[Detailed changelog for each workspace]
```

## Usage

Add Bumpalicious to your GitHub Actions workflow:

```yaml
name: Version Update

on:
  push:
    branches:
      - main

jobs:
  version-update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for changelog generation

      - name: Update Version
        uses: dragoscops/bumpalicious@v3
        with:
          workspaces: ".:node"
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Using with Pull Requests

For safer version updates with review and CI validation:

```yaml
- name: Update Version with PR
  uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    pr: "true"
    pr_auto_merge: "true"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

> **⚠️ Important Requirements**:
>
> - **Full Git History**: Always use `fetch-depth: 0` in checkout to enable proper changelog generation and change detection
> - **Token Permissions**: For PR creation, use a token with `contents: write` and `pull-requests: write` permissions
> - **Auto-merge**: Requires branch protection rules with required status checks configured
> - **Branch/Tag Names**: GitHub's Compare API requires fully qualified references. The action automatically handles this by prefixing branches with `refs/heads/` and tags with `refs/tags/`

### Manual PR Merge Workflow

If you manually merge a PR created by Bumpalicious, you can re-run the action to create the version tags:

1. **First Run**: Action creates PR with version changes (e.g., `v1.2.3`)
2. **Manual Review**: You review and merge the PR via GitHub UI
3. **Second Run**: Action detects the merged PR commit and creates tags without bumping the version again

**How Detection Works:**

When a PR is merged via squash merge, GitHub uses the PR title as the commit message. The action recognizes merged PRs by detecting commit messages starting with:

- `chore: bump version to X.Y.Z` (internally generated PR title format)
- `chore: version update` (matches the default `pr_message` input)

If you use a custom `pr_message` input, ensure your commit messages match that pattern to enable proper detection.

**Why This Matters:**

Without proper detection, the action would:

- See the merged PR commit as a new change
- Calculate and apply another version bump (e.g., 1.2.3 → 1.2.4)
- Create incorrect version tags

With detection, the action:

- Recognizes the commit as a merged version bump
- Skips version calculation
- Simply creates the appropriate tags for the already-bumped version

## Inputs

| Name                | Description                                                                    | Required | Default                 |
| ------------------- | ------------------------------------------------------------------------------ | -------- | ----------------------- |
| `workspaces`        | Workspace definitions with format `path:type` (comma or semicolon separated)   | Yes      | `.:text`                |
| `github_token`      | GitHub token for API operations (PR creation, tagging)                         | Yes      | `${{ github.token }}`   |
| `pr`                | Create a pull request instead of direct commit                                 | No       | `false`                 |
| `pr_auto_merge`     | Enable auto-merge when all required checks pass                                | No       | `false`                 |
| `pr_message`        | Custom message for PR title and commit message                                 | No       | `chore: version update` |
| `pr_version_prefix` | Branch name prefix for version PRs (e.g., `bump_version_to`)                   | No       | `version_bump`          |
| `branch`            | Target branch for version updates                                              | No       | `main`                  |
| `changelog_preset`  | Conventional-changelog preset (`conventionalcommits`, `angular`, `atom`, etc.) | No       | `conventionalcommits`   |
| `short_tag`         | Create short version tags (e.g., `v1.2` for `v1.2.3`)                          | No       | `false`                 |

### Workspace Types

The following workspace types are supported:

- **`deno`**: Deno projects using `deno.json`, `deno.jsonc`, `jsr.json`, or `package.json`
- **`go`**: Go projects using `go.mod` (with version comments), `version.go`, `version.txt`, or `VERSION.txt`
- **`node`**: Node.js projects using `package.json` or `jsr.json`
- **`python`**: Python projects using `pyproject.toml`, `poetry.toml`, `setup.py`, `setup.cfg`, or `__init__.py`
- **`rust`**: Rust projects using `Cargo.toml`
- **`text`**: Generic text-based version files (`version`, `version.txt`, `VERSION`, `VERSION.txt`)
- **`zig`**: Zig projects using `build.zig` or `build.zig.zon`

## Outputs

| Name                 | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `tag`                | The primary version tag created (e.g., `v1.2.3`)           |
| `version`            | The version number without prefix (e.g., `1.2.3`)          |
| `pr`                 | Pull request number if PR was created                      |
| `all_tags`           | Comma-separated list of all tags created                   |
| `changed_workspaces` | Comma-separated list of workspace paths that were updated  |
| `bump_type`          | Type of version bump performed (`major`, `minor`, `patch`) |

## Examples

### Basic Usage (Single Project)

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Language-Specific Examples

#### Node.js Project

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### Python Project

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:python"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### Deno Project

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:deno"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### Go Project

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:go"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### Rust Project

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:rust"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### Zig Project

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:zig"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### Text-based Version Files

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:text"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Monorepo Examples

#### Multi-language Monorepo

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node;packages/api:python;packages/ui:node;tools/cli:go"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

> **Note**: Use either comma (`,`) or semicolon (`;`) as separators. The root workspace (`.`) should be listed first.

### Advanced Examples

#### With Custom Branch

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    branch: "develop"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### With Custom Changelog Preset

Available presets: `conventionalcommits` (default), `angular`, `atom`, `codemirror`, `ember`, `eslint`, `express`, `jquery`, `jshint`

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    changelog_preset: "angular"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

#### With Pull Request and Auto-merge

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    pr: "true"
    pr_auto_merge: "true"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

**Auto-merge Requirements:**

- Branch protection rules must be enabled
- Required status checks must be configured
- Action waits up to 5 minutes for checks to pass
- If checks fail, PR remains open for manual review

#### With Custom PR Branch Prefix

```yaml
- uses: dragoscops/bumpalicious@v3
  with:
    workspaces: ".:node"
    pr: "true"
    pr_version_prefix: "release"
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

This creates PR branches like `release/1.2.3` instead of the default `version_bump/1.2.3`.

#### Pre-release Workflow

Create alpha/beta releases for your development branch:

```yaml
name: Pre-release Version
on:
  push:
    branches: [develop]

jobs:
  version-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Update Pre-release Version
        uses: dragoscops/bumpalicious@v3
        with:
          workspaces: ".:node"
          pr: "true"
          pr_message: "chore: pre-release version update"
          branch: "develop"
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Use commits like `feat: new feature pre-release:alpha` to trigger pre-release versions.

#### Production Release Workflow

Complete workflow with PR, auto-merge, and multiple workspaces:

```yaml
name: Production Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Update Version and Create Release
        uses: dragoscops/bumpalicious@v3
        with:
          workspaces: ".:node;packages/lib:python;tools:go"
          pr: "true"
          pr_auto_merge: "true"
          short_tag: "true"
          changelog_preset: "conventionalcommits"
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

This workflow:

- Creates version tags for all changed workspaces
- Generates changelogs with conventional commits
- Creates a PR with detailed version information
- Auto-merges after CI checks pass
- Creates both full (`v1.2.3`) and short (`v1.2`) tags

## Version Bump Rules

Bumpalicious follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

| Commit Type              | Version Bump | Example           |
| ------------------------ | ------------ | ----------------- |
| `fix:` or `perf:`        | Patch        | `1.0.0` → `1.0.1` |
| `feat:`                  | Minor        | `1.0.0` → `1.1.0` |
| `BREAKING CHANGE:`, `!:` | Major        | `1.0.0` → `2.0.0` |

### Breaking Changes

Breaking changes can be indicated in two ways:

1. **Exclamation mark**: `feat!: remove deprecated API`
2. **Footer**: Add `BREAKING CHANGE:` in the commit body

```text
feat: add new authentication method

BREAKING CHANGE: Old auth tokens are no longer supported
```

### Pre-release Version Handling

Create pre-release versions by adding `pre-release:identifier` to your commit:

```bash
# Create alpha pre-release
git commit -m "feat: new feature pre-release:alpha"
# Result: 1.0.0 → 1.1.0-alpha.0

# Create beta pre-release
git commit -m "fix: bug fix pre-release:beta"
# Result: 1.0.0 → 1.0.1-beta.0
```

**Smart Pre-release Incrementing:**

When updating an existing pre-release with the same identifier, only the pre-release number increments:

```bash
# Current version: 1.2.0-alpha.0
git commit -m "feat: another feature pre-release:alpha"
# Result: 1.2.0-alpha.1 (not 1.3.0-alpha.0)
```

**Graduating to Stable:**

Omit the `pre-release:` marker to create a stable release:

```bash
# Current version: 1.2.0-alpha.5
git commit -m "feat: finalize features"
# Result: 1.2.0
```

## Changelog Generation

Bumpalicious automatically generates `CHANGELOG.md` files for each workspace based on conventional commits.

### Changelog Features

- **Automatic Generation**: Creates or updates CHANGELOG.md in each changed workspace
- **Rich Formatting**: Includes commit links, issue references, and categorized changes
- **Monorepo Support**: Separate changelogs for each workspace with root workspace summary
- **PR Integration**: Changelog content is included in pull request descriptions
- **Customizable Presets**: Choose from multiple conventional-changelog presets

### Changelog Generation Process

1. **Detects Changes**: Identifies which workspaces have changed since the last tag
2. **Analyzes Commits**: Parses conventional commits to determine version bump type
3. **Generates Changelog**: Creates formatted changelog entries with:
   - Commit type grouping (Features, Bug Fixes, etc.)
   - Commit messages and authors
   - Links to commits and compare views
   - Breaking change callouts
4. **Updates Files**: Prepends new entries to existing CHANGELOG.md files
5. **Creates Tags**: Tags the repository with new version numbers

### Conventional Commits Format

Use this format for all commits to enable automatic changelog generation:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Common Types:**

- `feat:` New features (appears in "Features" section)
- `fix:` Bug fixes (appears in "Bug Fixes" section)
- `docs:` Documentation changes
- `style:` Code style/formatting changes
- `refactor:` Code refactoring without feature changes
- `perf:` Performance improvements (appears in "Performance Improvements")
- `test:` Test additions or corrections
- `build:` Build system or dependency changes
- `ci:` CI configuration changes
- `chore:` Maintenance tasks

**Examples:**

```bash
feat(api): add user authentication endpoint
fix(ui): correct button alignment on mobile devices
perf(database): optimize query performance
docs: update installation instructions
```

### Example CHANGELOG.md

```markdown
# Changelog

## [1.2.0](https://github.com/user/repo/compare/v1.1.0...v1.2.0) (2025-10-22)

### Features

- **api:** add user authentication endpoint ([a1b2c3d](https://github.com/user/repo/commit/a1b2c3d))
- add support for configuration files ([e4f5g6h](https://github.com/user/repo/commit/e4f5g6h))

### Bug Fixes

- **ui:** correct button alignment on mobile ([i7j8k9l](https://github.com/user/repo/commit/i7j8k9l))
- fix validation logic in form handler ([m1n2o3p](https://github.com/user/repo/commit/m1n2o3p))

### Performance Improvements

- **database:** optimize query execution time ([q4r5s6t](https://github.com/user/repo/commit/q4r5s6t))

## [1.1.0](https://github.com/user/repo/compare/v1.0.0...v1.1.0) (2025-10-15)

### Features

- initial release with core functionality
```

### Monorepo Changelogs

In monorepos, the root workspace CHANGELOG.md includes a summary of all child workspace changes:

```markdown
## [2.1.0] - 2025-10-22

### Root Changes

- feat: update shared configuration

### Child Workspace Updates

#### 🔄 Changed Workspaces

- **api-service** `1.5.0` (packages/api) - Added authentication
- **ui-components** `3.2.1` (packages/ui) - Fixed mobile layout

#### ⚪ Unchanged Workspaces

- **utils** `2.0.0` (packages/utils)
```

## Troubleshooting

### "No workspaces have changed" Error

If you see this error despite having commits, check:

1. **Fetch Depth**: Ensure you're using `fetch-depth: 0` in your checkout step
2. **Tag Format**: Tags must start with 'v' (e.g., `v1.0.0`) for proper detection
3. **Branch References**: The action automatically qualifies branch and tag references for GitHub's Compare API

### PR Not Auto-Merging

Auto-merge requires:

1. **Branch Protection**: Enable required status checks in repository settings
2. **Check Status**: All required checks must pass within 5 minutes
3. **Token Permissions**: Use a token with `contents: write` and `pull-requests: write`

### Double Version Bump After PR Merge

If versions are bumped twice (e.g., 1.2.3 in PR, then 1.2.4 after merge):

1. **Check PR Message**: Ensure `pr_message` matches the commit message pattern
2. **Default Pattern**: Use the default `chore: version update` or `chore: bump version to`
3. **Custom Pattern**: If using custom messages, they must start with `chore: bump version to` or match your `pr_message` input

### Workspace Not Detected

If a workspace isn't being updated:

1. **Path Format**: Use `.` for root, relative paths for children (e.g., `packages/api`)
2. **File Existence**: Ensure version files exist (e.g., `package.json` for Node.js)
3. **Type Match**: Verify the workspace type matches the project (e.g., `node` for `package.json`)

### Permission Errors

If you encounter permission errors:

1. **Workflow Permissions**: Add `permissions` block to your workflow:

   ```yaml
   permissions:
     contents: write
     pull-requests: write
   ```

2. **Token Scope**: Ensure your GitHub token has appropriate scopes
3. **Branch Protection**: Check if branch protection rules allow the action to push
