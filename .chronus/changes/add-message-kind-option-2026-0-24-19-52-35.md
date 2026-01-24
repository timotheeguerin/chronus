---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: feature
packages:
  - "@chronus/chronus"
---

Add `--message`/`-m` and `--kind`/`-k` option to `chronus add` command.

```
chronus add -m "Add rocket booster capabilities" -k minor 
```
