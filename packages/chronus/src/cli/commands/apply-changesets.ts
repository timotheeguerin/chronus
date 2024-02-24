import { applyReleasePlan } from "../../apply-release-plan/index.js";
import { readChangeDescriptions } from "../../change/read.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleasePlan } from "../../release-plan/types.js";
import type { ChronusHost } from "../../utils/host.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import { loadChronusWorkspace } from "../../workspace/load.js";
import type { ChronusWorkspace } from "../../workspace/types.js";

export interface ApplyChangesetsOptions {
  readonly ignorePolicies?: boolean;
  readonly only?: string[];
}

export async function applyChangesets(cwd: string, options?: ApplyChangesetsOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);
  const releasePlan = await resolveReleasePlan(host, workspace, options);

  await applyReleasePlan(host, workspace, releasePlan);
}

export async function resolveReleasePlan(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  options?: ApplyChangesetsOptions | undefined,
): Promise<ReleasePlan> {
  const changesets = await readChangeDescriptions(host, workspace);

  const releasePlan = assembleReleasePlan(changesets, workspace, options);
  return releasePlan;
}
