---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: internal
packages:
  - "@chronus/chronus"
  - "@chronus/github"
  - "@chronus/github-pr-commenter"
---

Modernize dependencies: remove dead `@types/node-fetch` and replace `source-map-support` with native Node source maps (`process.setSourceMapsEnabled`)
