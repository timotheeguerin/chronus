---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: internal
packages:
  - "@chronus/chronus"
---

Make `chronus ai-release-notes` generate notes end to end, optionally driving an AI CLI for you.

## Usage

Print the prompt (default) and pipe it into the agent of your choice:

```bash
chronus ai-release-notes --policy my-policy
```

Or let chronus run the agent and capture the generated notes directly:

```bash
# Requires the `copilot` (GitHub Copilot CLI) or `claude` (Claude Code) binary on your PATH and logged in
chronus ai-release-notes --policy my-policy --tool copilot -o release-notes/next.md
```

A progress spinner is shown on stderr while the agent runs; the generated document is written to `--output` (or stdout).

## Configure defaults in `.chronus/config.yaml`

```yaml
releaseNotes:
  tool: copilot # copilot | claude | none (default: none, just print the prompt)
  output: release-notes/{{slug}}.md # where to write the notes; supports {{version}} and {{slug}}
  prompt: ./custom-prompt.md # optional: override the built-in prompt template
```

The `--tool` and `--output` flags override the config. The built-in prompt produces plain, framework-agnostic Markdown (no front matter, MDX, or HTML), so it works regardless of your docs site.

## What changed

- Bundle the default prompt template so the command works when installed (previously failed with `ENOENT` on `default-prompt.md`).
- Add `--tool <copilot|claude|none>` / `releaseNotes.tool` to run the prompt non-interactively and capture the result.
- Add `releaseNotes.output` (with `{{version}}`/`{{slug}}` placeholders) to write notes to a configured path.
- Rewrite the default prompt to be plain-Markdown and framework/folder-structure agnostic.
- Allow the `releaseNotes` section (`prompt`, `output`, `enrichers`, `tool`) in `.chronus/config.yaml`.
