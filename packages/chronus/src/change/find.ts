import micromatch from "micromatch";
import type { GitRepository } from "../source-control/git.js";
import type { ChronusHost } from "../utils/host.js";
import type { Package } from "../workspace-manager/types.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { changesRelativeDir } from "./common.js";
import { readChangeDescriptions } from "./read.js";
import type { ChangeDescription } from "./types.js";

export interface FindChangeStatusOptions {
  /** Compare from this branch instead of the configured base  */
  readonly since?: string;
}
export type ChangeArea = "committed" | "untrackedOrModified" | "staged";

export interface PackageStatus {
  readonly package: Package;
  readonly changed?: ChangeArea;
  readonly documented?: ChangeArea;
}
export interface AreaStatus {
  readonly changeDescriptions: ChangeDescription[];
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

/** Find what package have currently been changed */
export async function findChangeStatus(
  host: ChronusHost,
  sourceControl: GitRepository,
  workspace: ChronusWorkspace,
  options?: FindChangeStatusOptions,
): Promise<ChangeStatus> {
  const filesChanged = await sourceControl.listChangedFilesFromBase(
    options?.since ?? workspace.config.baseBranch,
    workspace.config.baseRemote,
  );
  const untrackedOrModifiedFiles = await sourceControl.listUntrackedOrModifiedFiles();
  const stagedFiles = await sourceControl.listUntrackedOrModifiedFiles();
  const publicPackages = workspace.packages;

  const allChangeDescriptions = await readChangeDescriptions(host, workspace);
  const committed = await findAreaStatus(workspace, allChangeDescriptions, filesChanged);
  const untrackedOrModified = await findAreaStatus(workspace, allChangeDescriptions, untrackedOrModifiedFiles);
  const staged = await findAreaStatus(workspace, allChangeDescriptions, stagedFiles);
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
      changeDescriptions: [
        ...new Set([
          ...committed.changeDescriptions,
          ...untrackedOrModified.changeDescriptions,
          ...staged.changeDescriptions,
        ]),
      ],
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

async function findAreaStatus(
  workspace: ChronusWorkspace,
  allChangeDescriptions: ChangeDescription[],
  filesChanged: string[],
): Promise<AreaStatus> {
  const fileChangedThatMatter = workspace.config.changedFiles
    ? micromatch(filesChanged, workspace.config.changedFiles)
    : filesChanged;

  const changeDescriptions = allChangeDescriptions.filter((x) =>
    fileChangedThatMatter.includes(changesRelativeDir + "/" + x.id + ".md"),
  );
  return {
    filesChanged: fileChangedThatMatter,
    changeDescriptions,
    packageChanged: findPackageChanges(workspace.packages, fileChangedThatMatter),
    packagesDocumented: await findAlreadyDocumentedChanges(workspace, changeDescriptions),
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
  workspace: ChronusWorkspace,
  changeDescriptionsModified: ChangeDescription[],
): Promise<Package[]> {
  const packagesWithChangelog = new Set<Package>();
  for (const changeDescription of changeDescriptionsModified) {
    for (const pkgName of changeDescription.packages) {
      const pkg = workspace.packages.find((x) => x.name === pkgName);
      if (pkg) {
        packagesWithChangelog.add(pkg);
      }
    }
  }
  return [...packagesWithChangelog];
}
