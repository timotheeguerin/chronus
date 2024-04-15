import pc from "picocolors";
import { publishPackage } from "../../publish/publish-package.js";
import type { PublishPackageResult, PublishSummary } from "../../publish/types.js";
import type { Reporter } from "../../reporters/index.js";
import { findUnpublishedPackages, findUnpublishedWorkspacePackages } from "../../unpublished-packages/index.js";
import { ChronusUserError, NodeChronusHost, prettyBytes, resolvePath, type ChronusHost } from "../../utils/index.js";
import { loadChronusWorkspace, type ChronusWorkspace } from "../../workspace/index.js";

export interface PublishOptions {
  readonly reporter: Reporter;
  readonly pattern: string;
  readonly otp?: string;
  readonly access?: "public" | "restricted";
  readonly registry?: string;
  readonly engine?: "pnpm" | "npm";
  readonly tag?: string;
  readonly reportSummary?: string;
}

export async function publish({ reporter, pattern, reportSummary, ...others }: PublishOptions) {
  const host = NodeChronusHost;
  const filesOrFolders = await host.glob(pattern);
  let results: Record<string, PublishPackageResult>;
  let workspace: ChronusWorkspace | undefined;
  if (filesOrFolders.length > 1 || filesOrFolders[0]?.endsWith(".tgz")) {
    const tgzFiles = filesOrFolders.filter((file) => file.endsWith(".tgz"));
    if (tgzFiles.length !== filesOrFolders.length) {
      throw new ChronusUserError(`Can only bulk publish tarballs or a single workspace at a time.`);
    }
    try {
      workspace = await loadChronusWorkspace(host, process.cwd());
    } catch (e) {
      // Don't need to be in a workspace for this.
    }

    results = await publishTarballs(host, tgzFiles, { reporter, ...others });
  } else {
    workspace = workspace = await loadChronusWorkspace(host, pattern);
    results = await publishWorkspacePackages(workspace, { reporter, ...others });
  }

  if (reportSummary) {
    const summary = createPublishSummary(results, workspace);
    await host.writeFile(reportSummary, JSON.stringify(summary, null, 2));
  }
}

function createPublishSummary(
  results: Record<string, PublishPackageResult>,
  workspace: ChronusWorkspace | undefined,
): PublishSummary {
  let hasFailure = false;
  let hasSuccess = false;
  const items = Object.values(results);
  if (items.length === 0) {
    return { status: "success", packages: {} };
  }
  for (const item of items) {
    if (item.published) {
      hasSuccess = true;
    } else {
      hasFailure = true;
    }
  }

  return {
    status: hasSuccess && hasFailure ? "partial" : hasSuccess ? "success" : "failed",
    packages: results,
  };
}

async function publishWorkspacePackages(
  workspace: ChronusWorkspace,
  { reporter, ...others }: Omit<PublishOptions, "pattern">,
): Promise<Record<string, PublishPackageResult>> {
  const packageToPublish = await findUnpublishedWorkspacePackages(workspace);
  if (packageToPublish.length === 0) {
    reporter.log(pc.green("All packages are already published."));
    return {};
  }
  const results: Record<string, PublishPackageResult> = {};

  for (const pkg of packageToPublish) {
    await reporter.task(`${pc.yellow(pkg.name)} publishing at tag ${others.tag ?? "latest"}`, async (task) => {
      const result = await publishPackage(pkg, resolvePath(workspace.path, pkg.relativePath), others);
      results[pkg.name] = result;
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

  return results;
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

  const results: Record<string, PublishPackageResult> = {};

  for (const pkg of unpublished) {
    await reporter.task(`${pc.yellow(pkg.name)} publishing at tag ${others.tag ?? "latest"}`, async (task) => {
      const result = await publishPackage(pkg, pkg.tarballPath, others);
      results[pkg.name] = result;
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
  return results;
}
