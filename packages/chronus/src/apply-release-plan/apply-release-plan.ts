import type { ChangeDescription } from "../change/types.js";
import { deleteChangeDescription, writeChangeDescription } from "../change/write.js";
import { resolveChangelogGenerator, updateChangelog } from "../changelog/generate.js";
import type { ReleaseAction, ReleasePlan, ReleasePlanChangeApplication } from "../release-plan/types.js";
import type { ChronusHost } from "../utils/host.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { updatePackageJson } from "./update-package-json.js";

export async function applyReleasePlan(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  releasePlan: ReleasePlan,
): Promise<void> {
  const actionForPackage = new Map<string, ReleaseAction>(releasePlan.actions.map((x) => [x.packageName, x]));
  // Load this first in case there is a failure so we don't have a partial update of files.
  const changelogGenerator = await resolveChangelogGenerator(
    workspace,
    releasePlan.changes.map((x) => x.change),
  );
  for (const pkg of workspace.allPackages) {
    await updatePackageJson(host, workspace, pkg, actionForPackage);
  }

  for (const action of releasePlan.actions) {
    await updateChangelog(host, workspace, changelogGenerator, action);
  }

  for (const change of releasePlan.changes) {
    await cleanChangeApplication(host, workspace, change);
  }
}

async function cleanChangeApplication(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  application: ReleasePlanChangeApplication,
) {
  switch (application.usage) {
    case "used":
      return await deleteChangeDescription(host, workspace, application.change);
    case "partial":
      return await patchChangeDescription(host, workspace, application.change, application.packages);
  }
}
async function patchChangeDescription(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  change: ChangeDescription,
  exclude: string[],
) {
  const newChange = {
    ...change,
    packages: change.packages.filter((x) => !exclude.includes(x)),
  };
  await writeChangeDescription(host, workspace, newChange);
}
