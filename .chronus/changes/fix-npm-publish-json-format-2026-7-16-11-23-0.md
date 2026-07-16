---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: fix
packages:
  - "@chronus/chronus"
---

Fix `chronus publish` reporting `undefined` name/version and size with npm 12+

npm 12 changed the `npm publish --json` output to be keyed by package name instead of a flat object. The publish result parsing now handles both the new keyed format and the legacy flat format.
