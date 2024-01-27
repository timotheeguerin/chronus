import { isDefined, isPathAccessible, joinPaths, KronosHost, lookup } from "../utils/index.js";
import { Package, Workspace, WorkspaceManager } from "./types.js";
import { load } from "js-yaml";
import { globby } from "globby";
interface PnpmWorkspaceConfig {
  packages: string[];
}

export function createPnpmWorkspaceManager(host: KronosHost): WorkspaceManager {
  return {
    async load(dir: string): Promise<Workspace> {
      const root = await lookup(dir, (current) => {
        const path = joinPaths(current, "pnpm-workspace.yaml");
        return isPathAccessible(path);
      });
      if (root === undefined) {
        throw new Error(`Cannot find pnpm-workspace.yaml in a parent folder to ${dir}`);
      }
      const workspaceFilePath = joinPaths(root, "pnpm=workspace.yaml");

      const file = await host.readFile(workspaceFilePath);
      const config: PnpmWorkspaceConfig = load(file.content) as any;

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
  const packageRoots = await globby(pattern, {
    cwd: root,
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadNodePackage(host, x)));
  return packages.filter(isDefined);
}

async function tryLoadNodePackage(host: KronosHost, path: string): Promise<Package | undefined> {
  const pkgJsonPath = joinPaths(path, "package.json");
  if (await isPathAccessible(pkgJsonPath)) {
    const file = await host.readFile(pkgJsonPath);
    const pkgJson = JSON.parse(file.content);
    return {
      name: pkgJson.name,
      version: pkgJson.version,
      relativePath: "",
    };
  } else {
    return undefined;
  }
}
