import type { ChangeKindResolvedConfig, ChronusResolvedConfig } from "../../config/types.js";
import { execAsync } from "../../utils/exec-async.js";
import { ChronusUserError } from "../../utils/errors.js";

export type AgentType = "copilot" | "claude";

const agentInstructions = `# Chronus Changelog Entry Guide

You are generating a changelog entry for a software project that uses the **chronus** changelog system.

## Changelog File Format

Chronus changelog files use YAML front matter followed by a markdown description:

\`\`\`markdown
---
changeKind: <kind>
packages:
  - <package-name-1>
  - <package-name-2>
---

<A concise, user-facing description of what changed>
\`\`\`

## Writing Good Changelog Messages

- Write from the **user's perspective** — describe what changed for them, not internal implementation details.
- Be **concise** — one or two sentences is ideal.
- Use the **imperative mood** (e.g., "Add support for..." not "Added support for...").
- Focus on the **what** and **why**, not the **how**.
- Do NOT include file names, function names, or implementation details unless they are part of the public API.

### Examples of Good Messages

- "Add \`--agent\` flag to the \`add\` command to delegate changelog generation to an AI agent"
- "Fix version bump incorrectly skipping packages with \`none\` change kind"
- "Support custom changelog generators via the \`changelog\` config option"

### Examples of Bad Messages

- "Updated git.ts to add getDiff method" (too implementation-focused)
- "Fixed bug" (too vague)
- "Changes" (not descriptive)
`;

export interface BuildAgentPromptOptions {
  readonly config: ChronusResolvedConfig;
  readonly packages: string[];
  readonly changeKind: ChangeKindResolvedConfig;
  readonly diff: string;
}

export function buildAgentPrompt(options: BuildAgentPromptOptions): string {
  const { config, packages, changeKind, diff } = options;

  const changeKindsDoc = Object.entries(config.changeKinds)
    .map(([key, kind]) => {
      const desc = kind.description ? ` — ${kind.description}` : "";
      return `- **${key}** (version bump: ${kind.versionType})${desc}`;
    })
    .join("\n");

  const truncatedDiff = diff.length > 50_000 ? diff.slice(0, 50_000) + "\n\n... (diff truncated)" : diff;

  return `${agentInstructions}
## Available Change Kinds

${changeKindsDoc}

## Your Task

Generate a changelog message for the following change:

- **Packages:** ${packages.join(", ")}
- **Change kind:** ${changeKind.name} (${changeKind.title ?? changeKind.name} — version bump: ${changeKind.versionType})

## Git Diff

\`\`\`diff
${truncatedDiff}
\`\`\`

## Instructions

Based on the git diff above, write a concise, user-facing changelog message describing what changed.

**Output ONLY the changelog message text.** Do not include YAML front matter, markdown code fences, or any other wrapping. Just the plain text message.
`;
}

export async function runAgent(agent: AgentType, prompt: string, cwd: string): Promise<string> {
  switch (agent) {
    case "copilot":
      return runCopilotAgent(prompt, cwd);
    case "claude":
      return runClaudeAgent(prompt, cwd);
    default:
      throw new ChronusUserError(`Unknown agent type: ${agent}. Supported agents are: copilot, claude`);
  }
}

async function runCopilotAgent(prompt: string, cwd: string): Promise<string> {
  const result = await execAsync("copilot", ["-p", prompt], { cwd });
  if (result.code !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("not found") || stderr.includes("ENOENT") || result.code === 127) {
      throw new ChronusUserError(
        "GitHub Copilot CLI is not installed. Install it with: `gh extension install github/gh-copilot`",
      );
    }
    throw new ChronusUserError(`Copilot agent failed (exit code ${result.code}):\n${stderr}`);
  }
  return result.stdout.toString().trim();
}

async function runClaudeAgent(prompt: string, cwd: string): Promise<string> {
  const result = await execAsync("claude", ["--print", prompt], { cwd });
  if (result.code !== 0) {
    const stderr = result.stderr.toString();
    if (stderr.includes("not found") || stderr.includes("ENOENT") || result.code === 127) {
      throw new ChronusUserError(
        "Claude Code CLI is not installed. Install it from: https://docs.anthropic.com/en/docs/claude-code",
      );
    }
    throw new ChronusUserError(`Claude agent failed (exit code ${result.code}):\n${stderr}`);
  }
  return result.stdout.toString().trim();
}
