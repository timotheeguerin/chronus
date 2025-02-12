# @chronus/chronus

## 0.15.0

### Features

- [#352](https://github.com/timotheeguerin/chronus/pull/352) Add new `additionalPackages` entry which can be used to give path to some additional packages that are not part of the main workspace and should still be versioned.

### Bug Fixes

- [#352](https://github.com/timotheeguerin/chronus/pull/352) Correctly respect negate patterns in pnpm workspace packages list


## 0.14.1

### Bug Fixes

- [#340](https://github.com/timotheeguerin/chronus/pull/340) Add support for pnpm 9.14.0


## 0.14.0

### Features

- [#333](https://github.com/timotheeguerin/chronus/pull/333) Add `--exclude` and `--only` to `pack`


## 0.13.0

### Features

- [#287](https://github.com/timotheeguerin/chronus/pull/287) [API] Expose function to get markdown summary of release plan


## 0.12.1

### Bug Fixes

- [#260](https://github.com/timotheeguerin/chronus/pull/260) Fix regex performance issues
- [#282](https://github.com/timotheeguerin/chronus/pull/282) Fix incorrectly detecting packages as needing new version when using `workspace:` range


## 0.12.0

### Features

- [#255](https://github.com/timotheeguerin/chronus/pull/255) Add new `--prerelease` flag to `chronus version` command allowing bumping of versions for a reprelease build


## 0.11.0

### Features

- [#244](https://github.com/timotheeguerin/chronus/pull/244) Packages with prerelease version (e.g. `1.0.0-alpha.1`) will only see their prerelease version bumped regardless of the change type.
  
| Old version     | Change type    | Old Logic | New Logic       |
| --------------- | ------- | --------- | --------------- |
| `1.0.0-alpha.1` | `major` | `1.0.0`   | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `minor` | `1.0.0`   | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `patch` | `1.0.0`   | `1.0.0-alpha.2` |


## 0.10.2

### Bug Fixes

- [#195](https://github.com/timotheeguerin/chronus/pull/195) Packages in the `ignored` config should be completely ignored.


## 0.10.1

### Bug Fixes

- [#165](https://github.com/timotheeguerin/chronus/pull/165) Fix `--tag` not respected


## 0.10.0

### Features

- [#161](https://github.com/timotheeguerin/chronus/pull/161) Add validation for version policies referencing packages not found in workspace

### Bug Fixes

- [#159](https://github.com/timotheeguerin/chronus/pull/159) Improve error display in the CLI
- [#162](https://github.com/timotheeguerin/chronus/pull/162) Remove prettier and vitest from dependencies
- [#155](https://github.com/timotheeguerin/chronus/pull/155) Fix Shouldn't try to build dependent graph with ignored packages
- [#163](https://github.com/timotheeguerin/chronus/pull/163) Resolve chronus config in parent directory


## 0.9.0

### Features

- [#150](https://github.com/timotheeguerin/chronus/pull/150) Add `--since` option to add and verify command to be able to use against a different branch
- [#144](https://github.com/timotheeguerin/chronus/pull/144) Add new `changelog` command to generate the changelog entry for a package or policy without bumping versions
- [#147](https://github.com/timotheeguerin/chronus/pull/147) Feature: Add new configuration `changedFiles` to filter which files can trigger change


## 0.8.3

### Bug Fixes

- [#119](https://github.com/timotheeguerin/chronus/pull/119) Add support for `--tag` when publishing


## 0.8.2

### Bug Fixes

- [#115](https://github.com/timotheeguerin/chronus/pull/115) [API] More accurate type for lockstep version policy step


## 0.8.1

### Bug Fixes

- [#106](https://github.com/timotheeguerin/chronus/pull/106) Export `readPublishSummary` function from `@chronus/chronus/publish`
- [#104](https://github.com/timotheeguerin/chronus/pull/104) Add `--report-summary` to `publish` command to save a report summary


## 0.8.0

### Features

- [#78](https://github.com/timotheeguerin/chronus/pull/78) Auto-Select the undocumented packages when using `chronus add`
- [#96](https://github.com/timotheeguerin/chronus/pull/96) `chronus publish` can take a wild card of tgz to publish instead of publishing the workspace
- [#92](https://github.com/timotheeguerin/chronus/pull/92) Add `chronus pack` command that will pack all packages that need publishing
- [#94](https://github.com/timotheeguerin/chronus/pull/94) Add new `chronus publish` command to publish all packages in the workspace
- [#97](https://github.com/timotheeguerin/chronus/pull/97) Add ability to configure the changelog generator with a `changelog` entry

### Bug Fixes

- [#96](https://github.com/timotheeguerin/chronus/pull/96) Only include necessary files in artifact
- [#80](https://github.com/timotheeguerin/chronus/pull/80) Partial Release using `--only` to bump version of select packages
- [#99](https://github.com/timotheeguerin/chronus/pull/99) Allow to choose publish engine
- [#97](https://github.com/timotheeguerin/chronus/pull/97) Fix issue where a change kind with version kind of `none` would still be included in the changelog
- [#84](https://github.com/timotheeguerin/chronus/pull/84) Add new `list-pending-publish` command to list unpublished packages


## 0.7.0

### Features
 
- Feature: New apply changes system that respect the change kinds names
- Add new function to `@chronus/chronus/change` `readChangeDescriptions` that list all change descriptions in the workspace currently.

## 0.6.1

### Patch Changes

- Delete change files after bumping versions

## 0.6.0

### Minor Changes

- Add ability to define a different set of change kinds. For example: Feature, Breaking, Deprecation, Fix, Internal, etc.

## 0.5.1

### Patch Changes

- e32943e: Fix: ignoring packages having dependencies on package being bumped

## 0.5.0

### Minor Changes

- b140705: Add ability to ignore packages

### Patch Changes

- 0a8ebe6: Fix issue with globbing pointing to a dir causing into a globbing of everything underneath

## 0.4.0

### Minor Changes

- 7d0680d: Add support for npm workspaces
- cccd505: Resolve workspace automatically and option to configure which workspace manager to use in the config file.

## 0.3.0

### Minor Changes

- 15e509e: Add support for `none` as changelog type

### Patch Changes

- bc1ebcf: Add `--ignore-policies` flag to `chronus version` command that allows ignoring the versioning policies.

## 0.2.1

### Patch Changes

- f08a722: Fix various issues(Missing dependencies on globby), resolving correct upstream branch

## 0.2.0

### Minor Changes

- 4f62a90: Add ability to specify base branch
- 26ba96f: Fix running `verify` in the CI

### Patch Changes

- 9d406a7: Export some functionalities
- 86246ee: Add support for rush.js
