import { resolveConfig } from "../config/parse.js";
import { createGitSourceControl } from "../source-control/git.js";
import { NodechronusHost } from "../utils/node-host.js";
import { loadWorkspace } from "../workspace-manager/index.js";
import { findChangeStatus } from "./find.js";

export async function getWorkspaceStatus(dir: string) {
  const host = NodechronusHost;
  const config = await resolveConfig(host, dir);
  const workspace = await loadWorkspace(host, config.workspaceRoot, config.workspaceType);
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace, config);
  return status;
}
