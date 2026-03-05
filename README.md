<div align="center">

# Chronus

**Changelog management for monorepos**

[![npm version](https://img.shields.io/npm/v/chronus)](https://www.npmjs.com/package/chronus)
[![CI](https://github.com/timotheeguerin/chronus/actions/workflows/ci.yml/badge.svg)](https://github.com/timotheeguerin/chronus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Chronus ensures every changed package in your monorepo has a meaningful changelog entry — and makes it easy to add one directly from a GitHub PR comment.

[📖 Documentation](https://timotheeguerin.github.io/chronus/) · [🐛 Report Bug](https://github.com/timotheeguerin/chronus/issues) · [💡 Request Feature](https://github.com/timotheeguerin/chronus/issues)

</div>

---

## ✨ Features

- 🌍 **Multi-ecosystem support** — Works with npm, pnpm, Rush, and Cargo workspaces out of the box
- ✅ **Per-package verification** — Verifies every changed package has a changelog, not just that a single file exists
- 🔗 **GitHub integration** — Add changelogs from PR comments in the browser; enrich entries with PR numbers and commit links
- 🏷️ **Custom change kinds** — Go beyond `major`/`minor`/`patch` with categories like `deprecation`, `internal`, or `chore`
- 🔒 **Flexible version policies** — Choose independent versioning or lockstep groups for synchronized releases
- 🚀 **Prerelease builds** — Automatically produce unique prerelease versions (e.g. `1.5.0-dev.3`) for nightly and PR builds
- 📦 **Separate pack & publish** — Pack packages, upload as artifacts, and publish later

## 🚀 Quick Start

```bash
# Install
npm install -D chronus

# Add a changelog entry
npx chronus add

# Verify all changed packages have entries
npx chronus verify

# Bump versions and generate changelogs
npx chronus version
```

## 📋 Supported Environments

| Environment | Workspace Detection |
| ----------- | ------------------- |
| **pnpm**    | `pnpm-workspace.yaml` |
| **npm**     | `package.json` with `workspaces` |
| **Rush**    | `rush.json` |
| **Cargo**   | `Cargo.toml` with `workspace` section |

## 🆚 Why Chronus over Changesets?

Chronus was inspired by [changesets](https://github.com/changesets/changesets) but takes a different approach:

| Feature | Chronus | Changesets |
| ------- | ------- | ---------- |
| Change detection | Compares against **remote** branch | Compares against local base branch |
| Verification | Checks **every** package has a changelog | Checks for a single changelog file |
| Version policies | Independent + **lockstep** groups | Independent only |
| Change categories | Fully **customizable** change kinds | Fixed major/minor/patch |
| Prerelease builds | Automatic from **pending change count** | Manual configuration |
| Pack & publish | **Separable** workflows | Combined |

## 📖 Documentation

Full documentation is available at **[timotheeguerin.github.io/chronus](https://timotheeguerin.github.io/chronus/)**.

- [Installation & Setup](https://timotheeguerin.github.io/chronus/getting-started/installation/)
- [CLI Reference](https://timotheeguerin.github.io/chronus/reference/cli/)
- [Change Kinds](https://timotheeguerin.github.io/chronus/guides/change-kinds/)
- [Version Policies](https://timotheeguerin.github.io/chronus/guides/version-policies/)
- [Supported Environments](https://timotheeguerin.github.io/chronus/guides/supported-environments/)

## 🤝 Contributing

Contributions are welcome! This project uses [pnpm workspaces](https://pnpm.io/workspaces).

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm test       # Run tests
```

## 📄 License

[MIT](LICENSE) © Microsoft
