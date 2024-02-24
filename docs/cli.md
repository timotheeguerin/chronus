# Chronus CLI

## `chronus add`

Add a new change description

## `chronus verify`

Verify that the packages with changes from the `baseBranch` have all been described.

## `chronus status`

This command will show the current status of the changes in the workspace. This is basically a summary of what `chronus version` will do if run.

This command takes the same options as [`chronus version`](#chronus-version).

## `chronus version`

Apply the change description and bump version of packages. By default this will respect the version policies configured(see [version policies](version-policies.md)).

### Options

#### `--ignore-policies`

This allows to ignore the [version policies](version-policies.md) and bump the packages independently. This can be useful in the `lockStep` policies when doing a hotfix.

#### `--only`

Only bumps the packages specified. This can be useful if wanting to only release certain packages. This command will extract the change descriptions for the specified packages and bump the version of those packages. If a change applied to a package is not specified in the `--only` option it will be ignored. If a change is specified in both it will be applied and the packages included in the `only` array will be removed from the change description file.

```bash
chronus version --only @my-scope/my-package1 --only @my-scope/my-package2
```
