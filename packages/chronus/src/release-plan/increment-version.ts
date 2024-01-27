import semverInc from "semver/functions/inc.js";
import type { InternalRelease } from "./types.internal.js";

export function incrementVersion(release: InternalRelease) {
  if (release.type === "none") {
    return release.oldVersion;
  }

  const version = semverInc(release.oldVersion, release.type)!;
  return version;
}
