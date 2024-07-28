import type { ChronusHost } from "../utils/host.js";
import { resolvePath } from "../utils/path-utils.js";
import type { Mutable } from "../utils/types.js";
import type { PackageJson } from "../workspace-manager/types.js";
import type { ChronusPackage, ChronusWorkspace } from "../workspace/types.js";
import { updateDependencyVersion } from "./update-dependency-version.js";

export interface VersionAction {
  readonly newVersion: string;
}

export async function updatePackageJson(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  pkg: ChronusPackage,
  actionForPackage: Map<string, VersionAction>,
) {
  const newPkgJson = getNewPackageJson(pkg, actionForPackage);
  await host.writeFile(
    resolvePath(workspace.path, pkg.relativePath, "package.json"),
    JSON.stringify(newPkgJson, null, 2) + "\n",
  );
}

function getNewPackageJson(pkg: ChronusPackage, actionForPackage: Map<string, VersionAction>): PackageJson {
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
