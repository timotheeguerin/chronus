import semverSatisfies from "semver/functions/satisfies.js";
import type { DependencyType, VersionType } from "../types.js";
import type { Package } from "../workspace-manager/types.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { incrementVersion } from "./increment-version.js";
import type { InternalReleaseAction } from "./types.internal.js";

function filterPackages(packages: string[], { only, exclude }: { only?: string[]; exclude?: string[] }): string[] {
  return packages.filter((pkg) => (!only || only.includes(pkg)) && (!exclude || !exclude.includes(pkg)));
}

/*
  WARNING:
  Important note for understanding how this package works:

  We are doing some kind of wacky things with manipulating the objects within the
  releases array, despite the fact that this was passed to us as an argument. We are
  aware that this is generally bad practice, but have decided to to this here as
  we control the entire flow of releases.

  We could solve this by inlining this function, or by returning a deep-cloned then
  modified array, but we decided both of those are worse than this solution.
*/
export function applyDependents({
  actions,
  workspace,
  dependentsGraph,
  only,
  exclude,
}: {
  actions: Map<string, InternalReleaseAction>;
  workspace: ChronusWorkspace;
  dependentsGraph: Map<string, string[]>;
  only?: string[];
  exclude?: string[];
}): boolean {
  let updated = false;
  // NOTE this is intended to be called recursively
  const pkgsToSearch = [...actions.values()];

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    if (!nextRelease) continue;
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependentsGraph.get(nextRelease.packageName);
    if (!pkgDependents) {
      continue;
    }
    filterPackages(pkgDependents, { only, exclude })
      .map((x) => workspace.getPackage(x))
      .map((dependentPackage) => {
        let type: VersionType | undefined;

        const dependent = dependentPackage.name;
        const dependencyVersionRanges = getDependencyVersionRanges(dependentPackage, nextRelease);

        for (const { depType, versionRange } of dependencyVersionRanges) {
          if (nextRelease.type === "none") {
            continue;
          } else if (
            (!actions.has(dependent) || actions.get(dependent)!.type === "none") &&
            !willRangeBeValid(nextRelease, versionRange)
          ) {
            switch (depType) {
              case "prod":
                if (type !== "major" && type !== "minor") {
                  type = "patch";
                }
                break;
              case "dev": {
                // We don't need a version bump if the package is only in the devDependencies of the dependent package
                if (type !== "major" && type !== "minor" && type !== "patch") {
                  type = "none";
                }
              }
            }
          }
        }
        if (actions.has(dependent) && actions.get(dependent)!.type === type) {
          type = undefined;
        }
        return {
          name: dependent,
          type,
          pkg: dependentPackage,
        };
      })
      .filter((dependentItem): dependentItem is typeof dependentItem & { type: VersionType } => !!dependentItem.type)
      .forEach(({ name, type, pkg }) => {
        // At this point, we know if we are making a change
        updated = true;

        const existing = actions.get(name);
        if (existing && existing.policy.type === "lockstep") {
          return;
        }

        // We don't bump private packages
        if (pkg.state === "private" || pkg.state === "ignored") {
          return;
        }
        // For things that are being given a major bump, we check if we have already
        // added them here. If we have, we update the existing item instead of pushing it on to search.
        // It is safe to not add it to pkgsToSearch because it should have already been searched at the
        // largest possible bump type.

        if (existing && type === "major" && existing.type !== "major") {
          existing.type = "major";

          pkgsToSearch.push(existing);
        } else {
          const newDependent: InternalReleaseAction = {
            packageName: name,
            type,
            oldVersion: pkg.version,
            policy: { name: "<auto>", type: "independent", packages: [name] },
          };

          pkgsToSearch.push(newDependent);
          actions.set(name, newDependent);
        }
      });
  }

  return updated;
}

/**
 * Check the given version range will be valid with the new version after this release action.
 */
function willRangeBeValid(release: InternalReleaseAction, versionRange: string) {
  switch (versionRange) {
    case "*":
      return true;
    case "^":
      return release.type === "minor" || release.type === "patch";
    case "~":
      return release.type === "patch";
    default:
      return semverSatisfies(incrementVersion(release), versionRange);
  }
}

/*
  Returns an array of objects in the shape { depType: DependencyType, versionRange: string }
  The array can contain more than one elements in case a dependency appears in multiple
  dependency lists. For example, a package that is both a peerDependencies and a devDependency.
*/
function getDependencyVersionRanges(
  dependentPkg: Package,
  dependencyRelease: InternalReleaseAction,
): {
  depType: DependencyType;
  versionRange: string;
}[] {
  const dependencyVersionRanges: {
    depType: DependencyType;
    versionRange: string;
  }[] = [];
  const spec = dependentPkg.dependencies.get(dependencyRelease.packageName);
  if (spec) {
    if (spec.version.startsWith("workspace:")) {
      dependencyVersionRanges.push({
        depType: spec.kind,
        versionRange:
          // intentionally keep other workspace ranges untouched
          // this has to be fixed but this should only be done when adding appropriate tests
          spec.version === "workspace:*"
            ? // workspace:* actually means the current exact version, and not a wildcard similar to a regular * range
              dependencyRelease.oldVersion
            : spec.version.replace(/^workspace:/, ""),
      });
    } else {
      dependencyVersionRanges.push({
        depType: spec.kind, // TODO: ? just pass the entire spec?
        versionRange: spec.version,
      });
    }
  }
  return dependencyVersionRanges;
}
