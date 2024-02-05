import type { VersionType } from "@changesets/types";
import type { WorkspaceType } from "../workspace-manager/types.js";

export interface ChronusUserConfig {
  readonly baseBranch: string;
  readonly workspaceType?: WorkspaceType | "auto";
  readonly versionPolicies?: VersionPolicy[];
  /** Projects or pattern of package name to ignore. By default all private: true packages are ignored. */
  readonly ignore?: string[];

  /**
   * Provide a different set of options for describing changes.
   * For example breaking, deprecation, feature, fix, etc.
   */
  readonly changeKinds: Record<string, ChangeKindUserConfig>;
}

export interface ChangeKindUserConfig {
  /** What should this change do regarding to versioning. */
  readonly versionType: VersionType;
  /** Optional friendly title to display in the changelogs after. */
  readonly title?: string;
  /** Optional detail about what this kind is. */
  readonly description?: string;
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
