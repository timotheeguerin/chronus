import { NodeChronusHost, loadChronusWorkspace } from "@chronus/chronus";
import { readPublishSummary } from "@chronus/chronus/publish";
import pc from "picocolors";
import { loadChangelogForVersion } from "../../utils/parse-changelog.js";

export interface CreateReleaseOptions {
  readonly workspaceDir: string;
  readonly publishSummary: string;
  readonly repo: string;
}

export async function createRelease({ publishSummary: publishSummaryPath, repo, workspaceDir }: CreateReleaseOptions) {
  const host = NodeChronusHost;
  const publishSummary = await readPublishSummary(host, publishSummaryPath);
  const workspace = await loadChronusWorkspace(host, workspaceDir);
  for (const result of Object.values(publishSummary.packages)) {
    if (!result.published) {
      log(pc.yellow(`Package ${result.name}@${result.version} failed to publish so skipping github release creation.`));
      continue;
    }
    const changelog = await loadChangelogForVersion(host, workspace, result.name, result.version);
  }
}

function log(...args: string[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
