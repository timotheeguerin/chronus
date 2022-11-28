import { readFile } from "node:fs/promises";
import { isDefined, isPathAccessible, joinPaths, lookup } from "../utils/index.js";
import { Package, Workspace, WorkspaceManager } from "./types.js";
import { load } from "js-yaml";
import { globby } from "globby";
interface PnpmWorkspaceConfig {
  packages: string[];
}

export const PnpmPackageManager: WorkspaceManager = {
  async load(dir: string): Promise<Workspace> {
    const root = await lookup(dir, (current) => {
      const path = joinPaths(current, "pnpm-workspace.yaml");
      return isPathAccessible(path);
    });
    if (root === undefined) {
      throw new Error(`Cannot find pnpm-workspace.yaml in a parent folder to ${dir}`);
    }
    const workspaceFilePath = joinPaths(root, "pnpm=workspace.yaml");

    const content = await readFile(workspaceFilePath);
    const config: PnpmWorkspaceConfig = load(content.toString()) as any;

    const packages: Package[] = (
      await Promise.all(config.packages.map((pattern) => findPackagesFromPattern(root, pattern)))
    ).flat();
    return {
      path: root,
      packages,
    };
  },
};

export async function findPackagesFromPattern(root: string, pattern: string): Promise<Package[]> {
  const packageRoots = await globby(pattern, {
    cwd: root,
  });

  const packages = await Promise.all(packageRoots.map(tryLoadNodePackage));
  return packages.filter(isDefined);
}

async function tryLoadNodePackage(path: string): Promise<Package | undefined> {
  const pkgJsonPath = joinPaths(path, "package.json");
  if (await isPathAccessible(pkgJsonPath)) {
    const content = await readFile(pkgJsonPath);
    const pkgJson = JSON.parse(content.toString());
    return {
      name: pkgJson.name,
      version: pkgJson.version,
      relativePath: "",
    };
  } else {
    return undefined;
  }
}
