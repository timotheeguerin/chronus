import { parse } from "yaml";
import {
  ChronusError,
  isDefined,
  isPathAccessible,
  joinPaths,
  lookup,
  resolvePath,
  type ChronusHost,
} from "../../utils/index.js";
import type { Ecosystem, Package } from "../types.js";
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

export function createRushWorkspaceManager(): Ecosystem {
  return {
    ...createNodeWorkspaceManager(),
    type: "node:rush",
    aliases: ["rush"],
    async is(host: ChronusHost, dir: string): Promise<boolean> {
      return isPathAccessible(host, joinPaths(dir, workspaceFileName));
    },
    async load(host: ChronusHost, root: string, relativePath: string): Promise<Package[]> {
      const absoluteDir = resolvePath(root, relativePath);
      const rushRoot = await lookup(absoluteDir, (current) => {
        const path = joinPaths(current, workspaceFileName);
        return isPathAccessible(host, path);
      });
      if (rushRoot === undefined) {
        throw new ChronusError(`Cannot find ${workspaceFileName} in a parent folder to ${absoluteDir}`);
      }
      const rushRelativeToRoot = rushRoot === root ? "" : rushRoot.slice(root.length + 1);
      const workspaceFilePath = joinPaths(rushRoot, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const config: RushJson = parse(file.content) as any;

      if (config.projects === undefined) {
        throw new ChronusError(`projects entry missing in ${workspaceFileName}`);
      }
      if (Array.isArray(config.projects) === false) {
        throw new ChronusError(`projects is not an array in ${workspaceFileName}`);
      }
      const packages: Package[] = (
        await Promise.all(
          config.projects.map((pattern) => {
            const relativePath = rushRelativeToRoot
              ? joinPaths(rushRelativeToRoot, pattern.projectFolder)
              : pattern.projectFolder;
            return tryLoadNodePackage(host, root, relativePath, "node:rush");
          }),
        )
      ).filter(isDefined);
      return packages;
    },
  };
}
