import micromatch from "micromatch";
import { resolveConfig } from "../config/index.js";
import type { ChronusResolvedConfig } from "../config/types.js";
import { ChronusError } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { loadWorkspace } from "../workspace-manager/auto-discover.js";
import type { Package, Workspace } from "../workspace-manager/types.js";
import type { ChronusPackage, ChronusWorkspace } from "./types.js";

function isPackageIgnored(config: ChronusResolvedConfig, pkg: Package): boolean {
  return Boolean(pkg.manifest.private || (config.ignore && config.ignore.some((x) => micromatch.isMatch(pkg.name, x))));
}

export async function loadChronusWorkspace(host: ChronusHost, dir: string): Promise<ChronusWorkspace> {
  const config = await resolveConfig(host, dir);
  const workspace = await loadWorkspace(host, config.workspaceRoot, config.workspaceType);
  return createChronusWorkspace(workspace, config);
}

export function createChronusWorkspace(workspace: Workspace, config: ChronusResolvedConfig): ChronusWorkspace {
  const chronusPackages = workspace.packages.map((pkg): ChronusPackage => {
    return { ...pkg, ignored: isPackageIgnored(config, pkg) };
  });
  const map = new Map<string, ChronusPackage>(chronusPackages.map((pkg) => [pkg.name, pkg]));
  return {
    path: config.workspaceRoot,
    workspace,
    packages: chronusPackages.filter((pkg): pkg is ChronusPackage & { ignored: false } => !pkg.ignored),
    allPackages: chronusPackages,
    config,
    getPackage: (packageName: string) => {
      const value = map.get(packageName);
      if (value === undefined) {
        throw new ChronusError(`Could not find package ${packageName}`);
      }
      return value;
    },
  };
}
