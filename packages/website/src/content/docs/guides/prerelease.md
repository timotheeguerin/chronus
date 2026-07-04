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
| `{packageCommitCount}`   | The number of commits reachable from `HEAD` that touched the package folder         |

## Choosing a suffix

`{changeCount}` (and `{changeCountWithPatch}`) count the change entry files currently present for a
package. This value is **not monotonic**: if a pull request reverts a commit and deletes its change
entry, the count decreases and the computed prerelease version can collide with one already
published, which prevents any new prerelease from being published until enough new changes are added
to climb back past the previous number.

Use `{packageCommitCount}` to avoid this. It counts commits that touched the package folder, which
only ever grows (a revert is itself a new commit), so a deleted change entry never lowers it. It
still only changes for packages that were actually modified, so untouched packages keep the same
version and are not republished.

> `{packageCommitCount}` requires the full git history to be available. In CI make sure to do a full
> clone (for example `fetch-depth: 0` with `actions/checkout`); on a shallow clone the count is
> limited to the commits present in the clone.

## Examples

Given package `pkg-a` with independent version policy, currently at version `1.4.2` with 3 changes (2 minor, 1 patch) since the last release:

| Template                                   | Resolved version                     |
| ------------------------------------------ | ------------------------------------ |
| `{nextVersion}-dev.{changeCountWithPatch}` | `1.5.0-dev.5`                        |
| `{nextVersion}-dev.{changeCount}`          | `1.5.0-dev.3`                        |
| `{nextVersion}-dev.{packageCommitCount}`   | `1.5.0-dev.<commits touching pkg-a>` |
