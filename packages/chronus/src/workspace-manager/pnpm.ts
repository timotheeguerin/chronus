import { parse } from "yaml";
import { ChronusError, isPathAccessible, joinPaths, type ChronusHost } from "../utils/index.js";
import type { Package, Workspace, WorkspaceManager } from "./types.js";
import { findPackagesFromPattern } from "./utils.js";

const workspaceFileName = "pnpm-workspace.yaml";
interface PnpmWorkspaceConfig {
  packages: string[];
}

export function createPnpmWorkspaceManager(host: ChronusHost): WorkspaceManager {
  return {
    type: "pnpm",
    async is(dir: string): Promise<boolean> {
      return isPathAccessible(host, joinPaths(dir, workspaceFileName));
    },
    async load(root: string): Promise<Workspace> {
      const workspaceFilePath = joinPaths(root, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const config: PnpmWorkspaceConfig = parse(file.content) as any;

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
        type: "pnpm",
        path: root,
        packages,
      };
    },
  };
}
