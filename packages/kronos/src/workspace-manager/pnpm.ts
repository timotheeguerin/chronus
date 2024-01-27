import { globby } from "globby";
import {
  isDefined,
  isPathAccessible,
  joinPaths,
  lookup,
  type KronosHost,
  KronosError,
  resolvePath,
} from "../utils/index.js";
import type { Package, Workspace, WorkspaceManager } from "./types.js";
import { load } from "js-yaml";

const workspaceFileName = "pnpm-workspace.yaml";
interface PnpmWorkspaceConfig {
  packages: string[];
}

export function createPnpmWorkspaceManager(host: KronosHost): WorkspaceManager {
  return {
    async load(dir: string): Promise<Workspace> {
      const root = await lookup(dir, (current) => {
        const path = joinPaths(current, workspaceFileName);
        return isPathAccessible(host, path);
      });
      if (root === undefined) {
        throw new Error(`Cannot find pnpm-workspace.yaml in a parent folder to ${dir}`);
      }
      const workspaceFilePath = joinPaths(root, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const config: PnpmWorkspaceConfig = load(file.content) as any;
      
      if (config.packages === undefined) {
        throw new KronosError("packages entry missing in pnpm-workspace.yaml");
      }
      if (Array.isArray(config.packages) === false) {
        throw new KronosError("packages is not an array in pnpm-workspace.yaml");
      }
      const packages: Package[] = (
        await Promise.all(config.packages.map((pattern) => findPackagesFromPattern(host, root, pattern)))
      ).flat();
      return {
        path: root,
        packages,
      };
    },
  };
}

export async function findPackagesFromPattern(host: KronosHost, root: string, pattern: string): Promise<Package[]> {
  const packageRoots = await host.glob(pattern, {
    baseDir: root,
    onlyDirectories: true,
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadNodePackage(host, root, x)));
  return packages.filter(isDefined);
}

async function tryLoadNodePackage(host: KronosHost, root: string, relativePath: string): Promise<Package | undefined> {
  const pkgJsonPath = resolvePath(root, relativePath, "package.json");
  if (await isPathAccessible(host, pkgJsonPath)) {
    const file = await host.readFile(pkgJsonPath);
    const pkgJson = JSON.parse(file.content);
    return {
      name: pkgJson.name,
      version: pkgJson.version,
      relativePath: relativePath,
      manifest: pkgJson,
    };
  } else {
    return undefined;
  }
}
