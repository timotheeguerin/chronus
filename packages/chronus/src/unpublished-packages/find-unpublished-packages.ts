import type { ChronusWorkspace } from "../index.js";
import { fetchPackageManifest, RegistryError } from "../utils/npm-registry.js";
import { readPackageManifestFromTarball } from "../utils/read-tarball-manifest.js";
import type { Package, PackageId } from "../workspace-manager/types.js";

export async function findUnpublishedWorkspacePackages(workspace: ChronusWorkspace): Promise<Package[]> {
  const data = await Promise.all(
    workspace.packages.map(async (pkg) => [pkg, await isPackageVersionPublished(pkg.name, pkg.version)] as const),
  );
  return data.filter(([, published]) => !published).map(([pkg]) => pkg);
}

/** Find unpublished packages from tarballs */
export async function findUnpublishedPackages(tarballs: string[]): Promise<(PackageId & { tarballPath: string })[]> {
  const data = await Promise.all(
    tarballs.map(async (tarball) => {
      const manifest = await readPackageManifestFromTarball(tarball);
      const packageBase: PackageId & { tarballPath: string } = {
        name: manifest.name,
        version: manifest.version,
        tarballPath: tarball,
      };
      return [packageBase, await isPackageVersionPublished(manifest.name, manifest.version)] as const;
    }),
  );
  return data.filter(([, published]) => !published).map(([pkg]) => pkg);
}

async function isPackageVersionPublished(name: string, version: string): Promise<boolean> {
  try {
    const manifest = await fetchPackageManifest(`${name}@${version}`);
    return manifest.version === version;
  } catch (e: unknown) {
    if (e instanceof RegistryError && (e.code === "E404" || (e.code === "ETARGET" && e.type === "version"))) {
      return false;
    }
    throw e;
  }
}
