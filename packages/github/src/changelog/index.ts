import { NodeChronusHost, loadChronusWorkspace, type ChronusWorkspace } from "@chronus/chronus";
import { readChangeDescriptions, resolveChangeRelativePath } from "@chronus/chronus/change";
import { createGitSourceControl } from "@chronus/chronus/source-control/git";
import { ChronusError, execAsync } from "@chronus/chronus/utils";
import { resolve } from "path";
import { getGithubInfoForChange } from "./fetch-pr-info.js";

async function getCommitsThatAddChangeDescriptions(
  workspace: ChronusWorkspace,
  changeDescriptionsFilename: string[],
): Promise<Record<string, string>> {
  const git = createGitSourceControl(workspace.path);
  const paths = changeDescriptionsFilename.map((id) => resolveChangeRelativePath(id));
  const commits = await git.getCommitsThatAddFiles(paths);

  const result: Record<string, string> = {};
  for (const changeId of changeDescriptionsFilename) {
    const commit = commits[resolveChangeRelativePath(changeId)];
    if (commit) {
      result[changeId] = commit;
    }
  }
  return result;
}

const workspace = await loadChronusWorkspace(NodeChronusHost, resolve(process.cwd(), "../.."));

const changes = await readChangeDescriptions(NodeChronusHost, workspace);
const commits = await getCommitsThatAddChangeDescriptions(
  workspace,
  changes.map((c) => c.id),
);

const result = await getGithubInfoForChange("timotheeguerin", "chronus", commits, await getGithubToken());

console.log("Res", result);

async function getGithubToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  } else {
    const result = await execAsync("gh", ["auth", "token"]);
    if (result.code === 0) {
      return result.stdout.toString().trim();
    } else {
      throw new ChronusError(`Failed to get github token:${result.stdall}`);
    }
  }
}
