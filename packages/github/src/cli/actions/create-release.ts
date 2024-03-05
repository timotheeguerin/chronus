import { NodeChronusHost, loadChronusWorkspace, type ChronusWorkspace } from "@chronus/chronus";
import { readPublishSummary } from "@chronus/chronus/publish";
import { ChronusError, resolveCurrentLockStepVersion, type ChronusHost } from "@chronus/chronus/utils";
import { Octokit } from "octokit";
import pc from "picocolors";
import type { LockstepVersionPolicy } from "../../../../chronus/dist/config/types.js";
import type { GithubRepo } from "../../types.js";
import { getGithubToken } from "../../utils/gh-token.js";
import { loadAndMergeMultiplePackageChangelog, loadChangelogForVersion } from "../../utils/parse-changelog.js";

export interface CreateReleaseOptions {
  readonly workspaceDir: string;
  readonly repo: string;
  readonly publishSummary?: string;
  readonly package?: string;
  readonly policy?: string;
  readonly version?: string;
  readonly commit?: string;
  readonly dryRun?: boolean;
}

export async function createRelease({
  publishSummary: publishSummaryPath,
  repo,
  workspaceDir,
  package: pkgName,
  policy: policyName,
  version,
  commit,
  dryRun,
}: CreateReleaseOptions) {
  if (publishSummaryPath && pkgName) {
    throw new ChronusError(
      `Both 'publishSummary' and 'package' option have been provided but they are mutually exclusive.`,
    );
  }
  if (publishSummaryPath && policyName) {
    throw new ChronusError(
      `Both 'publishSummary' and 'policy' option have been provided but they are mutually exclusive.`,
    );
  }
  if (pkgName && policyName) {
    throw new ChronusError(`Both 'package' and 'policy' option have been provided but they are mutually exclusive.`);
  }
  if (publishSummaryPath && version) {
    throw new ChronusError(`'version' option must be used with package and will have no effect with a publishSummary`);
  }
  if (publishSummaryPath === undefined && pkgName === undefined && policyName === undefined) {
    throw new ChronusError(`Either 'publishSummary', 'package' or 'policy' option must be specified.`);
  }
  const host = NodeChronusHost;
  const octokit = new Octokit({ auth: await getGithubToken() });
  const workspace = await loadChronusWorkspace(host, workspaceDir);

  const [owner, repoName] = repo.split("/", 2);
  const releaseRef: ReleaseRef = { owner, repo: repoName, commit };
  if (publishSummaryPath) {
    return createReleaseFromPublishSummary(host, workspace, octokit, publishSummaryPath, releaseRef, dryRun);
  } else {
    if (version === undefined) {
      throw new ChronusError("Both 'version' option must be provided when using 'package' or 'policy'");
    }
    if (pkgName !== undefined) {
      const createResult = await createReleaseForPackage(
        host,
        workspace,
        octokit,
        pkgName,
        version,
        releaseRef,
        dryRun,
      );
      if (!createResult.success) {
        process.exit(1);
      }
    } else if (policyName) {
      const policy = workspace.config.versionPolicies?.find((x) => x.name);
      if (policy === undefined) {
        throw new ChronusError(`Unknown policy '${policyName}'`);
      }
      if (policy.type !== "lockstep") {
        throw new ChronusError(`Can only create release for lockstep policies`);
      }
      const createResult = await createReleaseForPolicy(host, workspace, octokit, policy, version, releaseRef, dryRun);
      if (!createResult.success) {
        process.exit(1);
      }
    }
  }
}

async function createReleaseFromPublishSummary(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  octokit: Octokit,
  publishSummaryPath: string,
  ref: ReleaseRef,
  dryRun: boolean | undefined,
) {
  const publishSummary = await readPublishSummary(host, publishSummaryPath);
  const packagesNeedingARelease = new Map(Object.entries(publishSummary.packages));
  const policiesNeedingARelease: { policy: LockstepVersionPolicy; version: string }[] = [];
  const policies = workspace.config.versionPolicies;
  if (policies) {
    for (const policy of policies) {
      switch (policy.type) {
        case "lockstep":
          {
            const latestVersion = resolveCurrentLockStepVersion(workspace, policy);
            let allMatch = true;
            for (const name of policy.packages) {
              if (workspace.getPackage(name).version !== latestVersion) {
                allMatch = false;
              } else {
                packagesNeedingARelease.delete(name);
              }
            }

            if (allMatch) {
              policiesNeedingARelease.push({ policy, version: latestVersion });
            }
          }
          break;
        case "independent":
        default:
          continue;
      }
    }
  }
  let hasError = false;
  for (const result of Object.values(packagesNeedingARelease)) {
    if (!result.published) {
      log(pc.yellow(`Package ${result.name}@${result.version} failed to publish so skipping github release creation.`));
      continue;
    }
    const createResult = await createReleaseForPackage(
      host,
      workspace,
      octokit,
      result.name,
      result.version,
      ref,
      dryRun,
    );
    if (!createResult.success) {
      hasError = true;
    }
  }
  for (const result of Object.values(policiesNeedingARelease)) {
    const createResult = await createReleaseForPolicy(
      host,
      workspace,
      octokit,
      result.policy,
      result.version,
      ref,
      dryRun,
    );
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
  dryRun: boolean | undefined,
): Promise<{ success: boolean }> {
  log(`Will create release for package ${pkgName}@${version}.`);

  const changelog = await loadChangelogForVersion(host, workspace, pkgName, version);
  const tag = `${pkgName}@${version}`;
  try {
    await createGithubRelease(octokit, {
      tag,
      version,
      content: changelog ?? "",
      ref,
      dryRun,
    });
    return { success: true };
  } catch (e) {
    log(pc.red(`Error while creating release '${tag}':`));
    log(e);
    return { success: false };
  }
}

async function createReleaseForPolicy(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  octokit: Octokit,
  policy: LockstepVersionPolicy,
  version: string,
  ref: ReleaseRef,
  dryRun: boolean | undefined,
): Promise<{ success: boolean }> {
  log(`Will create release for version policy ${policy.name}@${version}.`);

  const changelog = await loadAndMergeMultiplePackageChangelog(
    host,
    workspace,
    policy.packages.map((x) => ({ name: x, version })),
  );
  const tag = `${policy.name}@${version}`;
  try {
    await createGithubRelease(octokit, {
      tag,
      version,
      content: changelog,
      ref,
      dryRun,
    });
    return { success: true };
  } catch (e) {
    log(pc.red(`Error while creating release '${tag}':`));
    log(e);
    return { success: false };
  }
}

interface CreateGithubReleaseOptions {
  readonly version: string;
  readonly tag: string;
  readonly content: string;
  readonly ref: ReleaseRef;
  readonly dryRun?: boolean;
}

async function createGithubRelease(
  octokit: Octokit,
  { version, tag, ref, content, dryRun }: CreateGithubReleaseOptions,
) {
  if (dryRun) {
    log("-".repeat(60));
    log(`Creating release: ${tag}`);
    log("-".repeat(60));
    log("");
    log(content);
    log("-".repeat(60));
  } else {
    const release = await octokit.rest.repos.createRelease({
      owner: ref.owner,
      repo: ref.repo,
      target_commitish: ref.commit,
      tag_name: tag,
      name: tag,
      body: content,
      prerelease: version.includes("-"),
    });
    log(pc.green(`Created release for package ${tag}: ${release.data.html_url}`));
  }
}

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
