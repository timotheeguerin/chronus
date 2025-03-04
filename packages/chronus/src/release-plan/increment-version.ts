import { parse } from "semver";
import semverInc from "semver/functions/inc.js";
import type { InternalReleaseAction } from "./types.internal.js";

export function incrementVersion(release: InternalReleaseAction) {
  if (release.type === "none") {
    return release.oldVersion;
  }

  const oldVersion = parse(release.oldVersion);
  if (oldVersion === null) {
    return release.oldVersion;
  }
  if (oldVersion.prerelease.length > 0) {
    return semverInc(oldVersion, "prerelease")!;
  }

  if (oldVersion.major === 0 && release.type === "major") {
    return semverInc(oldVersion, "minor")!;
  } else {
    return semverInc(oldVersion, release.type)!;
  }
}
