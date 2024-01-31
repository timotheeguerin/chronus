import { load } from "js-yaml";
import { ChronusError, joinPaths, type ChronusHost } from "../utils/index.js";
import type { Package, PackageJson, Workspace, WorkspaceManager } from "./types.js";
import { findPackagesFromPattern } from "./utils.js";

const workspaceFileName = "package.json";

export function createNpmWorkspaceManager(host: ChronusHost): WorkspaceManager {
  return {
    async load(root: string): Promise<Workspace> {
      const workspaceFilePath = joinPaths(root, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const pkgJson: PackageJson = load(file.content) as any;

      if (pkgJson.workspaces === undefined) {
        throw new ChronusError(`workspaces entry missing in ${workspaceFileName}`);
      }
      if (Array.isArray(pkgJson.workspaces) === false) {
        throw new ChronusError(`workspaces is not an array in ${workspaceFileName}`);
      }
      const packages: Package[] = (
        await Promise.all(pkgJson.workspaces.map((pattern) => findPackagesFromPattern(host, root, pattern)))
      ).flat();
      return {
        path: root,
        packages,
      };
    },
  };
}
