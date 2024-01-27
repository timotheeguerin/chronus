import semverInc from "semver/functions/inc.js";
import type { InternalReleaseAction } from "./types.internal.js";

export function incrementVersion(release: InternalReleaseAction) {
  if (release.type === "none") {
    return release.oldVersion;
  }

  const version = semverInc(release.oldVersion, release.type)!;
  return version;
}
