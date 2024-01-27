import type { Package } from "../workspace-manager/types.js";
import type { InternalRelease } from "./types.internal.js";
import { getCurrentHighestVersion, getHighestReleaseType } from "./utils.js";

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
export default function applyLinks(
  releases: Map<string, InternalRelease>,
  packagesByName: Map<string, Package>,
  linked: readonly string[][],
): boolean {
  let updated = false;

  // We do this for each set of linked packages
  for (const linkedPackages of linked) {
    // First we filter down to all the relevant releases for one set of linked packages
    const releasingLinkedPackages = [...releases.values()].filter(
      (release) => linkedPackages.includes(release.packageName) && release.type !== "none",
    );

    // If we proceed any further we do extra work with calculating highestVersion for things that might
    // not need one, as they only have workspace based packages
    if (releasingLinkedPackages.length === 0) continue;

    const highestReleaseType = getHighestReleaseType(releasingLinkedPackages);
    const highestVersion = getCurrentHighestVersion(linkedPackages, packagesByName);

    // Finally, we update the packages so all of them are on the highest version
    for (const linkedPackage of releasingLinkedPackages) {
      if (linkedPackage.type !== highestReleaseType) {
        updated = true;
        linkedPackage.type = highestReleaseType;
      }
      if (linkedPackage.oldVersion !== highestVersion) {
        updated = true;
        linkedPackage.oldVersion = highestVersion;
      }
    }
  }

  return updated;
}
