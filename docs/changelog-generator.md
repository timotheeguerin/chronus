# Changelog generator

Chronus provide an extensible changelog generator

## Configure

In `.chronus/config.yaml`

```yaml
changelog: "<name>" # to use without options
changelog: ["<name>", { # to use with options
    opt1: val1
  }
```

## Provided generators

## `basic` **built-in** (default)

Default is the `basic` changelog generator which will include every change in a bullet list grouped by change kinds.

Example:

> ### Features
>
> - Add new feature A
> - Add new feature B
>
> ### Bug fixes
>
> - Fix bug 1
> - Fix bug 3

## `@chronus/github/changelog`

Changelog generator that enhance the entries with github information like the PR number and commit.

Example:

> ### Features
>
> - #236 abcdefg Add new feature A
> - #237 abcdefg Add new feature B
>
> ### Bug fixes
>
> - #286 abcdefg Fix bug 1
> - #216 abcdefg Fix bug 3
