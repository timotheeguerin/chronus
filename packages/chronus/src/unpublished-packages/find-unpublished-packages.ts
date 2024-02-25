import pacote from "pacote";
import type { ChronusWorkspace } from "../index.js";
import type { Package } from "../workspace-manager/types.js";

export async function findUnpublishedPackages(workspace: ChronusWorkspace): Promise<Package[]> {
  const data = await Promise.all(
    workspace.packages.map(async (pkg) => [pkg, await isPackageVersionPublished(pkg)] as const),
  );
  return data.filter(([, published]) => !published).map(([pkg]) => pkg);
}

async function isPackageVersionPublished(pkg: Package): Promise<boolean> {
  try {
    const manifest = await pacote.manifest(`${pkg.name}@${pkg.version}`);
    return manifest.version === pkg.version;
  } catch (e: unknown) {
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
