---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: fix
packages:
  - "@chronus/chronus"
---

Fix dependents not being bumped when a `^`/`workspace:^` dependency on a `0.x` package receives a minor bump. Since `^0.n.x` is locked to the minor (`>=0.n.0 <0.(n+1).0`), a minor bump is breaking and now correctly forces dependents to be released.
