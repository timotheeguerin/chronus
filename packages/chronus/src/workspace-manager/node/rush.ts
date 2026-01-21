import { parse } from "yaml";
import { ChronusError, isDefined, isPathAccessible, joinPaths, lookup, type ChronusHost } from "../../utils/index.js";
import type { Package, Workspace, WorkspaceManager } from "../types.js";
import { createNodeWorkspaceManager } from "./node.js";
import { tryLoadNodePackage } from "./utils.js";

const workspaceFileName = "rush.json";

interface RushJson {
  readonly projects: RushProject[];
}

interface RushProject {
  readonly packageName: string;
  readonly projectFolder: string;
  readonly shouldPublish?: boolean;
}

export function createRushWorkspaceManager(): WorkspaceManager {
  return {
    ...createNodeWorkspaceManager(),
    type: "node:rush",
    aliases: ["rush"],
    async is(host: ChronusHost, dir: string): Promise<boolean> {
      return isPathAccessible(host, joinPaths(dir, workspaceFileName));
    },
    async load(host: ChronusHost, dir: string): Promise<Workspace> {
      const root = await lookup(dir, (current) => {
        const path = joinPaths(current, workspaceFileName);
        return isPathAccessible(host, path);
      });
      if (root === undefined) {
        throw new ChronusError(`Cannot find ${workspaceFileName} in a parent folder to ${dir}`);
      }
      const workspaceFilePath = joinPaths(root, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const config: RushJson = parse(file.content) as any;

      if (config.projects === undefined) {
        throw new ChronusError(`projects entry missing in ${workspaceFileName}`);
      }
      if (Array.isArray(config.projects) === false) {
        throw new ChronusError(`projects is not an array in ${workspaceFileName}`);
      }
      const packages: Package[] = (
        await Promise.all(config.projects.map((pattern) => tryLoadNodePackage(host, root, pattern.projectFolder)))
      ).filter(isDefined);
      return {
        type: "node:rush",
        path: root,
        packages,
      };
    },
  };
}
