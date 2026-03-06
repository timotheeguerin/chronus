---
title: Change Kinds
description: Customize changelog categories beyond the standard major, minor, and patch.
---

Semver defines major for breaking changes, minor for new features, and patch for bug fixes. But sometimes you want more descriptive or additional change types to categorize entries in the changelog.

Configure custom change kinds in `.chronus/config.yaml` by setting `changeKinds`.

## Example 1: Alternate names for existing types

```yaml
changeKinds:
  breaking:
    versionType: major
  feature:
    versionType: minor
  fix:
    versionType: patch
  internal:
    versionType: none
```

## Example 2: Custom titles and descriptions

```yaml
changeKinds:
  breaking:
    versionType: major
    title: Breaking Change
    description: Changes that break existing features

  feature:
    versionType: minor
    title: Feature
    description: Adds new features

  fix:
    versionType: patch
    title: Bug Fix
    description: Fixes to existing features

  internal:
    versionType: none
    title: Internal
    description: Internal changes that are not user facing
```

## Example 3: Extended change types

```yaml
changeKinds:
  breaking:
    versionType: major
    title: Breaking Change
    description: Changes that break existing features

  deprecation:
    versionType: minor
    title: Deprecation
    description: Deprecates existing features

  feature:
    versionType: minor
    title: Feature
    description: Adds new features

  fix:
    versionType: patch
    title: Bug Fix
    description: Fixes to existing features

  test:
    versionType: none
    title: Test
    description: Changes to tests

  chore:
    versionType: none
    title: Chore
    description: Changes to the build process or auxiliary tools

  internal:
    versionType: none
    title: Internal
    description: Internal changes that are not user facing
```
