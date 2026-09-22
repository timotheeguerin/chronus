# @chronus/action

Official GitHub Action to automate [chronus](https://github.com/timotheeguerin/chronus) releases.

It maintains a **Version Packages** pull request: when changes land on your default branch it runs
`chronus version`, bumps versions, updates changelogs, and opens (or updates) a draft pull request
with the result. Merging that pull request releases the new versions.

> This iteration covers the **version pull request** flow only. Publishing is still done with the
> CLI. See the [GitHub Action guide](https://timotheeguerin.github.io/chronus/guides/github-action/)
> for full documentation.

## Usage

```yaml
name: Release

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
      - run: npm ci
      - uses: timotheeguerin/chronus/packages/action@action-v1
```

## Inputs

| Input            | Default                    | Description                                          |
| ---------------- | -------------------------- | ---------------------------------------------------- |
| `version`        | `npx chronus version`      | Command used to bump versions and update changelogs. |
| `cwd`            | workspace root             | Working directory the action runs in.                |
| `commit-message` | `Bump versions`            | Message used for the version bump commit.            |
| `pr-title`       | `Release changes`          | Title of the version pull request.                   |
| `pr-body`        | rendered release plan      | Body of the version pull request.                    |
| `branch`         | `chronus/version-packages` | Branch the version changes are pushed to.            |
| `base`           | repository default branch  | Base branch the pull request targets.                |
| `token`          | `${{ github.token }}`      | GitHub token used to create/update the pull request. |

## Outputs

| Output          | Description                                         |
| --------------- | --------------------------------------------------- |
| `hasChangesets` | Whether there were pending changes to release.      |
| `prNumber`      | Number of the created/updated version pull request. |
| `prBranch`      | Branch the version changes were pushed to.          |

## Development

The action is bundled into a single standalone `dist/index.js` that is committed to the repository
so it can run directly from a git ref. Rebuild it with:

```bash
pnpm --filter @chronus/action build
```

CI verifies the committed `dist/` is up to date.
