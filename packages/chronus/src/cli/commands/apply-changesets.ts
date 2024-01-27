import parseChangeset from "@changesets/parse";
import { resolveConfig } from "../../config/parse.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";

export async function applyChangesets(cwd: string): Promise<void> {
  const host = NodechronusHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(cwd);
  const config = await resolveConfig(host, cwd);

  const changelogs = await host.glob(".changeset/*.md", { baseDir: workspace.path });
  const changesets = await Promise.all(
    changelogs
      .filter((x) => x.toLowerCase() !== ".changeset/readme.md")
      .map(async (x) => {
        const file = await host.readFile(x);
        return parseChangeset(file.content);
      }),
  );

  assembleReleasePlan(changesets, workspace, config);
}
