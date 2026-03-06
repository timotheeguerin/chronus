---
title: Changelog Generator
description: Configure and extend how Chronus generates changelogs.
---

Chronus provides an extensible changelog generator system.

## Configuration

In `.chronus/config.yaml`:

```yaml
changelog: "<name>" # without options
changelog: # with options
  - "<name>"
  - opt1: val1
```

## Built-in generators

### `basic` (default)

The default `basic` generator includes every change in a bullet list grouped by change kind.

**Example output:**

> ### Features
>
> - Add new feature A
> - Add new feature B
>
> ### Bug fixes
>
> - Fix bug 1
> - Fix bug 3

### `@chronus/github/changelog`

Enhances changelog entries with GitHub information like the PR number and commit SHA.

**Example output:**

> ### Features
>
> - #236 abcdefg Add new feature A
> - #237 abcdefg Add new feature B
>
> ### Bug fixes
>
> - #286 abcdefg Fix bug 1
> - #216 abcdefg Fix bug 3

To use this generator, install the `@chronus/github` package:

```bash
npm install -D @chronus/github
```

Then update your config:

```yaml
changelog: "@chronus/github/changelog"
```
