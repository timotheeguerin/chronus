import type { VersionType } from "@changesets/types";
import semverGt from "semver/functions/gt.js";
import { ChronusError } from "../utils/errors.js";
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

export function getCurrentHighestVersion(packageGroup: string[], packagesByName: Map<string, Package>): string {
  let highestVersion: string | undefined;

  for (const pkgName of packageGroup) {
    const pkg = packagesByName.get(pkgName);

    if (!pkg) {
      throw new ChronusError(
        `FATAL ERROR! Package ${pkgName} defined in package group:\n${packageGroup.map((x) => ` - ${x}`).join("\n")}\n Was not found in the workspace. Available packages are: \n${[...packagesByName.keys()].map((x) => ` - ${x}`).join("\n")}`,
      );
    }

    if (highestVersion === undefined || semverGt(pkg.version, highestVersion)) {
      highestVersion = pkg.version;
    }
  }

  return highestVersion!;
}
