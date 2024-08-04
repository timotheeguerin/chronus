import { inc, parse } from "semver";
import type { VersionAction } from "../apply-release-plan/update-package-json.js";
import type { ChangeDescription } from "../change/types.js";
import { assembleReleasePlan } from "../release-plan/assemble-release-plan.js";
import type { ChronusWorkspace } from "../workspace/types.js";

/**
 *
 * @param changes Current changesets
 * @param workspace Chronus workspace
 * @param prereleaseTemplate Template for the prerelease version. The following variables are available:
 *  - changeCount
 *  - changeCountWithPatch
 *  - nextVersion
 * @returns Map of each package and their prerelease version
 */
export async function getPrereleaseVersionActions(
  changes: ChangeDescription[],
  workspace: ChronusWorkspace,
  prereleaseTemplate: string,
): Promise<Map<string, VersionAction>> {
  const releasePlan = assembleReleasePlan(changes, workspace);

  const changePerPackage = new Map<string, number>();
  for (const pkg of workspace.packages) {
    changePerPackage.set(pkg.name, 0);
  }

  for (const change of changes) {
    for (const pkgName of change.packages) {
      const existing = changePerPackage.get(pkgName);
      if (existing !== undefined) {
        changePerPackage.set(pkgName, existing + 1);
      }
    }
  }

  const versionActions = new Map<string, VersionAction>();
  for (const pkg of workspace.packages) {
    const changeCount = changePerPackage.get(pkg.name) ?? 0;
    const action = releasePlan.actions.find((x) => x.packageName === pkg.name);
    const version = parse(pkg.version)!;

    const prereleaseVersion = interpolateTemplate(prereleaseTemplate, {
      changeCount,
      changeCountWithPatch: changeCount + version.patch,
      nextVersion: action?.newVersion ?? inc(pkg.version, "patch")!,
    });
    versionActions.set(pkg.name, { newVersion: prereleaseVersion });
  }

  return versionActions;
}

interface InterpolatePrereleaseVersionArgs {
  readonly changeCount: number;
  readonly changeCountWithPatch: number;
  readonly nextVersion: string;
}

function interpolateTemplate(template: string, args: InterpolatePrereleaseVersionArgs) {
  return template.replace(/{(\w+)}/g, (_, key) => {
    return String(args[key as keyof typeof args]);
  });
}
