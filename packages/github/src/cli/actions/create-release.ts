import { NodeChronusHost, loadChronusWorkspace } from "@chronus/chronus";
import { readPublishSummary } from "@chronus/chronus/publish";
import { ChronusError } from "@chronus/chronus/utils";
import { Octokit } from "octokit";
import pc from "picocolors";
import { getGithubToken } from "../../utils/gh-token.js";
import { loadChangelogForVersion } from "../../utils/parse-changelog.js";

export interface CreateReleaseOptions {
  readonly workspaceDir: string;
  readonly publishSummary: string;
  readonly repo: string;
}

export async function createRelease({ publishSummary: publishSummaryPath, repo, workspaceDir }: CreateReleaseOptions) {
  const host = NodeChronusHost;
  const octokit = new Octokit({ auth: await getGithubToken() });
  const publishSummary = await readPublishSummary(host, publishSummaryPath);
  const workspace = await loadChronusWorkspace(host, workspaceDir);

  const [owner, repoName] = repo.split("/", 2);
  let hasError = false;
  for (const result of Object.values(publishSummary.packages)) {
    if (!result.published) {
      log(pc.yellow(`Package ${result.name}@${result.version} failed to publish so skipping github release creation.`));
      continue;
    }
    const changelog = await loadChangelogForVersion(host, workspace, result.name, result.version);
    const tag = `${result.name}@${result.version}`;
    try {
      await octokit.rest.repos.createRelease({
        owner: owner,
        repo: repoName,
        tag_name: tag,
        body: changelog,
        prerelease: result.version.includes("-"),
      });
    } catch (e) {
      log(pc.red(`Error while creating release ${tag}:`));
      log(e);
      hasError = true;
    }
  }

  if (hasError) {
    throw new ChronusError("Failed to create some github releases");
  }
}

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
