# chronus

** IN DEVELOPMENT **

chronus goal is to provide changelog management. It was heavily inspired by [changesets (and forked some of the logic)](https://github.com/changesets/changesets) which provide a great way to manage changelogs but chronus does things slightly differently:

- Checking for changes are done by comparing the remote instead of the local base branch. This solve the issue where you might have merged the base branch into your feature branch but not into the local main branch and changesets would report lots of unrelated change.
- Verify checks every packages have changelog not just that we have a single changelog file.
- Different versioning policies than changesets. LockedStep provide a way to say we will only ever bump the version by the single specified step at everyrelease. This is a way to diverge from true semver where you might release major changes in minor version.(Particularly useful in pre-release `0.x` where minor versions can be used to release breaking changes)
- Design to be able to plug in different monorepo(changesets also does that), source control system as a plugin system(only git added but left room for more).
- Change can be defined in custom categories that allow more meaningful grouping of changes in the changelog. See [Change kinds doc](./docs/change-kinds.md)

## Requirements

- Node 16+
- pnpm 7.5.2+

## Develop

[Click here to release current changes](https://github.com/timotheeguerin/chronus/pull/new/publish/auto-release)

This project uses [pnpm workspaces](https://pnpm.io/workspaces) to manage multiple packages.

1. Install dependencies

```bash
pnpm install
```

2. Build

```bash
pnpm build
```

3. Build in watch mode(rebuild automatically on save)

```bash
pnpm watch
```
