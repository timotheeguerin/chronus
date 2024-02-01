# @chronus/chronus

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

- f08a722: Fix various issues(Missing depedencies on globby), resolving correct upstream branch

## 0.2.0

### Minor Changes

- 4f62a90: Add ability to specify base branch
- 26ba96f: Fix running `verify` in the CI

### Patch Changes

- 9d406a7: Export some functionalities
- 86246ee: Add support for rush.js
