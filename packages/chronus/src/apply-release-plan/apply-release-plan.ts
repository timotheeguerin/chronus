import { deleteChangeDescription } from "../change/write.js";
import { updateChangelog } from "../changelog/generate.js";
import type { ReleaseAction, ReleasePlan } from "../release-plan/types.js";
import type { ChronusHost } from "../utils/host.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { updatePackageJson } from "./update-package-json.js";

export async function applyReleasePlan(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  releasePlan: ReleasePlan,
): Promise<void> {
  const actionForPackage = new Map<string, ReleaseAction>(releasePlan.actions.map((x) => [x.packageName, x]));
  for (const pkg of workspace.allPackages) {
    await updatePackageJson(host, workspace, pkg, actionForPackage);
  }

  for (const action of releasePlan.actions) {
    await updateChangelog(host, workspace, action);
  }

  for (const change of releasePlan.changes) {
    deleteChangeDescription(host, workspace, change);
  }
}
