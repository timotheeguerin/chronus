import type { ChronusResolvedConfig, VersionPolicy } from "../config/types.js";
import type { Package, Workspace } from "../workspace-manager/types.js";

/**
 * How this package should be treated.
 * - `versioned` means it will be versioned.
 * - `standalone` means the package is not part of the workspace and will be versioned but not touch its dependencies
 * - `private` means dependencies will be bumped if needs be but this package will not be versioned.
 * - `ignored` means it will be completely ignored and assume those package do not belong in the workspace.
 */
export type ChronusPackageState = "versioned" | "standalone" | "private" | "ignored";

export interface ChronusPackage extends Package {
  readonly state: ChronusPackageState;
  readonly policy: VersionPolicy;
}

export interface ChronusWorkspace {
  readonly path: string;
  readonly workspace: Workspace;
  /** Packages involved in the chronus workspace */
  readonly packages: (ChronusPackage & { ignored: false })[];
  /** All packages in the workspace including ones that are not getting versioned. */
  readonly allPackages: ChronusPackage[];
  readonly config: ChronusResolvedConfig;

  readonly getPackage: (packageName: string) => ChronusPackage;
}
