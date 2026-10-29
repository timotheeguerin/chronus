import type { PackageOrWorkspaceConfig } from "../config/types.js";
import { ChronusError, isPathAccessible, lookup, resolvePath, type ChronusHost } from "../utils/index.js";
import { createNodeWorkspaceManager } from "./node/node.js";
import { createPnpmWorkspaceManager } from "./node/pnpm.js";
import { createRushWorkspaceManager } from "./node/rush.js";
import { PipWorkspaceManager } from "./python/pip.js";
import { CargoWorkspaceManager } from "./rust/cargo.js";
import type { Ecosystem, Package } from "./types.js";

const ecosystemDefinitions = [
  { ecosystem: createPnpmWorkspaceManager(), manifests: ["pnpm-workspace.yaml", "package.json"] },
  { ecosystem: createRushWorkspaceManager(), manifests: ["rush.json"], searchParents: true },
  { ecosystem: createNodeWorkspaceManager(), manifests: ["package.json"] },
  { ecosystem: new CargoWorkspaceManager(), manifests: ["Cargo.toml"] },
  { ecosystem: new PipWorkspaceManager(), manifests: ["pyproject.toml"] },
];
const ecosystems = ecosystemDefinitions.map(({ ecosystem }) => ecosystem);
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

  throw new ChronusError(`Cannot auto-discover ecosystem in ${root}. Please specify the ecosystem type explicitly.`);
}

export async function getWorkspaceManager(host: ChronusHost, root: string, type?: string): Promise<Ecosystem> {
  if (type === "auto" || type === undefined) {
    return findEcosystem(host, root);
  }
  return getEcosystem(type);
}

/** Check source-file presence without parsing, so malformed existing manifests still fail when loaded. */
export async function hasPackageManifest(host: ChronusHost, root: string, type: string): Promise<boolean> {
  const ecosystem = getEcosystem(type);
  for (const definition of ecosystemDefinitions) {
    if (definition.ecosystem !== ecosystem) continue;
    for (const manifest of definition.manifests) {
      const exists = (dir: string) => isPathAccessible(host, resolvePath(dir, manifest));
      if ("searchParents" in definition && definition.searchParents) {
        if ((await lookup(root, exists)) !== undefined) return true;
      } else if (await exists(root)) {
        return true;
      }
    }
  }
  return false;
}

export async function loadPackages(
  host: ChronusHost,
  root: string,
  packageConfigs: PackageOrWorkspaceConfig[],
): Promise<Package[]> {
  const packages: Package[] = [];
  for (const pkgConfig of packageConfigs) {
    const found = await loadPackagesForConfig(host, root, pkgConfig);
    for (const pkg of found) {
      packages.push(pkgConfig.standalone ? { ...pkg, standalone: true } : pkg);
    }
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
  return await ecosystem.load(host, root, pkgConfig.path);
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
