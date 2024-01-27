import { createGitSourceControl } from "../../source-control/git.js";
import { NodeKronosHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";

export async function addChangeset(cwd: string): Promise<void> {
  const host = NodeKronosHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(cwd);
  const sourceControl = createGitSourceControl(workspace.path);
  const filesChanged = await sourceControl.listChangedFilesFromBase();
  // eslint-disable-next-line no-console
  console.log("Files changed", filesChanged);
}
