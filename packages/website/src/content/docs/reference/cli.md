---
title: CLI Reference
description: Complete reference for all Chronus CLI commands and options.
---

## Usage

| npm           | pnpm           | yarn           | Global    |
| ------------- | -------------- | -------------- | --------- |
| `npx chronus` | `pnpx chronus` | `yarn chronus` | `chronus` |

## `chronus add [packages...]`

Add a new change description. Optionally specify the packages that the change applies to. By default it will prompt for which package to apply the change to.

**Options:**

- `--since` — Only compute changes since the specified branch.

## `chronus verify`

Validate the Chronus configuration and all pending changesets, including their front matter, change kinds, and package references.

For each existing versioned package whose stable version differs from the Git merge base, all pending changesets referencing that package must have been consumed. Such packages do not need a new changeset describing the release itself. Other changed packages still require an added or modified changeset.

Prerelease versions are exempt from the consumption rule, but their changes still require a changeset. Newly added packages also require a changeset rather than being treated as releases.

Verification includes staged and unstaged changes in the current working tree. It does not inspect generated `CHANGELOG.md` content.

### Changeset requirement exemptions

Configure repository-specific exemptions in `.chronus/config.yaml`:

```yaml
verify:
  changesetRequirement:
    excludeBranches:
      - publish/**
      - dependabot/**
      - backmerge/**
      - revert-*
    excludeTitleContains:
      - "[skip chg]"
```

Branch patterns match the source branch, not the CI merge ref. Outside CI, the current local branch is used. Title fragments are literal, case-insensitive matches; `[skip chg]` has no special meaning unless configured. If no title is available, title exclusions do not match.

An exemption skips only the requirement to add or modify a changeset. Configuration and all existing changesets are still validated. Keep `chronus verify` running on every PR instead of excluding these PRs from the workflow.

Stable-version changeset consumption checks always run, even when a branch or title exemption matches.

Include `edited` in the verification workflow's `pull_request` event types if title edits should re-evaluate exemptions.

GitHub and Azure DevOps PR context is detected automatically where available. Other CI environments can provide `GH_PR_HEAD_REF` and `GH_PR_TITLE` explicitly. Title matching requires title metadata from the CI provider or the explicit environment variables.

**Options:**

- `--since` — Compare against the merge base with the specified ref. Defaults to the configured `baseBranch` and `baseRemote`. The ref and its common history with `HEAD` must be available locally; in CI, use `fetch-depth: 0` when checking out the repository.

```bash
chronus verify --since origin/main
```

## `chronus status`

Show the current status of the changes in the workspace. This is a summary of what `chronus version` will do if run.

This command takes the same options as [`chronus version`](#chronus-version).

## `chronus version`

Apply the change descriptions and bump versions of packages. By default this respects the version policies configured (see [Version Policies](/chronus/guides/version-policies/)).

### Options

#### `--ignore-policies`

Ignore the [version policies](/chronus/guides/version-policies/) and bump packages independently. Useful in `lockStep` policies when doing a hotfix.

#### `--only`

Only bump the specified packages. Change descriptions for unspecified packages are ignored. If a change applies to both specified and unspecified packages, only the specified ones are bumped and the others are removed from the change description file.

```bash
chronus version --only @my-scope/my-package1 --only @my-scope/my-package2
```

#### `--prerelease`

Bump versions in prerelease mode. See [Prereleases](/chronus/guides/prerelease/) for details.

## `chronus changelog`

Generate the changelog to stdout without bumping the version of the packages.

**Options:**

- `--package` — Generate the changelog for a specific package.
- `--policy` — Generate an aggregated changelog for a specific policy.

## `chronus pack`

Pack all the packages configured for the workspace.

By default this has the same effect as `npm pack` run in each package directory.

### Options

#### `--pack-destination`

Directory where the packed packages will be placed. By default each tar file is placed in the package directory.

```bash
chronus pack --pack-destination /temp/artifacts

# Output:
# ✔ @chronus/chronus packed in chronus-chronus-0.7.0.tgz (94.5 kB)
# ✔ @chronus/github-pr-commenter packed in chronus-github-pr-commenter-0.3.0.tgz (5.49 kB)
```
