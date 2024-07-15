---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: feature
packages:
  - "@chronus/chronus"
---

Packages with prerelease version (e.g. `1.0.0-alpha.1`) will only see their prerelease version bumped regardless of the change type.
  
| Old version     | Change type    | Old Logic | New Logic       |
| --------------- | ------- | --------- | --------------- |
| `1.0.0-alpha.1` | `major` | `1.0.0`   | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `minor` | `1.0.0`   | `1.0.0-alpha.2` |
| `1.0.0-alpha.1` | `patch` | `1.0.0`   | `1.0.0-alpha.2` |
