---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: feature
packages:
  - "@chronus/chronus"
---

Addition of `packages` field in the config to provide a more generic way of specifying packages to include. This now allows multiple ecosystem type to live side by side

Example of a repo with a pnpm workspace in `node-pkgs` and a cargo workspace in `rust-pkgs` and some standalone node packages in `others`
```yaml
packages:
  - "node-ws"
  - path: "rust-ws"
    type: cargo
  - path: "others/*"
    type: npm
```
