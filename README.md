# Chronus

Changelog management for monorepos.

[![npm version](https://img.shields.io/npm/v/@chronus/chronus)](https://www.npmjs.com/package/@chronus/chronus)
[![CI](https://github.com/timotheeguerin/chronus/actions/workflows/ci.yml/badge.svg)](https://github.com/timotheeguerin/chronus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Chronus makes sure every changed package in your monorepo has a changelog entry. Entries can be added from the CLI or directly from a GitHub PR comment.

[Documentation](https://timotheeguerin.github.io/chronus/)

## Quick start

```bash
npm install -D chronus

# Add a changelog entry
npx chronus add

# Check all changed packages have entries
npx chronus verify

# Bump versions and generate changelogs
npx chronus version
```

## What it does

- **Per-package verification** — checks every changed package has a changelog, not just that a file exists somewhere
- **Multi-ecosystem** — npm, pnpm, Rush, and Cargo workspaces
- **GitHub integration** — add changelogs from PR comments; entries get enriched with PR numbers and commit links
- **Custom change kinds** — define categories beyond `major`/`minor`/`patch` (e.g. `deprecation`, `internal`)
- **Version policies** — independent versioning or lockstep groups
- **Prerelease builds** — automatic unique prerelease versions (e.g. `1.5.0-dev.3`) for nightlies and PR builds
- **Separate pack & publish** — pack first, upload as artifact, publish later

## Supported workspaces

| Environment | Detection                             |
| ----------- | ------------------------------------- |
| pnpm        | `pnpm-workspace.yaml`                 |
| npm         | `package.json` with `workspaces`      |
| Rush        | `rush.json`                           |
| Cargo       | `Cargo.toml` with `workspace` section |

## How it compares to Changesets

Chronus was inspired by [changesets](https://github.com/changesets/changesets) but differs in a few ways:

| Feature           | Chronus                                  | Changesets                         |
| ----------------- | ---------------------------------------- | ---------------------------------- |
| Change detection  | Compares against **remote** branch       | Compares against local base branch |
| Verification      | Checks **every** package has a changelog | Checks for a single changelog file |
| Version policies  | Independent + **lockstep** groups        | Independent only                   |
| Change categories | Fully **customizable** change kinds      | Fixed major/minor/patch            |
| Prerelease builds | Automatic from **pending change count**  | Manual configuration               |
| Pack & publish    | **Separable** workflows                  | Combined                           |

## Documentation

Full docs: **[timotheeguerin.github.io/chronus](https://timotheeguerin.github.io/chronus/)**

## Contributing

Uses [pnpm workspaces](https://pnpm.io/workspaces).

```bash
pnpm install
pnpm build
pnpm test
```

## License

[MIT](LICENSE)
