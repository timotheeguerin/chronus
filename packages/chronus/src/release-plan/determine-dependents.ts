import type { DependencyType, VersionType } from "@changesets/types";
import semverSatisfies from "semver/functions/satisfies.js";
import type { Package, PackageJson } from "../workspace-manager/types.js";
import { incrementVersion } from "./increment-version.js";
import type { InternalRelease } from "./types.internal.js";

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
export default function determineDependents({
  releases,
  packagesByName,
  dependentsGraph,
}: {
  releases: Map<string, InternalRelease>;
  packagesByName: Map<string, Package>;
  dependentsGraph: Map<string, string[]>;
}): boolean {
  let updated = false;
  // NOTE this is intended to be called recursively
  const pkgsToSearch = [...releases.values()];

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    if (!nextRelease) continue;
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependentsGraph.get(nextRelease.packageName);
    if (!pkgDependents) {
      throw new Error(
        `Error in determining dependents - could not find package in repository: ${nextRelease.packageName}`,
      );
    }
    pkgDependents
      .map((dependent) => {
        let type: VersionType | undefined;

        const dependentPackage = packagesByName.get(dependent);
        if (!dependentPackage) throw new Error("Dependency map is incorrect");

        const dependencyVersionRanges = getDependencyVersionRanges(dependentPackage.manifest, nextRelease);

        for (const { depType, versionRange } of dependencyVersionRanges) {
          if (nextRelease.type === "none") {
            continue;
          } else if (
            shouldBumpMajor({
              dependent,
              depType,
              versionRange,
              releases,
              nextRelease,
            })
          ) {
            type = "major";
          } else if (
            (!releases.has(dependent) || releases.get(dependent)!.type === "none") &&
            !semverSatisfies(incrementVersion(nextRelease), versionRange)
          ) {
            switch (depType) {
              case "dependencies":
              case "optionalDependencies":
              case "peerDependencies":
                if (type !== "major" && type !== "minor") {
                  type = "patch";
                }
                break;
              case "devDependencies": {
                // We don't need a version bump if the package is only in the devDependencies of the dependent package
                if (type !== "major" && type !== "minor" && type !== "patch") {
                  type = "none";
                }
              }
            }
          }
        }
        if (releases.has(dependent) && releases.get(dependent)!.type === type) {
          type = undefined;
        }
        return {
          name: dependent,
          type,
          pkgJSON: dependentPackage.manifest,
        };
      })
      .filter((dependentItem): dependentItem is typeof dependentItem & { type: VersionType } => !!dependentItem.type)
      .forEach(({ name, type, pkgJSON }) => {
        // At this point, we know if we are making a change
        updated = true;

        const existing = releases.get(name);
        // For things that are being given a major bump, we check if we have already
        // added them here. If we have, we update the existing item instead of pushing it on to search.
        // It is safe to not add it to pkgsToSearch because it should have already been searched at the
        // largest possible bump type.

        if (existing && type === "major" && existing.type !== "major") {
          existing.type = "major";

          pkgsToSearch.push(existing);
        } else {
          const newDependent: InternalRelease = {
            packageName: name,
            type,
            oldVersion: pkgJSON.version!,
          };

          pkgsToSearch.push(newDependent);
          releases.set(name, newDependent);
        }
      });
  }

  return updated;
}

/*
  Returns an array of objects in the shape { depType: DependencyType, versionRange: string }
  The array can contain more than one elements in case a dependency appears in multiple
  dependency lists. For example, a package that is both a peerDepenency and a devDependency.
*/
function getDependencyVersionRanges(
  dependentPkgJSON: PackageJson,
  dependencyRelease: InternalRelease,
): {
  depType: DependencyType;
  versionRange: string;
}[] {
  const DEPENDENCY_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
  const dependencyVersionRanges: {
    depType: DependencyType;
    versionRange: string;
  }[] = [];
  for (const type of DEPENDENCY_TYPES) {
    const versionRange = dependentPkgJSON[type]?.[dependencyRelease.packageName];
    if (!versionRange) continue;

    if (versionRange.startsWith("workspace:")) {
      dependencyVersionRanges.push({
        depType: type,
        versionRange:
          // intentionally keep other workspace ranges untouched
          // this has to be fixed but this should only be done when adding appropriate tests
          versionRange === "workspace:*"
            ? // workspace:* actually means the current exact version, and not a wildcard similar to a reguler * range
              dependencyRelease.oldVersion
            : versionRange.replace(/^workspace:/, ""),
      });
    } else {
      dependencyVersionRanges.push({
        depType: type,
        versionRange,
      });
    }
  }
  return dependencyVersionRanges;
}

function shouldBumpMajor({
  dependent,
  depType,
  versionRange,
  releases,
  nextRelease,
}: {
  dependent: string;
  depType: DependencyType;
  versionRange: string;
  releases: Map<string, InternalRelease>;
  nextRelease: InternalRelease;
}) {
  // we check if it is a peerDependency because if it is, our dependent bump type might need to be major.
  return (
    depType === "peerDependencies" &&
    nextRelease.type !== "none" &&
    nextRelease.type !== "patch" &&
    !semverSatisfies(incrementVersion(nextRelease), versionRange) &&
    // bump major only if the dependent doesn't already has a major release.
    (!releases.has(dependent) || (releases.has(dependent) && releases.get(dependent)!.type !== "major"))
  );
}
