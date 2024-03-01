import pc from "picocolors";
import { publishPackage } from "../../publish/publish-package.js";
import type { Reporter } from "../../reporters/index.js";
import { findUnpublishedPackages, findUnpublishedWorkspacePackages } from "../../unpublished-packages/index.js";
import { ChronusError, NodeChronusHost, prettyBytes, resolvePath, type ChronusHost } from "../../utils/index.js";
import { loadChronusWorkspace } from "../../workspace/index.js";

export interface PublishOptions {
  readonly reporter: Reporter;
  readonly pattern: string;
  readonly otp?: string;
  readonly access?: string;
  readonly registry?: string;
}

export async function publish({ reporter, pattern, ...others }: PublishOptions) {
  const host = NodeChronusHost;
  const filesOrFolders = await host.glob(pattern);
  if (filesOrFolders.length === 0) {
    throw new ChronusError(`Pattern ${pattern} match not files or workspaces.`);
  }
  if (filesOrFolders.length > 1 || filesOrFolders[0].endsWith(".tgz")) {
    const tgzFiles = filesOrFolders.filter((file) => file.endsWith(".tgz"));
    if (tgzFiles.length !== filesOrFolders.length) {
      throw new ChronusError(`Can only bulk publish tarballs or a single workspace at a time.`);
    }
    await publishTarballs(host, tgzFiles, { reporter, ...others });
  } else {
    await publishWorkspacePackages(host, filesOrFolders[0], { reporter, ...others });
  }
}

async function publishWorkspacePackages(
  host: ChronusHost,
  workspaceDir: string,
  { reporter, ...others }: Omit<PublishOptions, "pattern">,
) {
  const workspace = await loadChronusWorkspace(host, workspaceDir);
  const packageToPublish = await findUnpublishedWorkspacePackages(workspace);
  if (packageToPublish.length === 0) {
    reporter.log(pc.green("All packages are already published."));
  }
  for (const pkg of packageToPublish) {
    await reporter.task(`${pc.yellow(pkg.name)} publishing`, async (task) => {
      const result = await publishPackage(pkg, resolvePath(workspace.path, pkg.relativePath), others);
      if (result.published) {
        task.update(
          `${pc.yellow(pkg.name)} published at version ${pc.cyan(pkg.version)} (${pc.magenta(prettyBytes(result.size))})`,
        );
        return "success";
      } else {
        return "failure";
      }
    });
  }
}

async function publishTarballs(
  host: ChronusHost,
  tarballs: string[],
  { reporter, ...others }: Omit<PublishOptions, "pattern">,
) {
  const unpublished = await findUnpublishedPackages(tarballs);
  if (unpublished.length === 0) {
    reporter.log(pc.green("All tarballs are already published."));
  }
  for (const pkg of unpublished) {
    await reporter.task(`${pc.yellow(pkg.name)} publishing`, async (task) => {
      const result = await publishPackage(pkg, pkg.tarballPath, others);
      if (result.published) {
        task.update(
          `${pc.yellow(pkg.name)} published at version ${pc.cyan(pkg.version)} (${pc.magenta(prettyBytes(result.size))})`,
        );
        return "success";
      } else {
        return "failure";
      }
    });
  }
}
