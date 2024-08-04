# Prerelease bumping

Chronus prerelease functionality allows you to automatically bump version in a nightly build or pull request build to get a unique version number.

## Basic usage

Simple usage is to just use the `--prerelease` flag when running `version` command. This will use the default version policy which is to bump every package to a new version in this format `{nextVersion}-dev.{changeCountWithPatch}`

```bash
chronus version --prerelease
```

## Custom template

The `--prerelease` flag also accepts a template string to customize the version number.

```bash
chronus version --prerelease "{nextVersion}-next.{changeCountWithPatch}"
```

The following variable are available in the template:

| Variable                 | Description                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `{nextVersion}`          | The next version number for that package if you were to run `chronus version` today |
| `{changeCount}`          | The number of changes since the last release for that package                       |
| `{changeCountWithPatch}` | The number of changes with the current patch count of the package                   |

## Examples

Given package `pkg-a` with independent version policy currently at version `1.4.2` with 3 changes(2 minor, 1 patch) since the last release:

| Template                                   | Resolved version |
| ------------------------------------------ | ---------------- |
| `{nextVersion}-dev.{changeCountWithPatch}` | `1.5.0-dev.5`    |
| `{nextVersion}-dev.{changeCount}`          | `1.5.0-dev.3`    |
