import pacote from "pacote";
import type { ChronusWorkspace } from "../index.js";
import type { Package, PackageBase } from "../workspace-manager/types.js";

export async function findUnpublishedWorkspacePackages(workspace: ChronusWorkspace): Promise<Package[]> {
  const data = await Promise.all(
    workspace.packages.map(async (pkg) => [pkg, await isPackageVersionPublished(pkg.name, pkg.version)] as const),
  );
  return data.filter(([, published]) => !published).map(([pkg]) => pkg);
}

/** Find unpublished packages from tarballs */
export async function findUnpublishedPackages(tarballs: string[]): Promise<(PackageBase & { tarballPath: string })[]> {
  const data = await Promise.all(
    tarballs.map(async (tarball) => {
      const manifest = await pacote.manifest(tarball);
      const packageBase: PackageBase & { tarballPath: string } = {
        name: manifest.name,
        version: manifest.version,
        manifest,
        tarballPath: tarball,
      };
      return [packageBase, await isPackageVersionPublished(manifest.name, manifest.version)] as const;
    }),
  );
  return data.filter(([, published]) => !published).map(([pkg]) => pkg);
}

async function isPackageVersionPublished(name: string, version: string): Promise<boolean> {
  try {
    const manifest = await pacote.manifest(`${name}@${version}`);
    console.error(manifest);

    return manifest.version === version;
  } catch (e: unknown) {
    console.error(e);
    if (isPacoteError(e) && ((e.code === "ETARGET" && e.type === "version") || e.code === "E404")) {
      return false;
    }
    throw e;
  }
}

function isPacoteError(e: unknown): e is PacoteError | HttpError {
  return typeof e === "object" && e !== null && "code" in e;
}

interface HttpError {
  readonly code: "E404";
}
interface PacoteError {
  readonly code: "ETARGET";
  readonly type: "version";
  readonly wanted: string;
  readonly versions: string[];
  readonly name: string;
  readonly distTags: Record<string, string>;
  readonly defaultTag: string;
}
