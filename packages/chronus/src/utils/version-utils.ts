import { gt, parse } from "semver";
import type { LockstepVersionPolicy } from "../config/types.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { ChronusError } from "./errors.js";

export function resolveLatestVersion(workspace: ChronusWorkspace, packages: string[]): string {
  let latest = undefined;

  for (const name of packages) {
    const pkg = workspace.getPackage(name);
    if (latest === undefined || gt(pkg.version, latest)) {
      latest = pkg.version;
    }
  }

  if (latest === undefined) {
    throw new ChronusError("Cannot resolve latest version, there is not packages passed.");
  }
  return latest;
}

export function resolveCurrentLockStepVersion(workspace: ChronusWorkspace, policy: LockstepVersionPolicy): string {
  const latest = resolveLatestVersion(workspace, policy.packages);
  const parsed = parse(latest);
  if (parsed === null) {
    throw new ChronusError(`Cannot resolve Invalid version '${latest}'`);
  }
  const { major, minor, patch } = parsed;
  switch (policy.step) {
    case "patch":
      return `${major}.${minor}.${patch}`;
    case "minor":
      return `${major}.${minor}.0`;
    case "major":
      return `${major}.0.0`;
    default:
      throw new ChronusError(`Invalid step '${policy.step}'`);
  }
}
