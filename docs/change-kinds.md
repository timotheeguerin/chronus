# Change kinds

Semver is great and understood a major for breaking changes, minor for new features and patch for bug fixes. However sometimes you might just want to be a little more descriptive or add extra chnage types to categorize in the changelog.

This can be done in the config by setting `versionKinds`.s

## Example 1: Provide alternate names to the existing types

```yaml
versionKinds:
  breaking:
    versionType: major
  feature:
    versionType: minor
  fix:
    versionType: patch
  internal:
    versionType: none
```

## Example 2: Provide alternate names, title and descriptions to the existing types

```yaml
versionKinds:
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

## Example 3: Provide a different set of versioning

```yaml
versionKinds:
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
    description: Changes to the build process or auxiliary tools and libraries such as documentation generation

  internal:
    versionType: none
    title: Internal
    description: Internal changes that are not user facing
```
