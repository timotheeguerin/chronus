# Chronus

Changelog management for monorepos.

[![npm version](https://img.shields.io/npm/v/@chronus/chronus)](https://www.npmjs.com/package/@chronus/chronus)
[![CI](https://github.com/timotheeguerin/chronus/actions/workflows/ci.yml/badge.svg)](https://github.com/timotheeguerin/chronus/actions/workflows/ci.yml)

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

- Change detection compares against the **remote** branch, not a local base
- Verification checks **every** package, not just that a single changelog file exists
- Supports **lockstep** version policies in addition to independent versioning
- Change kinds are **customizable**, not fixed to major/minor/patch
- Prerelease versions are derived automatically from **pending change count**
- Pack and publish are **separate steps** so you can upload artifacts in between

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
