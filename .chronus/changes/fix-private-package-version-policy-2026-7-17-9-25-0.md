---
changeKind: fix
packages:
  - "@chronus/chronus"
---

Version private packages that are part of a version policy. A `private: true` package listed in a version policy is now bumped through the changeset/hotfix flow (`chronus version --ignore-policies`) and when one of its dependencies changes, while still never being published.
