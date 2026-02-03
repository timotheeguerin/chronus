import { parse } from "yaml";
import { ChronusError, isPathAccessible, joinPaths, type ChronusHost } from "../../utils/index.js";
import type { Ecosystem, Package } from "../types.js";
import { createNodeWorkspaceManager } from "./node.js";
import { findPackagesFromPattern, tryLoadNodePackage } from "./utils.js";

const workspaceFileName = "pnpm-workspace.yaml";
interface PnpmWorkspaceConfig {
  packages: string[];
}

export function createPnpmWorkspaceManager(): Ecosystem {
  return {
    ...createNodeWorkspaceManager(),
    type: "node:pnpm",
    aliases: ["pnpm"],
    async is(host: ChronusHost, dir: string): Promise<boolean> {
      return isPathAccessible(host, joinPaths(dir, workspaceFileName));
    },
    async loadPattern(host: ChronusHost, root: string, pattern: string): Promise<Package[]> {
      return findPackagesFromPattern(host, root, pattern, "node:pnpm");
    },
    async load(host: ChronusHost, dir: string): Promise<Package[]> {
      const workspaceFilePath = joinPaths(dir, workspaceFileName);

      let file;
      try {
        file = await host.readFile(workspaceFilePath);
      } catch {
        // No pnpm-workspace.yaml found, load as single package
        const pkg = await tryLoadNodePackage(host, dir, dir === dir ? "." : dir.slice(dir.length + 1), "node:pnpm");
        return pkg ? [pkg] : [];
      }
      const config: PnpmWorkspaceConfig = parse(file.content) as any;

      if (config.packages === undefined) {
        throw new ChronusError(`packages entry missing in ${workspaceFileName}`);
      }
      if (Array.isArray(config.packages) === false) {
        throw new ChronusError(`packages is not an array in ${workspaceFileName}`);
      }
      const packages: Package[] = await findPackagesFromPattern(host, dir, config.packages, "node:pnpm");
      return packages;
    },
  };
}
