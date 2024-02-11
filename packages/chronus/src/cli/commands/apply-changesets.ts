import { changesRelativeDir } from "../../change/common.js";
import { readChangeDescription } from "../../change/read.js";
import { deleteChangeDescription } from "../../change/write.js";
import { updateChangelog } from "../../changelog/generate.js";
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

  for (const action of releasePlan.actions) {
    await updateChangelog(host, workspace, action);
  }

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
