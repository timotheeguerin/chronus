import type { PackageGroup, VersionType } from "@changesets/types";
import semverGt from "semver/functions/gt.js";
import type { Package } from "../workspace-manager/types.js";
import type { InternalRelease } from "./types.internal.js";

export function getHighestReleaseType(releases: InternalRelease[]): VersionType {
  if (releases.length === 0) {
    throw new Error(
      `Large internal Changesets error when calculating highest release type in the set of releases. Please contact the maintainers`,
    );
  }

  let highestReleaseType: VersionType = "none";

  for (const release of releases) {
    switch (release.type) {
      case "major":
        return "major";
      case "minor":
        highestReleaseType = "minor";
        break;
      case "patch":
        if (highestReleaseType === "none") {
          highestReleaseType = "patch";
        }
        break;
    }
  }

  return highestReleaseType;
}

export function getCurrentHighestVersion(packageGroup: PackageGroup, packagesByName: Map<string, Package>): string {
  let highestVersion: string | undefined;

  for (const pkgName of packageGroup) {
    const pkg = packagesByName.get(pkgName);

    if (!pkg) {
      throw new Error(
        `FATAL ERROR IN CHANGESETS! We were unable to version for package group: ${pkgName} in package group: ${packageGroup.toString()}`,
      );
    }

    if (highestVersion === undefined || semverGt(pkg.version, highestVersion)) {
      highestVersion = pkg.version;
    }
  }

  return highestVersion!;
}
