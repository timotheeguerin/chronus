import type { ChangeDescription } from "../change/types.js";
import { getDependentsGraph } from "../dependency-graph/index.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { applyDependents } from "./determine-dependents.js";
import { incrementVersion } from "./increment-version.js";
import type { InternalReleaseAction } from "./types.internal.js";
import type { ReleaseAction, ReleasePlan, ReleasePlanChangeApplication } from "./types.js";

export interface ApplyChangesetsOptions {
  readonly ignorePolicies?: boolean;
  readonly only?: string[];
}

export function assembleReleasePlan(
  changes: ChangeDescription[],
  workspace: ChronusWorkspace,
  options?: ApplyChangesetsOptions,
): ReleasePlan {
  const packagesByName = new Map(workspace.allPackages.map((pkg) => [pkg.name, pkg]));
  const { changeApplications, actions: requested } = reduceChanges(changes, workspace, options?.only);

  const dependentsGraph = getDependentsGraph(workspace.allPackages);
  const internalActions = new Map<string, InternalReleaseAction>();
  if (workspace.config.versionPolicies && !options?.ignorePolicies) {
    for (const policy of workspace.config.versionPolicies) {
      if (policy.type === "lockstep") {
        for (const pkgName of policy.packages) {
          if (options?.only && !options.only.includes(pkgName)) continue;
          const pkg = packagesByName.get(pkgName);
          if (!pkg) throw new Error(`Could not find package ${pkgName}`);
          internalActions.set(pkgName, {
            packageName: pkgName,
            type: policy.step,
            oldVersion: pkg.version,
            policy: policy,
          });
        }
      }
    }
  }

  for (const request of requested.values()) {
    const existing = internalActions.get(request.packageName);
    if (!existing) {
      internalActions.set(request.packageName, request);
    }
  }

  // The map passed in to determineDependents will be mutated
  applyDependents({
    actions: internalActions,
    workspace,
    dependentsGraph,
    only: options?.only,
  });

  const actions = [...internalActions.values()].map((incompleteRelease): ReleaseAction => {
    return {
      ...incompleteRelease,
      newVersion: getNewVersion(incompleteRelease),
      changes: changes.filter((change) => change.packages.some((pkgName) => pkgName === incompleteRelease.packageName)),
    };
  });

  return {
    changes: changeApplications,
    actions,
  };
}

function reduceChanges(
  changes: ChangeDescription[],
  workspace: ChronusWorkspace,
  only?: string[],
): { changeApplications: ReleasePlanChangeApplication[]; actions: Map<string, InternalReleaseAction> } {
  const actions: Map<string, InternalReleaseAction> = new Map();
  const changeApplications: ReleasePlanChangeApplication[] = [];
  for (const change of changes) {
    const type = change.changeKind.versionType;
    // Filter out ignored packages because they should not trigger a release
    // If their dependencies need updates, they will be added to releases by `determineDependents()` with release type `none`
    const packages = change.packages
      .filter((name) => !only || only.includes(name))
      .map((name) => workspace.getPackage(name))
      .filter((pkg) => !pkg.ignored);

    changeApplications.push({
      usage: change.packages.length === packages.length ? "used" : packages.length === 0 ? "unused" : "partial",
      packages: packages.map((pkg) => pkg.name),
      change,
    });

    packages.forEach((pkg) => {
      const name = pkg.name;
      let release: InternalReleaseAction | undefined = actions.get(name);
      if (!pkg) {
        throw new Error(
          `"${change}" changeset mentions a release for a package "${name}" but such a package could not be found.`,
        );
      }
      if (!release) {
        release = {
          packageName: name,
          type,
          oldVersion: pkg.version,
          policy: { name: "<auto>", type: "independent", packages: [name] },
        };
      } else {
        if (
          type === "major" ||
          ((release.type === "patch" || release.type === "none") && (type === "minor" || type === "patch"))
        ) {
          release.type = type;
        }
      }

      actions.set(name, release);
    });
  }

  return { actions, changeApplications };
}

function getNewVersion(release: InternalReleaseAction): string {
  if (release.type === "none") {
    return release.oldVersion;
  }

  return incrementVersion(release);
}
