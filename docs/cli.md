# Chronus CLI

## `chronus add`

Add a new change description

Options:

- `--since` Only compute changes since the specified branch.

## `chronus verify`

Verify that the packages with changes from the `baseBranch` have all been described.

Options:

- `--since` Only compute changes since the specified branch.

## `chronus status`

This command will show the current status of the changes in the workspace. This is basically a summary of what `chronus version` will do if run.

This command takes the same options as [`chronus version`](#chronus-version).

## `chronus version`

Apply the change description and bump version of packages. By default this will respect the version policies configured(see [version policies](version-policies.md)).

## `chronus changelog`

Generate the changelog to stdout without bumping the version of the packages.

Options:

- `--package` to generate the changelog for a specific package.
- `--policy` to generate an aggregated changelog for a specific policy.

### Options

#### `--ignore-policies`

This allows to ignore the [version policies](version-policies.md) and bump the packages independently. This can be useful in the `lockStep` policies when doing a hotfix.

#### `--only`

Only bumps the packages specified. This can be useful if wanting to only release certain packages. This command will extract the change descriptions for the specified packages and bump the version of those packages. If a change applied to a package is not specified in the `--only` option it will be ignored. If a change is specified in both it will be applied and the packages included in the `only` array will be removed from the change description file.

```bash
$ chronus version --only @my-scope/my-package1 --only @my-scope/my-package2
```

## `chronus pack`

Pack all the packages configured for the workspace.

By default it will have the same effect as `npm pack` run in each package directory.

### Options

#### `--pack-destination`

Directory where the packed packages will be placed. By default each tar file will be placed in the package directory.

```bash
$ chronus pack --pack-destination /temp/artifacts

✔ @chronus/chronus packed in chronus-chronus-0.7.0.tgz (94.5 kB)
✔ @chronus/github-pr-commenter packed in chronus-github-pr-commenter-0.3.0.tgz (5.49 kB)
```
