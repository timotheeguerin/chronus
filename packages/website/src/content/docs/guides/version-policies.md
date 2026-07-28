---
title: Version Policies
description: Configure independent or lockstep versioning for your packages.
---

## Independent versioning (default)

By default each package is versioned independently. If you describe a change for package `a`, it will only bump the version of `a` and any package depending on `a` that would need a release to include the new version.

### Prerelease packages

Packages with a prerelease version (e.g. `1.0.0-alpha.1`) will only see their prerelease version bumped regardless of the change type:

| Old version     | Change type | New version     |
| --------------- | ----------- | --------------- |
| `1.0.0-alpha.1` | `major`     | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `minor`     | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `patch`     | `1.0.0-alpha.2` |

## Lockstep versioning

Lockstep groups packages together and bumps every package in the group by the same increment, regardless of which packages changed or the change type.

### Example

Given the following packages:

| Package | Version |
| ------- | ------- |
| a       | 1.2.0   |
| b       | 1.2.0   |
| c       | 2.1.0   |

And this policy configuration:

```yaml
versionPolicies:
  - name: test
    type: lockstep
    step: minor
    packages:
      - a
      - b
```

Next time `chronus version` runs, packages `a` and `b` will both be bumped to `1.3.0` (ignoring any change types defined in the changelogs). Package `c` is still versioned independently.

### Private packages in a policy

A package marked `private: true` is normally never versioned. However, if you add it to a
version policy (lockstep or independent), Chronus will version it as part of that group —
including through the changeset/hotfix flow (`chronus version --ignore-policies`) and when a
dependency it relies on is bumped. Such a package still gets its version bumped in
`package.json` but is never published.
