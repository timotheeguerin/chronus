import type { ChronusWorkspace } from "../index.js";
import { createGitSourceControl } from "../source-control/git.js";
import type { ChronusHost } from "../utils/host.js";
import { findChangeStatus, type FindChangeStatusOptions } from "./find.js";

export async function getWorkspaceStatus(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  options?: FindChangeStatusOptions,
) {
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace, options);
  return status;
}
