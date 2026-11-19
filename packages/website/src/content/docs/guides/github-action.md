---
title: GitHub Action
description: Automate chronus releases with a maintained "Version Packages" pull request.
---

Chronus ships a first-party GitHub Action that keeps a **Version Packages** pull request up to
date for you. Whenever changes land on your default branch, the action runs `chronus version`,
applies the pending change descriptions, bumps versions, updates changelogs, and opens (or
updates) a pull request with the result. Merging that pull request is what actually releases the
new versions.

:::note
This iteration of the action covers the **version pull request** flow only. Publishing
(`chronus pack` / `chronus publish` and GitHub releases) is still done with the CLI — see the
[CLI reference](/reference/cli). Automated publishing from the action is planned.
:::

## Usage

Add a workflow that runs on pushes to your default branch:

```yaml
# .github/workflows/release.yml
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
          fetch-depth: 0 # Needed so chronus can compare against the base branch

      # Install your dependencies and make the `chronus` CLI available, e.g. pnpm/npm install.
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
      - run: npm ci

      - uses: timotheeguerin/chronus/packages/action@action-v1
```

The action pushes the version changes to a branch (default `chronus/version-packages`) and opens a
**draft** pull request. The pull request is opened as a draft on purpose: some organizations block
Actions from triggering other workflows on regular pull requests, and using a draft works around
that restriction. Mark it "Ready for review" (or merge it) when you want to release.

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

## How it works

1. The action resolves the current release plan from your pending change descriptions.
2. If there are no pending changes, it does nothing and sets `hasChangesets` to `false`.
3. Otherwise it runs the `version` command, commits the result, force-pushes it to `branch`, and
   opens or updates a draft pull request targeting `base`.

## Versioning

Pin the action to a release ref such as `@action-v1` (a moving major-line branch) or an exact
`@action-v1.0.0` tag. The action is bundled into a single `dist/index.js` that is **not** committed
to `main`; it is built and force-committed onto the release refs by the `Release Action` workflow.
This keeps the source tree clean while still letting the action run directly from a git ref.
