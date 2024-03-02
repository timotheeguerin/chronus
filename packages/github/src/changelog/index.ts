import { NodeChronusHost, loadChronusWorkspace, type ChronusWorkspace } from "@chronus/chronus";
import { readChangeDescriptions, resolveChangeRelativePath } from "@chronus/chronus/change";
import { createGitSourceControl } from "@chronus/chronus/source-control/git";
import { resolve } from "path";

async function getCommitsThatAddChangeDescriptions(
  workspace: ChronusWorkspace,
  changeDescriptionsFilename: string[],
): Promise<Record<string, string>> {
  const git = createGitSourceControl(workspace.path);
  const paths = changeDescriptionsFilename.map((id) => resolveChangeRelativePath(id));
  const commits = await git.getCommitsThatAddFiles(paths);

  return commits;
}

const workspace = await loadChronusWorkspace(NodeChronusHost, resolve(process.cwd(), "../.."));

const changes = await readChangeDescriptions(NodeChronusHost, workspace);
console.log(
  await getCommitsThatAddChangeDescriptions(
    workspace,
    changes.map((c) => c.id),
  ),
);
