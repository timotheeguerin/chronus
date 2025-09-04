import { parse } from "yaml";
import { ChronusError, joinPaths, resolvePath, type ChronusHost, type Mutable } from "../../utils/index.js";
import type { Package, PackageBase, PackageJson, PatchPackageVersion, Workspace, WorkspaceManager } from "../types.js";
import { findPackagesFromPattern } from "./utils.js";

export interface NodePackage extends PackageBase {
  manifest: PackageJson;
}

const workspaceFileName = "package.json";

export function createNodeWorkspaceManager(): WorkspaceManager {
  return {
    type: "node",
    aliases: ["npm", "node:npm"],
    async is(host: ChronusHost, dir: string): Promise<boolean> {
      try {
        const workspaceFilePath = joinPaths(dir, workspaceFileName);
        const file = await host.readFile(workspaceFilePath);
        const pkgJson: PackageJson = parse(file.content) as any;
        return pkgJson.workspaces !== undefined && Array.isArray(pkgJson.workspaces);
      } catch {
        return false;
      }
    },
    async load(host: ChronusHost, root: string): Promise<Workspace> {
      const workspaceFilePath = joinPaths(root, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const pkgJson: PackageJson = parse(file.content) as any;

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
        type: "npm",
        path: root,
        packages,
      };
    },
    async updateVersionsForPackage(
      host: ChronusHost,
      workspace: Workspace,
      pkg: Package,
      request: PatchPackageVersion,
    ): Promise<void> {
      const newPkgJson = getNewPackageJson(pkg as any as NodePackage, request);

      await host.writeFile(
        resolvePath(workspace.path, pkg.relativePath, "package.json"),
        JSON.stringify(newPkgJson, null, 2) + "\n",
      );
    },
  };
}

export interface VersionAction {
  readonly newVersion: string;
}

function getNewPackageJson(pkg: NodePackage, request: PatchPackageVersion): PackageJson {
  const currentPkgJson: Mutable<PackageJson> = JSON.parse(JSON.stringify(pkg.manifest));
  if (request.newVersion) {
    currentPkgJson.version = request.newVersion;
  }

  for (const depType of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const depObj = currentPkgJson[depType];
    if (depObj) {
      for (const dep of Object.keys(depObj)) {
        const depAction = request.dependenciesVersions[dep];
        if (depAction) {
          depObj[dep] = depAction;
        }
      }
    }
  }

  return currentPkgJson;
}
