import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolvePath } from "../utils/path-utils.js";
import type { ChronusHost } from "../utils/host.js";
import { renderContextAsMarkdown } from "./collect-context.js";
import type { ReleaseNotesContext } from "./types.js";

const defaultPromptPath = resolvePath(fileURLToPath(import.meta.url), "../default-prompt.md");

/**
 * Load the prompt template. Uses a custom template from the workspace if configured,
 * otherwise falls back to the built-in default.
 */
export async function loadPromptTemplate(
  host: ChronusHost,
  workspacePath: string,
  customPromptPath?: string,
): Promise<string> {
  if (customPromptPath) {
    const fullPath = resolvePath(workspacePath, customPromptPath);
    const file = await host.readFile(fullPath);
    return file.content;
  }

  return readFile(defaultPromptPath, "utf-8");
}

/**
 * Render the prompt template by replacing template variables with actual context data.
 *
 * Supported variables:
 * - {{context}} — the full context rendered as markdown
 * - {{version}} — the release version
 * - {{packages}} — comma-separated list of packages
 * - {{releaseDate}} — the release date
 * - {{policy}} — the policy name (if applicable)
 * - {{slug}} — URL-friendly version slug (e.g., "1-13-0")
 */
export function renderPrompt(template: string, context: ReleaseNotesContext): string {
  const contextMarkdown = renderContextAsMarkdown(context);
  const version = context.version ?? "unreleased";
  const slug = version.replace(/\./g, "-");

  let result = template;
  result = result.replaceAll("{{context}}", contextMarkdown);
  result = result.replaceAll("{{version}}", version);
  result = result.replaceAll("{{slug}}", slug);
  result = result.replaceAll("{{packages}}", context.packages.join(", "));
  result = result.replaceAll("{{releaseDate}}", context.releaseDate ?? "TBD");
  result = result.replaceAll("{{policy}}", context.policy ?? "");

  return result;
}
