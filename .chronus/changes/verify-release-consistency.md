---
changeKind: feature
packages:
  - "@chronus/chronus"
---

Make `chronus verify` work for both ordinary and release PRs without extra commands or flags. Existing packages whose versions changed do not need a new changeset for the release itself. Stable version changes must consume all pending changesets for that package; prerelease version changes may retain or consume them. New packages and packages whose versions did not change still require changesets for their changes.

Configured branch and PR-title exemptions waive only the new-changeset requirement; stable-version consumption checks always run.
