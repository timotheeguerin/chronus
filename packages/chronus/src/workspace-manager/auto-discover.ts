import type { PackageOrWorkspaceConfig } from "../config/types.js";
import { ChronusError, resolvePath, type ChronusHost } from "../utils/index.js";
import { createNodeWorkspaceManager } from "./node/node.js";
import { createPnpmWorkspaceManager } from "./node/pnpm.js";
import { createRushWorkspaceManager } from "./node/rush.js";
import { CargoWorkspaceManager } from "./rust/cargo.js";
import type { Ecosystem, Package } from "./types.js";

const ecosystems = [
  createPnpmWorkspaceManager(),
  createRushWorkspaceManager(),
  createNodeWorkspaceManager(),
  new CargoWorkspaceManager(),
];
const ecosystemMap = new Map<string, Ecosystem>(
  ecosystems.flatMap((x) => {
    return [...(x.aliases ?? []), x.type].map((alias) => [alias, x], [x.type, x]);
  }),
);

async function findEcosystem(host: ChronusHost, root: string): Promise<Ecosystem> {
  for (const ecosystem of ecosystems) {
    if (await ecosystem.is(host, root)) {
      return ecosystem;
    }
  }

  throw new ChronusError("Couldn't figure out the workspace type.");
}

export async function getWorkspaceManager(host: ChronusHost, root: string, type?: string | "auto"): Promise<Ecosystem> {
  if (type === "auto" || type === undefined) {
    return findEcosystem(host, root);
  }
  return getEcosystem(type);
}

export async function loadPackages(
  host: ChronusHost,
  root: string,
  packageConfigs: PackageOrWorkspaceConfig[],
): Promise<Package[]> {
  const packages: Package[] = [];
  for (const pkgConfig of packageConfigs) {
    const found = await loadPackagesForConfig(host, root, pkgConfig);
    found.forEach((pkg) => packages.push(pkg));
  }
  return packages;
}

async function loadPackagesForConfig(
  host: ChronusHost,
  root: string,
  pkgConfig: PackageOrWorkspaceConfig,
): Promise<Package[]> {
  /** If we are defining a pattern then we load that differently */
  if (pkgConfig.path.includes("*")) {
    if (pkgConfig.type === undefined || pkgConfig.type === "auto") {
      throw new ChronusError("When using patterns in package paths, you must specify ecosystem type.");
    }
    const ecosystem = getEcosystem(pkgConfig.type);
    return ecosystem.loadPattern(host, root, pkgConfig.path);
  }
  const ecosystem = await getWorkspaceManager(host, resolvePath(root, pkgConfig.path), pkgConfig.type);
  return await ecosystem.load(host, root);
}

/** Get the ecosystem by name */
export function getEcosystem(type: string) {
  const ecosystem = ecosystemMap.get(type);
  if (!ecosystem) {
    throw new ChronusError(
      `Unknown ecosystem type: ${type}. Available types: ${ecosystems.map((e) => e.type).join(", ")}`,
    );
  }
  return ecosystem;
}
