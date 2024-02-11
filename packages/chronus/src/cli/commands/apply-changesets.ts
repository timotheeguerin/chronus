import { changesRelativeDir } from "../../change/common.js";
import { readChangeDescription } from "../../change/read.js";
import { deleteChangeDescription } from "../../change/write.js";
import { updateChangelog } from "../../changelog/generate.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleaseAction, ReleasePlan } from "../../release-plan/types.js";
import type { ChronusHost } from "../../utils/host.js";
import type { Mutable } from "../../utils/index.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import { resolvePath } from "../../utils/path-utils.js";
import type { PackageJson } from "../../workspace-manager/types.js";
import { loadChronusWorkspace } from "../../workspace/load.js";
import type { ChronusPackage, ChronusWorkspace } from "../../workspace/types.js";

export interface ApplyChangesetsOptions {
  ignorePolicies?: boolean;
}
export async function applyChangesets(cwd: string, options?: ApplyChangesetsOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);
  const releasePlan = await resolveReleasePlan(host, workspace, options);

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

async function updatePackageJson(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  pkg: ChronusPackage,
  actionForPackage: Map<string, ReleaseAction>,
) {
  const newPkgJson = getNewPackageJson(pkg, actionForPackage);
  await host.writeFile(
    resolvePath(workspace.path, pkg.relativePath, "package.json"),
    JSON.stringify(newPkgJson, null, 2) + "\n",
  );
}

function getNewPackageJson(pkg: ChronusPackage, actionForPackage: Map<string, ReleaseAction>): PackageJson {
  const action = actionForPackage.get(pkg.name);
  const currentPkgJson: Mutable<PackageJson> = JSON.parse(JSON.stringify(pkg.manifest));
  if (action) {
    const newVersion = action.newVersion;
    currentPkgJson.version = newVersion;
  }

  for (const depType of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const depObj = currentPkgJson[depType];
    if (depObj) {
      for (const dep of Object.keys(depObj)) {
        const depAction = actionForPackage.get(dep);
        if (depAction) {
          depObj[dep] = updateDependencyVersion(depObj[dep], depAction.newVersion);
        }
      }
    }
  }
  return currentPkgJson;
}

function updateDependencyVersion(currentVersion: string, newVersion: string): string {
  const currentVersionIsRange = currentVersion.startsWith("^") || currentVersion.startsWith("~");
  if (currentVersionIsRange) {
    return `${currentVersion[0]}${newVersion}`;
  }
  return newVersion;
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
