# @chronus/chronus

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
