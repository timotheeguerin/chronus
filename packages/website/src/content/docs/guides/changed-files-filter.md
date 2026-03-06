---
title: Changed Files Filter
description: Control which file changes require a changelog entry.
---

The goal of tracking changes is to provide a meaningful changelog for users of your library, tool, or application. However, some pull requests don't affect the output of your application and shouldn't need to be tracked in the changelog. You can always include a changelog with `none` as the change kind, but this feels unnecessary when certain file changes shouldn't matter.

The `changedFiles` configuration lets you define file patterns to control which changes actually require a changelog entry.

## Examples

### Only require a changelog if a TypeScript file is changed

```yaml
changedFiles:
  - "**/*.ts"
```

### Ignore markdown files

If only markdown files are modified in a package, it won't request a changelog:

```yaml
changedFiles:
  - "!**/*.md"
```

### Ignore markdown files and test files

If only markdown or test files are modified in a package, it won't request a changelog:

```yaml
changedFiles:
  - "!**/*.md"
  - "!**/*.test.ts"
```
