import { NodeChronusHost, loadChronusWorkspace, type ChronusWorkspace } from "@chronus/chronus";
import { readPublishSummary } from "@chronus/chronus/publish";
import { ChronusError, type ChronusHost } from "@chronus/chronus/utils";
import { Octokit } from "octokit";
import pc from "picocolors";
import type { GithubRepo } from "../../types.js";
import { getGithubToken } from "../../utils/gh-token.js";
import { loadChangelogForVersion } from "../../utils/parse-changelog.js";

export interface CreateReleaseOptions {
  readonly workspaceDir: string;
  readonly repo: string;
  readonly publishSummary?: string;
  readonly package?: string;
  readonly version?: string;
  readonly commit?: string;
}

export async function createRelease({
  publishSummary: publishSummaryPath,
  repo,
  workspaceDir,
  package: pkgName,
  version,
  commit,
}: CreateReleaseOptions) {
  if (publishSummaryPath && pkgName) {
    throw new ChronusError(
      `Both 'publishSummary' and 'package' option have been provided but they are mutually exclusive.`,
    );
  }
  if (publishSummaryPath && version) {
    throw new ChronusError(`'version' option must be used with package and will have no effect with a publishSummary`);
  }
  if (publishSummaryPath === undefined && pkgName === undefined) {
    throw new ChronusError(`Either 'publishSummary' or 'package' option must be specified.`);
  }
  const host = NodeChronusHost;
  const octokit = new Octokit({ auth: await getGithubToken() });
  const workspace = await loadChronusWorkspace(host, workspaceDir);

  const [owner, repoName] = repo.split("/", 2);
  const releaseRef: ReleaseRef = { owner, repo: repoName, commit };
  if (publishSummaryPath) {
    return createReleaseFromPublishSummary(host, workspace, octokit, publishSummaryPath, releaseRef);
  } else {
    if (pkgName === undefined || version === undefined) {
      throw new ChronusError("Both 'package' and 'version' options should be specified");
    }
    const createResult = await createReleaseForPackage(host, workspace, octokit, pkgName, version, releaseRef);
    if (!createResult.success) {
      process.exit(1);
    }
  }
}

async function createReleaseFromPublishSummary(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  octokit: Octokit,
  publishSummaryPath: string,
  ref: ReleaseRef,
) {
  const publishSummary = await readPublishSummary(host, publishSummaryPath);

  let hasError = false;
  for (const result of Object.values(publishSummary.packages)) {
    if (!result.published) {
      log(pc.yellow(`Package ${result.name}@${result.version} failed to publish so skipping github release creation.`));
      continue;
    }
    const createResult = await createReleaseForPackage(host, workspace, octokit, result.name, result.version, ref);
    if (!createResult.success) {
      hasError = true;
    }
  }

  if (hasError) {
    throw new ChronusError("Failed to create some github releases");
  }
}

export interface ReleaseRef extends GithubRepo {
  readonly commit?: string;
}
async function createReleaseForPackage(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  octokit: Octokit,
  pkgName: string,
  version: string,
  ref: ReleaseRef,
): Promise<{ success: boolean }> {
  log(`Will create release for package ${pkgName}@${version}.`);

  const changelog = await loadChangelogForVersion(host, workspace, pkgName, version);
  const tag = `${pkgName}@${version}`;
  try {
    const release = await octokit.rest.repos.createRelease({
      owner: ref.owner,
      repo: ref.repo,
      target_commitish: ref.commit,
      tag_name: tag,
      name: tag,
      body: changelog,
      prerelease: version.includes("-"),
    });
    log(pc.green(`Created release for package ${pkgName}@${version}: ${release.data.html_url}`));
    return { success: true };
  } catch (e) {
    log(pc.red(`Error while creating release '${tag}':`));
    log(e);
    return { success: false };
  }
}

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
