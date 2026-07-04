---
changeKind: feature
packages:
  - "@chronus/chronus"
---

Add `{packageCommitCount}` prerelease template variable that counts the commits touching a package's folder. Unlike `{changeCount}`, this value is monotonic (a revert is a new commit), so reverting a change and deleting its change entry no longer collides with an already published prerelease version and blocks new prereleases.

```bash
chronus version --prerelease "{nextVersion}-dev.{packageCommitCount}"
```
