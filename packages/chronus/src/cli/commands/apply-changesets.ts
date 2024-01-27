import parseChangeset from "@changesets/parse";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import { createGitSourceControl } from "../../source-control/git.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function applyChangesets(cwd: string): Promise<void> {
  const host = NodechronusHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(cwd);
  const sourceControl = createGitSourceControl(workspace.path);

  const changelogs = await host.glob(".changeset/*.md", { baseDir: workspace.path });
  const changesets = await Promise.all(
    changelogs
      .filter((x) => x.toLowerCase() !== ".changeset/readme.md")
      .map(async (x) => {
        const file = await host.readFile(x);
        return parseChangeset(file.content);
      }),
  );

  assembleReleasePlan(changesets, workspace);
}
