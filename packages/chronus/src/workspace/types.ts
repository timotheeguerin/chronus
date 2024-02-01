import type { ChronusResolvedConfig } from "../config/types.js";
import type { Package, Workspace } from "../workspace-manager/types.js";

export interface ChronusWorkspace {
  readonly path: string;
  readonly workspace: Workspace;
  /** Packages involved in the chronus workspace */
  readonly packages: Package[];
  /** All packages in the workspace including ones that are not getting versioned. */
  readonly allPackages: Package[];
  readonly config: ChronusResolvedConfig;
}
