const workspaceScheme = "workspace:";

export interface ResolvedVersionAction {
  readonly oldVersion: string;
  readonly newVersion: string;
}

/** Update the current version range with the new version. Supports standard semver annotations as well as `workspace:` protocol. */
export function updateDependencyVersion(
  currentRequirement: string,
  action: ResolvedVersionAction,
  dependencyUpdateMode: "stable" | "prerelease",
): string {
  if (currentRequirement === "*") {
    return currentRequirement;
  }

  if (dependencyUpdateMode === "prerelease") {
    return updatePrereleaseDependencyVersion(currentRequirement, action);
  } else {
    return updateStableDependencyVersion(currentRequirement, action.newVersion);
  }
}

function updatePrereleaseDependencyVersion(currentRequirement: string, action: ResolvedVersionAction): string {
  let stableVersion = "";
  if (currentRequirement.startsWith("workspace:")) {
    stableVersion = resolveWorkspaceVersion(currentRequirement, action);
    currentRequirement = currentRequirement.slice(workspaceScheme.length);
  } else {
    stableVersion = currentRequirement;
  }
  return `${stableVersion} || >= ${action.newVersion}`;
}

function resolveWorkspaceVersion(currentRequirement: string, action: ResolvedVersionAction): string {
  const reqWithoutScheme = currentRequirement.slice(workspaceScheme.length);
  switch (reqWithoutScheme) {
    case "*":
      return "*";
    case "^":
    case "~":
    case ">=":
      return `${reqWithoutScheme}${action.oldVersion}`;
    default:
      if (reqWithoutScheme.startsWith(">=")) {
        return `>=${action.oldVersion}`;
      } else {
        switch (reqWithoutScheme[0]) {
          case "*":
          case "^":
          case "~":
            return `${reqWithoutScheme[0]}${action.oldVersion}`;
          default:
            return action.oldVersion;
        }
      }
  }
}

function updateStableDependencyVersion(currentRequirement: string, newVersion: string): string {
  if (currentRequirement.startsWith("workspace:")) {
    return updateWorkspaceStableDependencyVersion(currentRequirement, newVersion);
  }

  if (currentRequirement.startsWith("^") || currentRequirement.startsWith("~")) {
    return `${currentRequirement[0]}${newVersion}`;
  } else if (currentRequirement.startsWith(">=")) {
    return `${currentRequirement.slice(0, 2)}${newVersion}`;
  }
  return newVersion;
}

/** For version that are prefixed with `workspace:` */
function updateWorkspaceStableDependencyVersion(currentRequirement: string, newVersion: string): string {
  const reqWithoutScheme = currentRequirement.slice(workspaceScheme.length);
  switch (reqWithoutScheme) {
    case "*":
    case "^":
    case "~":
    case ">=":
      return currentRequirement;
    default:
      return `${workspaceScheme}${updateStableDependencyVersion(reqWithoutScheme, newVersion)}`;
  }
}
