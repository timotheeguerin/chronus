---
title: Supported Environments
description: Monorepo workspace types supported by Chronus.
---

Chronus supports multiple monorepo environments across different ecosystems.

## Configuration

In your `.chronus/config.yaml`, specify where packages and workspaces are located:

### Simple case — single workspace at the top level

```yaml
workspaceType: auto # or a specific type like "pnpm", "rush", "cargo"
```

### Complex case — multiple workspaces or no workspace manager

```yaml
# Equivalent to the default
packages:
  - path: "."
    type: auto

# Explicit packages
packages: ["pkgs/pkg-a", "pkgs/pkg-b"]

# Multiple ecosystems: npm workspace + Cargo workspace + standalone packages
packages:
  - path: "node-pkgs"
    type: npm
  - path: "rust-pkgs"
    type: cargo
  - path: "others/*"
    type: npm
```

When set to `auto` (default), Chronus detects the workspace type based on files present in the repository root.

## Node.js Ecosystems

### npm Workspaces

- **Type**: `node` or `node:npm`
- **Aliases**: `npm`
- **Detection file**: `package.json` with `workspaces` field

```json
{
  "name": "my-monorepo",
  "workspaces": ["packages/*"]
}
```

### pnpm

- **Type**: `node:pnpm`
- **Aliases**: `pnpm`
- **Detection file**: `pnpm-workspace.yaml`

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### Rush

- **Type**: `node:rush`
- **Aliases**: `rush`
- **Detection file**: `rush.json`

```json
{
  "projects": [
    {
      "packageName": "@my-scope/my-package",
      "projectFolder": "packages/my-package",
      "shouldPublish": true
    }
  ]
}
```

## Rust Ecosystem

### Cargo Workspaces

- **Type**: `rust:cargo`
- **Aliases**: `cargo`
- **Detection file**: `Cargo.toml` with `workspace` section

```toml
[workspace]
resolver = "2"
members = [
    "crates/*",
    "tools/*"
]
exclude = [
    "examples/*"
]
```

Each crate's `Cargo.toml` must have a `package` section with `name` and `version`:

```toml
[package]
name = "my-crate"
version = "1.0.0"

[dependencies]
some-dep = "1.2.3"
```

## Auto-detection priority

When using `auto` detection, Chronus checks for workspace types in this order:

1. **pnpm** — Looks for `pnpm-workspace.yaml`
2. **Rush** — Looks for `rush.json`
3. **npm** — Looks for `package.json` with `workspaces` field
4. **Cargo** — Looks for `Cargo.toml` with `workspace` section

The first matching workspace type is used.

## Feature support by environment

| Feature              | npm | pnpm | Rush | Cargo |
| -------------------- | --- | ---- | ---- | ----- |
| Version bumping      | ✅  | ✅   | ✅   | 🚧    |
| Changelog generation | ✅  | ✅   | ✅   | ✅    |
| Dependency updates   | ✅  | ✅   | ✅   | 🚧    |
| Change file tracking | ✅  | ✅   | ✅   | ✅    |

**Legend:** ✅ Fully supported · 🚧 In progress / partial support
