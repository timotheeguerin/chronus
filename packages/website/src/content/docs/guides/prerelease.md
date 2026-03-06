---
title: Prereleases
description: Automatically produce unique prerelease versions for nightly and PR builds.
---

Chronus prerelease functionality allows you to automatically bump versions in a nightly or pull request build to produce unique version numbers.

## Basic usage

Use the `--prerelease` flag with the `version` command. This uses the default template to bump every package to a new version in the format `{nextVersion}-dev.{changeCountWithPatch}`:

```bash
chronus version --prerelease
```

## Custom template

The `--prerelease` flag also accepts a template string to customize the version number:

```bash
chronus version --prerelease "{nextVersion}-next.{changeCountWithPatch}"
```

### Available variables

| Variable                 | Description                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `{nextVersion}`          | The next version number for that package if you were to run `chronus version` today |
| `{changeCount}`          | The number of changes since the last release for that package                       |
| `{changeCountWithPatch}` | The number of changes plus the current patch count of the package                   |

## Examples

Given package `pkg-a` with independent version policy, currently at version `1.4.2` with 3 changes (2 minor, 1 patch) since the last release:

| Template                                   | Resolved version |
| ------------------------------------------ | ---------------- |
| `{nextVersion}-dev.{changeCountWithPatch}` | `1.5.0-dev.5`    |
| `{nextVersion}-dev.{changeCount}`          | `1.5.0-dev.3`    |
