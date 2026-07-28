---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: feature
packages:
  - "@chronus/github"
---

Enrich `chronus ai-release-notes` with GitHub pull request and author information.

When generating release notes, each change is now linked to the pull request that introduced it and credited to its author, so the resulting notes can reference PRs and contributors. If no GitHub token is available the changes are left unchanged.
