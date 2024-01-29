import { load } from "js-yaml";
import { ChronusError, isPathAccessible, joinPaths, lookup, type ChronusHost } from "../utils/index.js";
import type { Package, Workspace, WorkspaceManager } from "./types.js";
import { findPackagesFromPattern } from "./utils.js";

const workspaceFileName = "pnpm-workspace.yaml";
interface PnpmWorkspaceConfig {
  packages: string[];
}

export function createPnpmWorkspaceManager(host: ChronusHost): WorkspaceManager {
  return {
    async load(dir: string): Promise<Workspace> {
      const root = await lookup(dir, (current) => {
        const path = joinPaths(current, workspaceFileName);
        return isPathAccessible(host, path);
      });
      if (root === undefined) {
        throw new ChronusError(`Cannot find ${workspaceFileName} in a parent folder to ${dir}`);
      }
      const workspaceFilePath = joinPaths(root, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const config: PnpmWorkspaceConfig = load(file.content) as any;

      if (config.packages === undefined) {
        throw new ChronusError(`packages entry missing in ${workspaceFileName}`);
      }
      if (Array.isArray(config.packages) === false) {
        throw new ChronusError(`packages is not an array in ${workspaceFileName}`);
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
