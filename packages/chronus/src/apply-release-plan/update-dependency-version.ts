const workspaceScheme = "workspace:";

/** Update the current version range with the new version. Supports standard semver annotations as well as `workspace:` protocol. */
export function updateDependencyVersion(currentVersion: string, newVersion: string): string {
  if (currentVersion.startsWith("workspace:")) {
    return updateWorkspaceDependencyVersion(currentVersion, newVersion);
  }
  if (currentVersion === "*") {
    return currentVersion;
  }
  if (currentVersion.startsWith("^") || currentVersion.startsWith("~")) {
    return `${currentVersion[0]}${newVersion}`;
  } else if (currentVersion.startsWith(">=")) {
    return `${currentVersion.slice(0, 2)}${newVersion}`;
  }
  return newVersion;
}

/** For version that are prefixed with `workspace:` */
function updateWorkspaceDependencyVersion(currentVersion: string, newVersion: string): string {
  const versionWithoutScheme = currentVersion.slice(workspaceScheme.length);
  switch (versionWithoutScheme) {
    case "*":
    case "^":
    case "~":
    case ">=":
      return currentVersion;
    default:
      return `${workspaceScheme}${updateDependencyVersion(versionWithoutScheme, newVersion)}`;
  }
}
