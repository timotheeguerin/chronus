import type { ChronusWorkspace } from "../index.js";
import { createGitSourceControl } from "../source-control/git.js";
import type { ChronusHost } from "../utils/host.js";
import { findChangeStatus } from "./find.js";

export async function getWorkspaceStatus(host: ChronusHost, workspace: ChronusWorkspace) {
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace);
  return status;
}
