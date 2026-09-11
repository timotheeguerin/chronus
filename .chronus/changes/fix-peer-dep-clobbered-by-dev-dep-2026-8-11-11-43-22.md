---
changeKind: fix
packages:
  - "@chronus/chronus"
---

Fix a dependency declared as both a `peerDependency` and a `devDependency` being treated as dev-only, which prevented the dependent package from being bumped when the dependency had a breaking change.