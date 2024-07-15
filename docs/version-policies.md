# Chronus Version Policies

## Independent versioning (Default)

By default each package is versioned independentely. This means if you describe a change for package `a` it will only bump the version of `a` and any package depending on `a` that would need a release to include the new version of `a`.

### Versioning of prerelease packages (e.g. `1.0.0-alpha.1`)

Packages with prerelease version (e.g. `1.0.0-alpha.1`) will only see their prerelease version bumped regardless of the change type.

| Old version     | Change type | New version     |
| --------------- | ----------- | --------------- |
| `1.0.0-alpha.1` | `major`     | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `minor`     | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `patch`     | `1.0.0-alpha.2` |

## Lockstep versioning

This allow to group packages together and only ever bump the version of every package in the group by the same increment regardless of packages that changed and the change type.

For example if you have the following packages

| Package | Version |
| ------- | ------- |
| a       | 1.2.0   |
| a       | 1.2.0   |
| c       | 2.1.0   |

and specified the following policy:

```yaml
versionPolicies:
  - name: test
    type: lockstep
    step: minor
    packages:
      - a
      - b
```

Then next time `chronus version` is run the version of `a` and `b` will be bumped to `1.3.0` (ignoring any change types defined in the changelogs). `c` however will still be versioned independently.
