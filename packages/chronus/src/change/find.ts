import type { GitRepository } from "../source-control/git.js";
import type { ChronusHost } from "../utils/host.js";
import type { Package, Workspace } from "../workspace-manager/types.js";
import readChangeset from "@changesets/parse";

export interface AreaStatus {
  readonly filesChanged: string[];
  readonly packageChanged: Package[];
  readonly packagesDocumented: Package[];
}

export interface ChangeStatus {
  readonly committed: AreaStatus;
  readonly untrackedOrModified: AreaStatus;
  readonly staged: AreaStatus;
  readonly all: AreaStatus;
}

export async function findChangeStatus(
  host: ChronusHost,
  sourceControl: GitRepository,
  workspace: Workspace,
): Promise<ChangeStatus> {
  const filesChanged = await sourceControl.listChangedFilesFromBase();
  const untrackedOrModifiedFiles = await sourceControl.listUntrackedOrModifiedFiles();
  const stagedFiles = await sourceControl.listUntrackedOrModifiedFiles();
  const publicPackages = workspace.packages.filter((x) => !x.manifest.private);
  const packageMap = new Map<string, Package>();
  for (const pkg of publicPackages) {
    packageMap.set(pkg.name, pkg);
  }

  const committed = await findAreaStatus(host, publicPackages, filesChanged);
  const untrackedOrModified = await findAreaStatus(host, publicPackages, untrackedOrModifiedFiles);
  const staged = await findAreaStatus(host, publicPackages, stagedFiles);
  return {
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
