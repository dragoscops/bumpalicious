# Version Update

A GitHub Action for automated version management based on conventional commits.

## Features

- Automatically detects version files in projects
- Supports multiple languages and project types:
  - Node.js (package.json, jsr.json)
  - Deno (deno.json, deno.jsonc, jsr.json)
  - Python (pyproject.toml, setup.py, setup.cfg)
  - Go (version.txt, version.go)
  - Rust (Cargo.toml)
  - Zig (build.zig)
  - Generic text-based versioning (version, VERSION, etc.)
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
        uses: dragoscops/version-update@v2.0
        with:
          workspaces: ".:node"
          pr: "true"
          create_tags: "true"
          changelog_preset: "conventionalcommits"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Name                | Description                                                    | Required | Default               |
| ------------------- | -------------------------------------------------------------- | -------- | --------------------- |
| `workspaces`        | Comma-separated workspace definitions with format "path:type"  | No       | `.:text`              |
| `token`             | GitHub token for actions like creating pull requests           | No       | `${{ github.token }}` |
| `github_token`      | Alternative to token (for backward compatibility)              | No       | -                     |
| `pr`                | Whether to create a pull request with version changes          | No       | `false`               |
| `pr_auto_merge`     | Whether to automatically merge the PR if all checks pass       | No       | `false`               |
| `pr_message`        | Message to use for the pull request                            | No       | `chore: version update` |
| `branch`            | Target branch for pull requests                                | No       | `main`                |
| `changelog_preset`  | The conventional-changelog preset to use                       | No       | `conventionalcommits` |
| `short_tag`         | Create short version tags (e.g., v1.2 for v1.2.3)              | No       | `false`               |

### Workspace Types

The following workspace types are supported:

- `node`: Node.js projects using package.json or jsr.json
- `deno`: Deno projects using deno.json, deno.jsonc, or jsr.json
- `python`: Python projects using pyproject.toml, setup.py, or setup.cfg
- `go`: Go projects (creates a version.txt or updates version.go)
- `rust`: Rust projects using Cargo.toml
- `zig`: Zig projects using build.zig
- `text`: Generic text-based version files

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
uses: dragoscops/version-update@v2.0
with:
  workspaces: ".:node"
```

### Monorepo with Multiple Project Types

```yaml
uses: dragoscops/version-update@v2.0
with:
  workspaces: ".:node,packages/api:python,packages/ui:node"
  pr: "true"
```

### Create both PR and Tags

```yaml
uses: dragoscops/version-update@v2.0
with:
  pr: "true"
  short_tag: "true"
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

* **api:** add new endpoint for user preferences ([a1b2c3d](https://github.com/user/repo/commit/a1b2c3d))
* add support for configuration files ([e4f5g6h](https://github.com/user/repo/commit/e4f5g6h))

### Bug Fixes

* correct validation logic in form handler ([i7j8k9l](https://github.com/user/repo/commit/i7j8k9l))
* **ui:** fix button alignment in mobile view ([m1n2o3p](https://github.com/user/repo/commit/m1n2o3p))
```
