import type { ChronusResolvedConfig } from "../config/types.js";
import type { Package, Workspace } from "../workspace-manager/types.js";

export interface ChronusPackage extends Package {
  /** If that package should ignore versioning. */
  readonly ignored: boolean;
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
