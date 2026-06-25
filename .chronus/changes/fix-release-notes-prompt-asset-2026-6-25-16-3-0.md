---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: internal
packages:
  - "@chronus/chronus"
---

Ship the `release-notes` default prompt template in a `prompts/` directory and resolve it from the package root so `chronus release-notes` works when installed.
