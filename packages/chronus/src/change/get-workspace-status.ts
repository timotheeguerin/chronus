import { createGitSourceControl } from "../source-control/git.js";
import { NodechronusHost } from "../utils/node-host.js";
import { loadChronusWorkspace } from "../workspace/load.js";
import { findChangeStatus } from "./find.js";

export async function getWorkspaceStatus(dir: string) {
  const host = NodechronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace);
  return status;
}
