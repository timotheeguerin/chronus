import type { ChronusResolvedConfig } from "../config/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { Package, PackageJson, Workspace } from "../workspace-manager/types.js";
import { createChronusWorkspace } from "../workspace/load.js";

/**
 * Fixed set of change kinds to use in testing
 */
export const TestingChangeKinds = {
  major: { name: "major", versionType: "major", description: "Breaking changes", title: "Major" },
  minor: { name: "minor", versionType: "minor", description: "Features", title: "Minor" },
  patch: { name: "patch", versionType: "patch", description: "Bug fixes", title: "Patch" },
} as const;

function mkWorkspace(packages: Package[]): Workspace {
  return { type: "pnpm", path: "/", packages };
}
function mkPkg(name: string, manifest: Partial<PackageJson>): Package {
  const version = manifest.version ?? "1.0.0";
  return { name, manifest: { ...manifest, version }, relativePath: `packages/${name}`, version };
}

const baseConfig: ChronusResolvedConfig = {
  workspaceRoot: "proj",
  baseBranch: "main",
  changeKinds: TestingChangeKinds,
};

export interface TestChronusWorkspaceOptions {
  readonly packages: Record<string, Partial<PackageJson>>;
  readonly config?: ChronusResolvedConfig;
}

/**
 * Create a mock chronus workspace.
 */
export function createTestChronusWorkspace(options: TestChronusWorkspaceOptions): ChronusWorkspace {
  const pnpmWorkspace = mkWorkspace(Object.entries(options.packages).map(([name, manifest]) => mkPkg(name, manifest)));
  return createChronusWorkspace(pnpmWorkspace, options.config ?? baseConfig);
}
