# Changed files filters

The goal of tracking a changes is to be able to provide a meaningful changelog for user or your library/tool/application. However you can often have pull request that are not affecting in anyway the result of your application and shouldn't meed to be tracked in the changelog. You of course are always able to include the changelog with `none` as the change kind but this feels unnecessary when you know for sure that change to certain files are shouldn't matter.

This is where the `changedFiles` configuration can be helpful. It allows you to define a list of files pattern or exclude pattern to tweak which files change should really be adding a changelog.

## Examples

### Only require a changelog if a typescript file is changed

```yaml
changedFiles:
  - "**/*.ts"
```

### Ignore markdown files

_If only markdown files are modified in a package it won't request a changelog_

```yaml
changedFiles:
  - "!**/*.md"
```

### Ignore markdown files and test files

_If only markdown or test files are modified in a package it won't request a changelog_

```yaml
changedFiles:
  - "!**/*.md"
  - "!**/*.test.ts"
```
