# Version Update

A GitHub Action for automated version management based on conventional commits.

## Features

- Automatically detects version files in projects
- Supports multiple languages and project types:
  - Node.js (package.json)
  - Deno (deno.json, deno.jsonc)
  - Python (pyproject.toml, setup.py, setup.cfg)
  - Go (version.txt, version.go)
  - Rust (Cargo.toml)
  - Generic text-based versioning (version, VERSION, etc.)
- Updates version numbers according to semantic versioning rules
- Supports monorepos with multiple project types
- Creates changelogs from git history
- Optionally creates version branches, pull requests, and git tags

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
        uses: dragoscops/version-update@v1
        with:
          workspaces: ".:node"
          create-pr: "true"
          create-tags: "true"
          update-changelog: "true"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Name               | Description                                                   | Required | Default               |
| ------------------ | ------------------------------------------------------------- | -------- | --------------------- |
| `workspaces`       | Comma-separated workspace definitions with format "path:type" | No       | `.:text`              |
| `token`            | GitHub token for actions like creating pull requests          | No       | `${{ github.token }}` |
| `create-pr`        | Whether to create a pull request with version changes         | No       | `false`               |
| `create-tags`      | Whether to create tags for version changes                    | No       | `true`                |
| `merge-branch`     | Target branch for pull requests                               | No       | `main`                |
| `update-changelog` | Whether to update the changelog with changes since last tag   | No       | `true`                |
| `automatic-merge`  | Whether to automatically merge the PR if all checks pass      | No       | `false`               |

### Workspace Types

The following workspace types are supported:

- `node`: Node.js projects using package.json or jsr.json
- `deno`: Deno projects using deno.json, deno.jsonc, or jsr.json
- `python`: Python projects using pyproject.toml, setup.py, or setup.cfg
- `go`: Go projects (creates a version.txt or updates version.go)
- `rust`: Rust projects using Cargo.toml
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
uses: dragoscops/version-update@v1
with:
  workspaces: ".:node"
```

### Monorepo with Multiple Project Types

```yaml
uses: dragoscops/version-update@v1
with:
  workspaces: ".:node,packages/api:python,packages/ui:node"
  create-pr: "true"
```

### Create both PR and Tags

```yaml
uses: dragoscops/version-update@v1
with:
  create-pr: "true"
  create-tags: "true"
```

## Version Bump Rules

This action follows [Conventional Commits](https://www.conventionalcommits.org/) for version bumping:

- `fix:` - Patch version bump (1.0.0 -> 1.0.1)
- `feat:` - Minor version bump (1.0.0 -> 1.1.0)
- `BREAKING CHANGE:` or `feat!:` - Major version bump (1.0.0 -> 2.0.0)

## License

MIT
