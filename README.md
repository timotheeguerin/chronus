# Chronus

Chronus goal is to provide changelog management in a monorepo environment. It is designed to be able to enforce changelogs for each changed package while providing ergonomic way to add some like a github comment providing a way to add the changlog directly in the browser.

## Documentation

[Docs](./docs/readme.md)

## Develop

### Requirements

- Node LTS
- `pnpm`

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

## Differences with changesets

Chronus was heavily inspired by [changesets (and forked some of the logic originally)](https://github.com/changesets/changesets) which provide a great way to manage changelogs but Chronus does things slightly differently:

- Checking for changes are done by comparing the remote instead of the local base branch. This solve the issue where you might have merged the base branch into your feature branch but not into the local main branch and changesets would report lots of unrelated change.
- Verify checks every packages have changelog not just that we have a single changelog file.
- Different versioning policies than changesets. LockedStep provide a way to say we will only ever bump the version by the single specified step at everyrelease. This is a way to diverge from true semver where you might release major changes in minor version.(Particularly useful in pre-release `0.x` where minor versions can be used to release breaking changes)
- Change can be defined in custom categories that allow more meaningful grouping of changes in the changelog. See [Change kinds doc](./docs/change-kinds.md)
- Simpler prerelease build using number of pending changes to automatically produce some prelease version. (e.g. `0.1.0-alpha.1` if there is 1 pending change)
- Option to separate the packing from the publishing. Allowing to pack the package upload them as artifact and publish them later.
- At the time this project started changesets had a game breaking bug when bumping prerelease versions.
