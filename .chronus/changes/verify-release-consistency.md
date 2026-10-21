---
changeKind: feature
packages:
  - "@chronus/chronus"
---

Make `chronus verify` work for both ordinary and release PRs without extra commands or flags. Stable version changes must consume all pending changesets for that package, while other package changes still require a changeset.

Configured branch and PR-title exemptions waive only the new-changeset requirement; stable-version consumption checks always run.
