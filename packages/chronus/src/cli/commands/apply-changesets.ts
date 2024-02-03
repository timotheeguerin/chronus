import applyReleasePlan from "@changesets/apply-release-plan";
import parseChangeset from "@changesets/parse";
import type { ReleasePlan as ChangesetReleasePlan } from "@changesets/types";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleasePlan } from "../../release-plan/types.js";
import type { ChronusHost } from "../../utils/host.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { loadChronusWorkspace } from "../../workspace/load.js";
import type { ChronusWorkspace } from "../../workspace/types.js";

export interface ApplyChangesetsOptions {
  ignorePolicies?: boolean;
}
export async function applyChangesets(cwd: string, options?: ApplyChangesetsOptions): Promise<void> {
  const host = NodechronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);
  const releasePlan = await resolveReleasePlan(host, workspace, options);

  const changeSetReleasePlan: ChangesetReleasePlan = {
    changesets: releasePlan.changesets,
    releases: releasePlan.actions.map((x) => ({
      ...x,
      name: x.packageName,
      changesets: x.changesets.map((y) => y.id),
    })),
    preState: undefined,
  };
  const manyPkgs = {
    root: { dir: workspace.path } as any,
    tool: "pnpm",
    packages: workspace.allPackages.map((x) => ({ packageJson: x.manifest as any, name: x.name, dir: x.relativePath })),
  } as const;
  applyReleasePlan(changeSetReleasePlan, manyPkgs, undefined);
}

export async function resolveReleasePlan(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  options?: ApplyChangesetsOptions | undefined,
): Promise<ReleasePlan> {
  const changelogs = await host.glob(".changeset/*.md", { baseDir: workspace.path });
  const changesets = await Promise.all(
    changelogs
      .filter((x) => x.toLowerCase() !== ".changeset/readme.md")
      .map(async (x) => {
        const file = await host.readFile(x);
        return { ...parseChangeset(file.content), id: x.slice(".changeset/".length, -3) };
      }),
  );

  const releasePlan = assembleReleasePlan(changesets, workspace, options);
  return releasePlan;
}
