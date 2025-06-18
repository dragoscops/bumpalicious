# Bumpalicious

> A GitHub Action for automated version management based on conventional commits.

[![MIT License](https://img.shields.io/github/license/dragoscops/bumpalicious.svg?style=flat-square)](https://github.com/dragoscops/bumpalicious/blob/master/LICENSE)
[![Marketplace](https://img.shields.io/badge/GitHub%20Actions-Marketplace-blue.svg?style=flat-square)](https://github.com/marketplace/actions/bumpalicious)

<!-- [![Downloads](https://img.shields.io/github/downloads/dragoscops/bumpalicious/total.svg?style=flat-square)](https://github.com/dragoscops/bumpalicious/releases) -->
<!-- [![Used by](https://img.shields.io/github/workflow/status/search?query=uses%3Adragoscops%2Fbumpalicious&style=flat-square&label=used%20by)](https://github.com/search?q=uses%3Adragoscops%2Fbumpalicious&type=code) -->

![Jscpd](https://raw.githubusercontent.com/dragoscops/bumpalicious/v2/.jscpd/jscpd-badge.svg?sanitize=true)
[![Test Bumpalicious Action](https://github.com/dragoscops/bumpalicious/actions/workflows/ci.yml/badge.svg)](https://github.com/dragoscops/bumpalicious/actions/workflows/ci.yml)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/dragoscops/version-update?labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit%20Reviews)

<!-- Donation Badges -->

[![Donate to this project using Patreon](https://img.shields.io/badge/patreon-donate-yellow.svg)](https://patreon.com/dragoscirjan)
[![Donate to this project using Paypal](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QBP6DEBJDEMV2&source=url)

## Table of Contents

- [Features](#features)
- [Usage](#usage)
- [Inputs](#inputs)
  - [Workspace Types](#workspace-types)
- [Outputs](#outputs)
- [Examples](#examples)
  - [Basic Usage](#basic-usage-single-project)
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
    - [Microservices Architecture](#microservices-architecture)
    - [Full-stack Application](#full-stack-application)
  - [Advanced Examples](#advanced-examples)
    - [With Custom Branch and Auto-merge](#with-custom-branch-and-auto-merge)
    - [With Custom PR Branch Prefix](#with-custom-pr-branch-prefix)
    - [Pre-release Workflow](#pre-release-workflow)
    - [Production Release Workflow](#production-release-workflow)
- [Version Bump Rules](#version-bump-rules)
  - [Pre-release Version Handling](#pre-release-version-handling)
- [Changelog Generation](#changelog-generation)
  - [How it works](#how-it-works)
  - [Conventional Commits](#conventional-commits)
  - [Example CHANGELOG.md](#example-changelogmd)

## Features

- Automatically detects version files in projects
- Supports multiple languages and project types:
  - **Deno**: `deno.json`, `deno.jsonc`, `jsr.json`, `package.json`
  - **Go**: `go.mod` (with version comments), `version.go`, `version.txt`, `VERSION.txt`
  - **Node.js**: `package.json`, `jsr.json`
  - **Python**: `pyproject.toml`, `poetry.toml`, `setup.py`, `setup.cfg`, `__init__.py`
  - **Rust**: `Cargo.toml`
  - **Zig**: `build.zig`, `build.zig.zon`
  - **Text-based**: `version`, `version.txt`, `VERSION`, `VERSION.txt`
- Smart pre-release version handling that understands semantic versioning
- Updates version numbers according to conventional commits
- Supports monorepos with multiple project types
- Generates changelogs using conventional commits specification
- Creates well-formatted CHANGELOG.md files for each workspace
- Includes changelog content in pull request descriptions
- Creates Git tags with optional short version tags (e.g., v1.2 for v1.2.3)

## Usage

Add the following to your GitHub Actions workflow:

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Update Version
        uses: dragoscops/bumpalicious@v2
        with:
          workspaces: ".:node"
          pr: "true"
          create_tags: "true"
          changelog_preset: "conventionalcommits"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Name               | Description                                                   | Required | Default                 |
| ------------------ | ------------------------------------------------------------- | -------- | ----------------------- |
| `workspaces`       | Comma-separated workspace definitions with format "path:type" | No       | `.:text`                |
| `token`            | GitHub token for actions like creating pull requests          | No       | `${{ github.token }}`   |
| `pr`               | Whether to create a pull request with version changes         | No       | `false`                 |
| `pr_auto_merge`    | Whether to automatically merge the PR if all checks pass      | No       | `false`                 |
| `pr_message`       | Message to use for the pull request                           | No       | `chore: version update` |
| `branch`           | Target branch for pull requests                               | No       | `main`                  |
| `changelog_preset` | The conventional-changelog preset to use                      | No       | `conventionalcommits`   |
| `short_tag`        | Create short version tags (e.g., v1.2 for v1.2.3)             | No       | `false`                 |
| `pr_version_prefix` | Prefix for version PR branch names (e.g., "feature/" creates "feature/version-1.2.3") | No       | `""`                    |

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

| Name                      | Description                                                                     |
| ------------------------- | ------------------------------------------------------------------------------- |
| `changed_workspaces_info` | Comma-separated list of changed workspaces with format "path:type:name:version" |
| `updated_workspaces_info` | Comma-separated list of updated workspaces with format "path:type:name:version" |
| `version`                 | The new version after update                                                    |
| `pr_number`               | Pull request number if one was created                                          |
| `pr_url`                  | Pull request URL if one was created                                             |

## Examples

### Basic Usage (Single Project)

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:version"
```

### Language-Specific Examples

#### Node.js Project

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:node"
```

#### Python Project

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:python"
```

#### Deno Project

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:deno"
```

#### Go Project

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:go"
```

#### Rust Project

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:rust"
```

#### Zig Project

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:zig"
```

#### Text-based Version Files

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:text"
```

### Monorepo Examples

#### Multi-language Monorepo

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:node,packages/api:python,packages/ui:node,tools/cli:go,libs/core:rust"
```

### Advanced Examples

#### With Custom Branch

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:node"
  branch: "develop"
```

#### With Custom Changelog Preset

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:node"
  cahangelog_preset: "angular" # or any other conventional-changelog preset
```

#### With Pull Request (with Auto-merge)

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:node"
  pr: "true"
  pr_auto_merge: "true" # only if you want to enable auto-merge
```

#### With Custom PR Branch Prefix

```yaml
uses: dragoscops/bumpalicious@v2
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
with:
  workspaces: ".:node"
  pr: "true"
  pr_version_prefix: "release/" # Creates PR branches like "release/version-1.2.3"
```

#### Pre-release Workflow

```yaml
name: Pre-release Version Update
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
        uses: dragoscops/bumpalicious@v2
        with:
          workspaces: ".:node"
          pr: "true"
          pr_message: "chore: pre-release version update"
          branch: "develop"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Production Release Workflow

```yaml
name: Production Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Update Version and Create Release
        uses: dragoscops/bumpalicious@v2
        with:
          workspaces: ".:node,packages/lib:python,tools:go"
          pr: "true"
          pr_auto_merge: "true"
          short_tag: "true"
          changelog_preset: "conventionalcommits"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Version Bump Rules

This action follows [Conventional Commits](https://www.conventionalcommits.org/) for version bumping:

- `fix:` - Patch version bump (1.0.0 -> 1.0.1)
- `feat:` - Minor version bump (1.0.0 -> 1.1.0)
- `BREAKING CHANGE:` or `feat!:` - Major version bump (1.0.0 -> 2.0.0)

### Pre-release Version Handling

For pre-release versions, include `pre-release:identifier` in your commit message:

- `feat: add new feature pre-release:alpha` - Creates a pre-minor release (1.0.0 -> 1.1.0-alpha.0)
- `fix: bug fix pre-release:beta` - Creates a pre-patch release (1.0.0 -> 1.0.1-beta.0)

When updating an existing pre-release version with the same identifier, the action intelligently increments just the pre-release number:

- If current version is `1.2.0-alpha.0` and commit is `feat: update pre-release:alpha`, the version becomes `1.2.0-alpha.1` (not `1.3.0-alpha.0`)

## Changelog Generation

This action can automatically generate CHANGELOG.md files for each workspace based on conventional commits in your repository. The changelog generation uses the [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) library.

### How it works

1. When a version update is triggered, the action will:
   - Identify workspaces that have changed since the last tag
   - Update the version numbers according to conventional commit messages
   - Intelligently handle pre-release versions (alpha, beta, etc.)
   - Generate or update CHANGELOG.md files in each workspace
   - Create a PR with changelog content (if `pr: true`)
   - Create Git tags for the new version (if `short_tag: true`, will also create shorter tags like v1.2)

### Conventional Commits

For optimal version management and changelog generation, your commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Common types include:

- `feat`: A new feature (triggers minor version bump)
- `fix`: A bug fix (triggers patch version bump)
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `build`: Changes to build system or dependencies
- `ci`: Changes to CI configuration
- `chore`: Other changes that don't modify src or test files

Breaking changes are indicated either by adding `BREAKING CHANGE:` in the commit body or by appending a `!` after the type (e.g., `feat!:`). Breaking changes trigger major version bumps.

### Example CHANGELOG.md

The generated changelog will look similar to:

```markdown
# Changelog

## [1.2.0](https://github.com/user/repo/compare/v1.1.0...v1.2.0) (2025-04-27)

### Features

- **api:** add new endpoint for user preferences ([a1b2c3d](https://github.com/user/repo/commit/a1b2c3d))
- add support for configuration files ([e4f5g6h](https://github.com/user/repo/commit/e4f5g6h))

### Bug Fixes

- correct validation logic in form handler ([i7j8k9l](https://github.com/user/repo/commit/i7j8k9l))
- **ui:** fix button alignment in mobile view ([m1n2o3p](https://github.com/user/repo/commit/m1n2o3p))
```

