import applyReleasePlan from "@changesets/apply-release-plan";
import type { ReleasePlan as ChangesetReleasePlan, ComprehensiveRelease, NewChangeset } from "@changesets/types";
import { changesRelativeDir } from "../../change/common.js";
import { readChangeDescription } from "../../change/read.js";
import type { ChangeDescription } from "../../change/types.js";
import { deleteChangeDescription } from "../../change/write.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleasePlan } from "../../release-plan/types.js";
import type { ChronusHost } from "../../utils/host.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import { resolvePath } from "../../utils/path-utils.js";
import { loadChronusWorkspace } from "../../workspace/load.js";
import type { ChronusWorkspace } from "../../workspace/types.js";

export interface ApplyChangesetsOptions {
  ignorePolicies?: boolean;
}
export async function applyChangesets(cwd: string, options?: ApplyChangesetsOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);
  const releasePlan = await resolveReleasePlan(host, workspace, options);

  const changeSetReleases = releasePlan.actions.map((x) => ({
    ...x,
    name: x.packageName,
    changesets: x.changes.map((y) => y.id),
  }));

  // Changeset will not bump the dependencies of ignored packages if there is not a release for it. Even though we are not changing the versions.
  const noopRelease: ComprehensiveRelease[] = workspace.allPackages
    .filter((x) => !releasePlan.actions.some((y) => y.packageName === x.name))
    .map((x) => ({
      name: x.name,
      oldVersion: x.version,
      newVersion: x.version,
      changesets: [],
      type: "none",
    }));
  const changeSetReleasePlan: ChangesetReleasePlan = {
    changesets: releasePlan.changes.map(mapChangeToChangeset),
    releases: [...changeSetReleases, ...noopRelease],
    preState: undefined,
  };
  const manyPkgs = {
    root: { dir: workspace.path } as any,
    tool: "pnpm",
    packages: workspace.allPackages.map((x) => ({ packageJson: x.manifest as any, name: x.name, dir: x.relativePath })),
  } as const;
  applyReleasePlan(changeSetReleasePlan, manyPkgs, undefined);
  for (const change of releasePlan.changes) {
    deleteChangeDescription(host, workspace, change);
  }
}

export async function resolveReleasePlan(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  options?: ApplyChangesetsOptions | undefined,
): Promise<ReleasePlan> {
  const changelogs = await host.glob(resolvePath(changesRelativeDir, "*.md"), { baseDir: workspace.path });
  const changesets = await Promise.all(changelogs.map((x) => readChangeDescription(host, workspace, x)));

  const releasePlan = assembleReleasePlan(changesets, workspace, options);
  return releasePlan;
}

function mapChangeToChangeset(change: ChangeDescription): NewChangeset {
  return {
    id: change.id,
    summary: change.content,
    releases: change.packages.map((x) => {
      return { name: x, type: change.changeKind.versionType };
    }),
  };
}
