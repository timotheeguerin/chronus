import type { Package } from "../workspace-manager/types.js";
import type { InternalRelease } from "./types.internal.js";
import { getCurrentHighestVersion, getHighestReleaseType } from "./utils.js";

export function matchFixedConstraint(
  releases: Map<string, InternalRelease>,
  packagesByName: Map<string, Package>,
  fixed: string[][],
): boolean {
  let updated = false;

  for (const fixedPackages of fixed) {
    const releasingFixedPackages = [...releases.values()].filter(
      (release) => fixedPackages.includes(release.packageName) && release.type !== "none",
    );

    if (releasingFixedPackages.length === 0) continue;

    const highestReleaseType = getHighestReleaseType(releasingFixedPackages);
    const highestVersion = getCurrentHighestVersion(fixedPackages, packagesByName);

    // Finally, we update the packages so all of them are on the highest version
    for (const pkgName of fixedPackages) {
      const release = releases.get(pkgName);

      if (!release) {
        updated = true;
        releases.set(pkgName, {
          packageName: pkgName,
          type: highestReleaseType,
          oldVersion: highestVersion,
        });
        continue;
      }

      if (release.type !== highestReleaseType) {
        updated = true;
        release.type = highestReleaseType;
      }
      if (release.oldVersion !== highestVersion) {
        updated = true;
        release.oldVersion = highestVersion;
      }
    }
  }

  return updated;
}
