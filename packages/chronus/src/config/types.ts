import type { VersionType } from "../types.js";
import type { YamlFile } from "../yaml/types.js";

export interface ChronusUserConfig {
  readonly source?: YamlFile;
  /** Base branch that should be used to compare */
  readonly baseBranch: string;
  /** Base remote to use to compare against. Set this to the upstream remote to support forks that don't point their main branch to the upstream remote */
  readonly baseRemote?: string;

  /**
   * Explicit list of packages/workspace to include
   * @example ["packages/*", "libs/*", "tools/my-tool"]
   * @example [{path: "pnpm-workspace.yaml", type: "pnpm"}, "others/*"]
   */
  readonly packages?: (string | PackageOrWorkspaceConfig)[];
  /** Workspace type: pnpm, npm, yarn or auto */
  readonly workspaceType?: string | "auto";
  /**
   * Additional packages that do not belong the workspace
   * @deprecated use `packages` instead
   */
  readonly additionalPackages?: string[];
  /** Versioning policies to apply to packages */
  readonly versionPolicies?: VersionPolicy[];
  /** Projects or pattern of package name to ignore. By default all private: true packages are ignored. */
  readonly ignore?: string[];

  /**
   * Provide a different set of options for describing changes.
   * For example breaking, deprecation, feature, fix, etc.
   */
  readonly changeKinds?: Record<string, ChangeKindUserConfig>;

  /** Changelog configuration. Either the name of the changelog generator or a tuple with the name and its optins.   */
  readonly changelog?: string | [string, Record<string, unknown>];

  /**
   * Pattern of files that should trigger change detection. By default any files under an included package will trigger it.
   * Using `!` will exclude that pattern.
   */
  readonly changedFiles?: readonly string[];
}

export type PackageOrWorkspaceConfig = { path: string; type?: string };

export interface ChangeKindUserConfig {
  /** What should this change do regarding to versioning. */
  readonly versionType: VersionType;
  /** Optional friendly title to display in the changelogs after. */
  readonly title?: string;
  /** Optional detail about what this kind is. */
  readonly description?: string;
}

export interface ChangeKindResolvedConfig extends ChangeKindUserConfig {
  readonly name: string;
}

export interface ChronusResolvedConfig extends ChronusUserConfig {
  readonly workspaceRoot: string;
  readonly changeKinds: Record<string, ChangeKindResolvedConfig>;
  /** Normalized list of package sources (from packages, workspaceType, and additionalPackages) */
  readonly resolvedPackages: PackageOrWorkspaceConfig[];
}

export type VersionPolicyType = "lockstep" | "independent";
export type VersionPolicy = LockstepVersionPolicy | IndependentVersionPolicy;

export interface VersionPolicyBase {
  readonly name: string;
  readonly packages: string[];
}

export interface LockstepVersionPolicy extends VersionPolicyBase {
  readonly type: "lockstep";
  readonly step: Omit<VersionType, "none">;
}
export interface IndependentVersionPolicy extends VersionPolicyBase {
  readonly type: "independent";
}
