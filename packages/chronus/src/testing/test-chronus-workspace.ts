import { stringify } from "yaml";
import type { ChronusResolvedConfig, ChronusUserConfig } from "../config/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { VersionType } from "../types.js";
import type { Package, PackageJson } from "../workspace-manager/types.js";
import { createChronusWorkspace } from "../workspace/load.js";

/**
 * Fixed set of change kinds to use in testing
 */
export const TestingChangeKinds = {
  patch: { name: "patch", versionType: "patch", description: "Bug fixes", title: "Patch" },
  minor: { name: "minor", versionType: "minor", description: "Features", title: "Minor" },
  major: { name: "major", versionType: "major", description: "Breaking changes", title: "Major" },
} as const;

function mkPkg(name: string, manifest: Partial<PackageJson>): Package {
  const version = manifest.version ?? "1.0.0";
  return { name, relativePath: `packages/${name}`, version, dependencies: new Map(), ecosystem: "npm" };
}

const baseUserConfig: ChronusUserConfig = {
  baseBranch: "main",
  changeKinds: TestingChangeKinds,
};
const baseConfig: ChronusResolvedConfig = {
  workspaceRoot: "proj",
  ...baseUserConfig,
  changeKinds: TestingChangeKinds,
  resolvedPackages: [{ path: ".", type: "pnpm" }],
};

export interface TestChronusWorkspaceOptions {
  readonly packages: Record<string, Partial<PackageJson>>;
  readonly config?: Partial<ChronusResolvedConfig>;
}

/**
 * Create a mock chronus workspace.
 */
export function createTestChronusWorkspace(options: TestChronusWorkspaceOptions): ChronusWorkspace {
  const pkgs = Object.entries(options.packages).map(([name, manifest]) => mkPkg(name, manifest));
  return createChronusWorkspace(pkgs, options.config ? { ...baseConfig, ...options.config } : baseConfig);
}

export function mkChronusConfigFile(config: Partial<ChronusUserConfig> = {}): Partial<string> {
  const resolved = { ...baseUserConfig, ...config };
  return stringify(resolved);
}

export function mkPnpmWorkspaceFile(packagePaths: string[] = ["packages/*"]): string {
  return stringify({
    packages: packagePaths,
  });
}

export function mkChangeFile(pkg: string | string[], type: VersionType, message?: string): string {
  message ??= `This is a ${type} change for ${Array.isArray(pkg) ? pkg.join(", ") : pkg}.`;

  return [
    "---",
    `changeKind: ${type}`,
    "packages:",
    ...(Array.isArray(pkg) ? pkg.map((p) => `  - ${p}`) : [`  - ${pkg}`]),
    "---",
    "",
    message,
  ].join("\n");
}
