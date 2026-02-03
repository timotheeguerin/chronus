import { isPathAccessible } from "../../utils/fs-utils.js";
import type { ChronusHost } from "../../utils/host.js";
import { isDefined, resolvePath } from "../../utils/index.js";
import type { Package, PackageDependencySpec, PackageJson } from "../types.js";
import type { NodePackage } from "./node.js";

export async function findPackagesFromPattern(
  host: ChronusHost,
  root: string,
  pattern: string | string[],
  ecosystem: string,
): Promise<Package[]> {
  const packageRoots = await host.glob(pattern, {
    baseDir: root,
    onlyDirectories: true,
    ignore: ["**/node_modules"],
  });

  const packages = await Promise.all(packageRoots.map((x) => tryLoadNodePackage(host, root, x, ecosystem)));
  return packages.filter(isDefined);
}

export async function tryLoadNodePackage(
  host: ChronusHost,
  root: string,
  relativePath: string,
  ecosystem: string,
): Promise<Package | undefined> {
  const pkgJsonPath = resolvePath(root, relativePath, "package.json");
  if (await isPathAccessible(host, pkgJsonPath)) {
    const file = await host.readFile(pkgJsonPath);
    const pkgJson = JSON.parse(file.content);
    return {
      ...createPackageFromPackageJson(pkgJson, ecosystem),
      relativePath,
    } as Package;
  } else {
    return undefined;
  }
}

export function createPackageFromPackageJson(pkgJson: PackageJson, ecosystem: string): NodePackage {
  return {
    ecosystem,
    name: pkgJson.name!,
    version: pkgJson.version!,
    private: pkgJson.private,
    dependencies: new Map([
      ...mapDependencies(pkgJson, "dependencies", "prod"),
      ...mapDependencies(pkgJson, "peerDependencies", "prod"),
      ...mapDependencies(pkgJson, "optionalDependencies", "prod"),
      ...mapDependencies(pkgJson, "devDependencies", "dev"),
    ]),
    manifest: pkgJson,
  };
}
function mapDependencies(pkgJson: any, field: string, kind: "prod" | "dev"): [string, PackageDependencySpec][] {
  return Object.entries(pkgJson[field] || {}).map(([name, version]) => [
    name,
    {
      name,
      version,
      kind,
    } as PackageDependencySpec,
  ]);
}
