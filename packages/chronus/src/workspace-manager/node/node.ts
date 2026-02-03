import { ChronusError, joinPaths, resolvePath, type ChronusHost, type Mutable } from "../../utils/index.js";
import type { Ecosystem, Package, PackageBase, PackageJson, PatchPackageVersion } from "../types.js";
import { findPackagesFromPattern, tryLoadNodePackage } from "./utils.js";

export interface NodePackage extends PackageBase {
  manifest: PackageJson;
}

const workspaceFileName = "package.json";

export function createNodeWorkspaceManager(): Ecosystem {
  return {
    type: "node:npm",
    aliases: ["npm", "node:npm"],
    async is(host: ChronusHost, dir: string): Promise<boolean> {
      try {
        const workspaceFilePath = joinPaths(dir, workspaceFileName);
        const file = await host.readFile(workspaceFilePath);
        const pkgJson: PackageJson = JSON.parse(file.content) as any;
        return pkgJson.workspaces !== undefined && Array.isArray(pkgJson.workspaces);
      } catch {
        return false;
      }
    },
    async loadPattern(host: ChronusHost, root: string, pattern: string): Promise<Package[]> {
      return findPackagesFromPattern(host, root, pattern, "node:npm");
    },
    async load(host: ChronusHost, root: string, relativePath: string): Promise<Package[]> {
      const workspaceFilePath = resolvePath(root, relativePath, workspaceFileName);

      const file = await host.readFile(workspaceFilePath);
      const pkgJson: PackageJson = JSON.parse(file.content) as any;

      // If no workspaces defined, load as a single package
      if (pkgJson.workspaces === undefined) {
        const pkg = await tryLoadNodePackage(host, root, relativePath, "node:npm");
        return pkg ? [pkg] : [];
      }
      if (Array.isArray(pkgJson.workspaces) === false) {
        throw new ChronusError(`workspaces is not an array in ${workspaceFileName}`);
      }
      // Prefix patterns with the dir relative to root
      const prefixedPatterns = pkgJson.workspaces.map((p) =>
        relativePath && relativePath !== "." ? joinPaths(relativePath, p) : p,
      );
      const packages: Package[] = (
        await Promise.all(prefixedPatterns.map((pattern) => findPackagesFromPattern(host, root, pattern, "node:npm")))
      ).flat();
      return packages;
    },
    async updateVersionsForPackage(
      host: ChronusHost,
      workspaceRoot: string,
      pkg: Package,
      request: PatchPackageVersion,
    ): Promise<void> {
      const newPkgJson = getNewPackageJson(pkg as any as NodePackage, request);

      await host.writeFile(
        resolvePath(workspaceRoot, pkg.relativePath, "package.json"),
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
