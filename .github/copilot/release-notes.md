# Release Notes Generator Skill

## Description

Generate blog-post-style release notes from pending chronus change descriptions. This skill collects all documented changes and produces a polished, developer-friendly release notes document.

## When to Use

Use this skill when asked to:

- Create release notes for an upcoming release
- Write a blog post summarizing changes
- Generate a release announcement

## Instructions

1. **Collect the change context** by running:

   ```bash
   chronus release-notes --context-only
   ```

   This outputs all pending changes as structured markdown.

   To scope to a specific policy or package:

   ```bash
   chronus release-notes --context-only --policy <policy-name>
   chronus release-notes --context-only --package <package-name>
   ```

2. **Review the context** to understand what changed:
   - Breaking changes that need migration guides
   - New features worth highlighting
   - Bug fixes

3. **Write the release notes** as a blog-post-style markdown document with:
   - A brief intro summarizing the release theme (1-2 sentences)
   - **Highlights** section with the top 3-5 most impactful changes
   - **Breaking Changes** section (if any) with migration guides showing before/after code
   - **New Features** section with brief explanations and code examples
   - **Bug Fixes** section
   - A brief closing/thank-you

4. **Guidelines for writing:**
   - Use a friendly, professional tone for a developer audience
   - Do NOT invent API surface or features not listed in the change data
   - Include code examples where they help illustrate usage or migration
   - Reference PR numbers when available in the change metadata
   - Keep descriptions concise but informative

5. **Output** the release notes as a markdown file (e.g., `release-notes-<version>.md`).

## Example Usage

When a user says "Create release notes for the next release", run:

```bash
chronus release-notes --context-only
```

Then use the output to write a polished blog-post-style release notes document.

## Full Prompt Generation

For a pre-assembled prompt with all context and instructions combined, run:

```bash
chronus release-notes
```

This outputs the full prompt (template + context) that can be used directly.
