---
# Change versionKind to one of: breaking, feature, fix, internal
changeKind: feature
packages:
  - "@chronus/chronus"
---

Add `chronus ai-release-notes` command that generates an AI prompt for writing blog-post-style release notes from pending changes.

The command collects all pending changes (grouped by package and change kind) into a structured context and renders it into a ready-to-use prompt for an LLM. You can scope it to specific packages or policies, output the raw context as Markdown/JSON, or write the result to a file.

```bash
# Print the full AI prompt for all pending changes
chronus ai-release-notes

# Scope to specific packages and write the prompt to a file
chronus ai-release-notes --package @chronus/chronus --package @chronus/github -o release-notes-prompt.md

# Output only the raw change context (no prompt template) as JSON
chronus ai-release-notes --context-only --format json
```

The prompt template can be customized via the `releaseNotes.prompt` option in `.chronus/config.yaml`.
