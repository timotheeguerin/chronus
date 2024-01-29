import type { VersionType } from "@changesets/types";

export interface ChronusConfig {
  baseBranch: string;
  versionPolicies?: VersionPolicy[];
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
