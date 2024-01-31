import type { VersionType } from "@changesets/types";
import type { WorkspaceType } from "../workspace-manager/types.js";

export interface ChronusUserConfig {
  readonly baseBranch: string;
  readonly workspaceType?: WorkspaceType | "auto";
  readonly versionPolicies?: VersionPolicy[];
}
export interface ChronusResolvedConfig extends ChronusUserConfig {
  readonly workspaceRoot: string;
}

export type VersionPolicyType = "lockstep" | "independent";
export type VersionPolicy = LockstepVersionPolicy | IndependentVersionPolicy;

export interface VersionPolicyBase {
  readonly name: string;
  readonly packages: string[];
}

export interface LockstepVersionPolicy extends VersionPolicyBase {
  readonly type: "lockstep";
  readonly step: VersionType;
}
export interface IndependentVersionPolicy extends VersionPolicyBase {
  readonly type: "independent";
}
