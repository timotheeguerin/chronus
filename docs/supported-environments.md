# Supported Environments

Chronus supports multiple monorepo environments across different ecosystems. The workspace type can be configured via the `workspaceType` option in the chronus config or auto-detected.

## Configuration

In your `.chronus/config.yaml`, you can specify the workspace type:

```yaml
workspaceType: auto # or a specific type like "pnpm", "rush", "cargo", etc.
```

When set to `auto` (default), Chronus will attempt to detect the workspace type based on the files present in the repository root.

## Node.js Ecosystems

### npm Workspaces

- **Type**: `node` or `node:npm`
- **Aliases**: `npm`
- **Detection file**: `package.json` with `workspaces` field

npm workspaces are detected by looking for a `package.json` file with a `workspaces` array defined.

**Example `package.json`:**

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

pnpm workspaces are detected by the presence of a `pnpm-workspace.yaml` file.

**Example `pnpm-workspace.yaml`:**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### Rush

- **Type**: `node:rush`
- **Aliases**: `rush`
- **Detection file**: `rush.json`

Rush monorepos are detected by the presence of a `rush.json` file.

**Example `rush.json`:**

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

Cargo workspaces are detected by the presence of a `Cargo.toml` file with a `workspace` section containing a `members` array.

**Example `Cargo.toml`:**

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

## Auto-detection Priority

When using `auto` detection, Chronus checks for workspace types in the following order:

1. **pnpm** - Looks for `pnpm-workspace.yaml`
2. **Rush** - Looks for `rush.json`
3. **npm** - Looks for `package.json` with `workspaces` field
4. **Cargo** - Looks for `Cargo.toml` with `workspace` section

The first matching workspace type is used.

## Feature Support by Environment

| Feature              | npm | pnpm | Rush | Cargo |
| -------------------- | --- | ---- | ---- | ----- |
| Version bumping      | ✅  | ✅   | ✅   | 🚧    |
| Changelog generation | ✅  | ✅   | ✅   | ✅    |
| Dependency updates   | ✅  | ✅   | ✅   | 🚧    |
| Change file tracking | ✅  | ✅   | ✅   | ✅    |

Legend:

- ✅ Fully supported
- 🚧 In progress / partial support
