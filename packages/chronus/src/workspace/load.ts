import micromatch from "micromatch";
import { resolveConfig } from "../config/parse.js";
import type { ChronusResolvedConfig } from "../config/types.js";
import type { ChronusHost } from "../utils/host.js";
import { loadWorkspace } from "../workspace-manager/auto-discover.js";
import type { Package } from "../workspace-manager/types.js";
import type { ChronusWorkspace } from "./types.js";

function isPackageIgnored(config: ChronusResolvedConfig, pkg: Package) {
  return pkg.manifest.private || (config.ignore && config.ignore.some((x) => micromatch.isMatch(pkg.name, x)));
}

export async function loadChronusWorkspace(host: ChronusHost, dir: string): Promise<ChronusWorkspace> {
  const config = await resolveConfig(host, dir);
  const workspace = await loadWorkspace(host, config.workspaceRoot, config.workspaceType);

  return {
    path: config.workspaceRoot,
    workspace,
    config,
    packages: workspace.packages.filter((x) => !isPackageIgnored(config, x)),
    allPackages: workspace.packages,
  };
}
