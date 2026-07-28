import { inc, parse } from "semver";

import type { VersionAction } from "../apply-release-plan/get-manifest-patch-request.js";
import type { ChangeDescription } from "../change/types.js";
import { assembleReleasePlan } from "../release-plan/assemble-release-plan.js";
import type { GitRepository } from "../source-control/git.js";
import { isPackageIncluded } from "../utils/misc-utils.js";
import { resolvePath } from "../utils/path-utils.js";
import type { ChronusWorkspace } from "../workspace/types.js";

export interface PrereleaseVersionOptions {
  readonly only?: string[];
  readonly exclude?: string[];
  /**
   * Source control used to resolve `{packageCommitCount}`. Required when the template references it.
   */
  readonly sourceControl?: GitRepository;
}

/** Variable name that requires access to source control to be resolved. */
const packageCommitCountVar = "packageCommitCount";

/**
 *
 * @param changes Current changesets
 * @param workspace Chronus workspace
 * @param prereleaseTemplate Template for the prerelease version. The following variables are available:
 *  - changeCount: Number of change entries currently present for the package. Not monotonic (a
 *    reverted/deleted change entry decreases it).
 *  - changeCountWithPatch: changeCount plus the current patch number of the package.
 *  - packageCommitCount: Number of commits reachable from HEAD that touched the package folder.
 *    Monotonic (only grows), so it is not affected by reverts deleting change entries. Requires
 *    `options.sourceControl` and the full git history to be available.
 *  - nextVersion: The next version for the package if `chronus version` was run today.
 * @returns Map of each package and their prerelease version
 */
export async function getPrereleaseVersionActions(
  changes: ChangeDescription[],
  workspace: ChronusWorkspace,
  prereleaseTemplate: string,
  options: PrereleaseVersionOptions = {},
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

  const needsCommitCount = prereleaseTemplate.includes(`{${packageCommitCountVar}}`);
  if (needsCommitCount && options.sourceControl === undefined) {
    throw new Error(
      `Prerelease template uses {${packageCommitCountVar}} but no source control was provided to resolve it.`,
    );
  }

  const versionActions = new Map<string, VersionAction>();
  for (const pkg of workspace.packages.filter((pkg) => isPackageIncluded(pkg, options))) {
    const changeCount = changePerPackage.get(pkg.name) ?? 0;
    const action = releasePlan.actions.find((x) => x.packageName === pkg.name);
    const version = parse(pkg.version)!;

    let packageCommitCount = 0;
    if (needsCommitCount && options.sourceControl) {
      const packagePath = resolvePath(workspace.path, pkg.relativePath);
      packageCommitCount = await options.sourceControl.getCommitCountForPath(packagePath);
    }

    const prereleaseVersion = interpolateTemplate(prereleaseTemplate, {
      changeCount,
      changeCountWithPatch: changeCount + version.patch,
      packageCommitCount,
      nextVersion: action?.newVersion ?? inc(pkg.version, "patch")!,
    });
    versionActions.set(pkg.name, { newVersion: prereleaseVersion });
  }

  return versionActions;
}

interface InterpolatePrereleaseVersionArgs {
  readonly changeCount: number;
  readonly changeCountWithPatch: number;
  readonly packageCommitCount: number;
  readonly nextVersion: string;
}

function interpolateTemplate(template: string, args: InterpolatePrereleaseVersionArgs) {
  return template.replace(/{(\w+)}/g, (_, key) => {
    return String(args[key as keyof typeof args]);
  });
}
