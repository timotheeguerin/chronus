# chronus

** IN DEVELOPMENT **

chronus goal is to provide changelog management. It is currently built depending on [changesets(and forked many of logic)](https://github.com/changesets/changesets) which provide a great way to manage changelogs but chronus does things slightly differently:

- Checking for changes are done by comparing the remote instead of the local base branch. This solve the issue where you might have merged the base branch into your feature branch but not into the local main branch and changesets would report lots of unrelated change.
- Design to be able to plug in different monorepo, source control system as a plugin system.

## Requirements

- Node 16+
- pnpm 7.5.2+

## Develop

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
