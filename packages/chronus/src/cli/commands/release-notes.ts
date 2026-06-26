import {
  collectReleaseNotesContext,
  renderContextAsJson,
  renderContextAsMarkdown,
} from "../../release-notes/collect-context.js";
import { invokeReleaseNotesTool } from "../../release-notes/invoke-tool.js";
import { loadPromptTemplate, renderPrompt } from "../../release-notes/render-prompt.js";
import type { ReleaseNotesConfig, ReleaseNotesContext, ReleaseNotesOptions } from "../../release-notes/types.js";
import type { ChronusHost } from "../../utils/host.js";
import { getDirectoryPath, resolvePath } from "../../utils/path-utils.js";
import { loadChronusWorkspace } from "../../workspace/index.js";

export async function releaseNotes(host: ChronusHost, options: ReleaseNotesOptions) {
  const workspace = await loadChronusWorkspace(host, options.dir);

  // Collect the structured context
  const context = await collectReleaseNotesContext(host, {
    dir: options.dir,
    package: options.package,
    policy: options.policy,
  });

  const releaseNotesConfig = workspace.config.releaseNotes;
  let output: string;

  if (options.contextOnly) {
    // Just output the raw context
    output = options.format === "json" ? renderContextAsJson(context) : renderContextAsMarkdown(context);
  } else {
    // Load prompt template and render the full prompt
    const template = await loadPromptTemplate(host, workspace.path, releaseNotesConfig?.prompt);
    const prompt = renderPrompt(template, context);

    const tool = options.tool ?? releaseNotesConfig?.tool ?? "none";
    if (tool && tool !== "none") {
      // Run the prompt through the AI CLI and use its response as the release notes.
      output = await invokeReleaseNotesTool(tool, prompt);
    } else {
      // Otherwise just emit the prompt for the user to run manually.
      output = prompt;
    }
  }

  // Write to the resolved output file, or print to stdout when none is configured.
  const outputPath = resolveOutputPath(workspace.path, options, releaseNotesConfig, context);
  if (outputPath) {
    await host.mkdir(getDirectoryPath(outputPath), { recursive: true });
    await host.writeFile(outputPath, output);
  } else {
    process.stdout.write(output);
  }
}

/**
 * Resolve where the release notes should be written. The `--output` CLI flag (relative to
 * the current working directory) takes precedence over the `releaseNotes.output` config
 * (relative to the workspace root). The config path supports `{{version}}`/`{{slug}}`.
 */
function resolveOutputPath(
  workspacePath: string,
  options: ReleaseNotesOptions,
  config: ReleaseNotesConfig | undefined,
  context: ReleaseNotesContext,
): string | undefined {
  if (options.output) {
    return resolvePath(process.cwd(), options.output);
  }
  if (config?.output) {
    const version = context.version ?? "unreleased";
    const slug = version.replace(/\./g, "-");
    const rendered = config.output.replaceAll("{{version}}", version).replaceAll("{{slug}}", slug);
    return resolvePath(workspacePath, rendered);
  }
  return undefined;
}
