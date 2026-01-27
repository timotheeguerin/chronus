import type { PatchPackageVersion } from "../workspace-manager/types.js";
import type { ChronusPackage, ChronusWorkspace } from "../workspace/types.js";
import { updateDependencyVersion } from "./update-dependency-version.js";

export interface VersionAction {
  readonly newVersion: string;
}

export function getManifestPatchRequest(
  workspace: ChronusWorkspace,
  pkg: ChronusPackage,
  actionForPackage: Map<string, VersionAction>,
  dependencyUpdateMode: "stable" | "prerelease" = "stable",
): PatchPackageVersion {
  const patch: PatchPackageVersion = { dependenciesVersions: {} };
  const action = actionForPackage.get(pkg.name);
  if (action) {
    const newVersion = action.newVersion;
    patch.newVersion = newVersion;
  }

  if (pkg.state !== "standalone") {
    for (const dep of pkg.dependencies.values()) {
      const depAction = actionForPackage.get(dep.name);
      if (depAction) {
        patch.dependenciesVersions[dep.name] = updateDependencyVersion(
          dep.version,
          { newVersion: depAction.newVersion, oldVersion: workspace.getPackage(dep.name).version },
          dependencyUpdateMode,
        );
      }
    }
  }

  return patch;
}
