import readChangeset from "@changesets/parse";
import type { ChronusUserConfig } from "../config/types.js";
import type { GitRepository } from "../source-control/git.js";
import type { ChronusHost } from "../utils/host.js";
import type { Package, Workspace } from "../workspace-manager/types.js";

export type ChangeArea = "committed" | "untrackedOrModified" | "staged";

export interface PackageStatus {
  readonly package: Package;
  readonly changed?: ChangeArea;
  readonly documented?: ChangeArea;
}
export interface AreaStatus {
  readonly filesChanged: string[];
  readonly packageChanged: Package[];
  readonly packagesDocumented: Package[];
}

export interface ChangeStatus {
  readonly packages: ReadonlyMap<string, PackageStatus>;
  readonly committed: AreaStatus;
  readonly untrackedOrModified: AreaStatus;
  readonly staged: AreaStatus;
  readonly all: AreaStatus;
}

export async function findChangeStatus(
  host: ChronusHost,
  sourceControl: GitRepository,
  workspace: Workspace,
  config: ChronusUserConfig,
): Promise<ChangeStatus> {
  const filesChanged = await sourceControl.listChangedFilesFromBase(config.baseBranch);
  const untrackedOrModifiedFiles = await sourceControl.listUntrackedOrModifiedFiles();
  const stagedFiles = await sourceControl.listUntrackedOrModifiedFiles();
  const publicPackages = workspace.packages.filter((x) => !x.manifest.private);

  const committed = await findAreaStatus(host, publicPackages, filesChanged);
  const untrackedOrModified = await findAreaStatus(host, publicPackages, untrackedOrModifiedFiles);
  const staged = await findAreaStatus(host, publicPackages, stagedFiles);
  const packages = new Map<string, PackageStatus>();
  function track(tracking: Package[], data: { readonly changed?: ChangeArea; readonly documented?: ChangeArea }) {
    for (const pkg of tracking) {
      const existing = packages.get(pkg.name);
      if (existing) {
        packages.set(pkg.name, { ...existing, ...data });
      } else {
        packages.set(pkg.name, { package: pkg, ...data });
      }
    }
  }

  track(untrackedOrModified.packageChanged, { changed: "untrackedOrModified" });
  track(untrackedOrModified.packagesDocumented, { documented: "untrackedOrModified" });
  track(staged.packageChanged, { changed: "staged" });
  track(staged.packagesDocumented, { documented: "staged" });
  track(committed.packageChanged, { changed: "committed" });
  track(committed.packagesDocumented, { documented: "committed" });
  track(publicPackages, {});

  return {
    packages,
    committed,
    untrackedOrModified,
    staged,
    all: {
      filesChanged: [
        ...new Set([...committed.filesChanged, ...untrackedOrModified.filesChanged, ...staged.filesChanged]),
      ],
      packageChanged: [
        ...new Set([...committed.packageChanged, ...untrackedOrModified.packageChanged, ...staged.packageChanged]),
      ],
      packagesDocumented: [
        ...new Set([
          ...committed.packagesDocumented,
          ...untrackedOrModified.packagesDocumented,
          ...staged.packagesDocumented,
        ]),
      ],
    },
  };
}

async function findAreaStatus(host: ChronusHost, packages: Package[], filesChanged: string[]): Promise<AreaStatus> {
  return {
    filesChanged,
    packageChanged: findPackageChanges(packages, filesChanged),
    packagesDocumented: await findAlreadyDocumentedChanges(host, packages, filesChanged),
  };
}

/** Find which packages changed from the file changed. */
function findPackageChanges(packages: Package[], fileChanged: string[]): Package[] {
  const packageChanged = new Set<Package>();

  for (const file of fileChanged) {
    const pkg = packages.find((x) => file.startsWith(x.relativePath + "/"));
    if (pkg) {
      packageChanged.add(pkg);
    }
  }
  return [...packageChanged];
}

/** Find which packages changed from the file changed. */
async function findAlreadyDocumentedChanges(
  host: ChronusHost,
  packages: Package[],
  fileChanged: string[],
): Promise<Package[]> {
  const packagesWithChangelog = new Set<Package>();

  for (const filename of fileChanged.filter((x) => x.startsWith(".changeset/") && x.endsWith(".md"))) {
    const file = await host.readFile(filename);
    const changeset = readChangeset(file.content);
    for (const release of changeset.releases) {
      const pkg = packages.find((x) => x.name === release.name);
      if (pkg) {
        packagesWithChangelog.add(pkg);
      }
    }
  }
  return [...packagesWithChangelog];
}
