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

Verify that the packages with changes from the `baseBranch` have all been described.

**Options:**

- `--since` — Only compute changes since the specified branch.

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
