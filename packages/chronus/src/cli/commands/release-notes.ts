import { writeFile } from "node:fs/promises";
import { collectReleaseNotesContext, renderContextAsJson, renderContextAsMarkdown } from "../../release-notes/collect-context.js";
import { loadPromptTemplate, renderPrompt } from "../../release-notes/render-prompt.js";
import type { ReleaseNotesOptions } from "../../release-notes/types.js";
import type { ChronusHost } from "../../utils/host.js";
import { loadChronusWorkspace } from "../../workspace/index.js";

export async function releaseNotes(host: ChronusHost, options: ReleaseNotesOptions) {
  const workspace = await loadChronusWorkspace(host, options.dir);

  // Collect the structured context
  const context = await collectReleaseNotesContext(host, {
    dir: options.dir,
    package: options.package,
    policy: options.policy,
  });

  let output: string;

  if (options.contextOnly) {
    // Just output the raw context
    output =
      options.format === "json" ? renderContextAsJson(context) : renderContextAsMarkdown(context);
  } else {
    // Load prompt template and render the full prompt
    const releaseNotesConfig = (workspace.config as any).releaseNotes;
    const template = await loadPromptTemplate(host, workspace.path, releaseNotesConfig?.prompt);
    output = renderPrompt(template, context);
  }

  // Output or write to file
  if (options.output) {
    await writeFile(options.output, output, "utf-8");
  } else {
    process.stdout.write(output);
  }
}
