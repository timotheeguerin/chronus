import { resolveConfig } from "../config/parse.js";
import { createGitSourceControl } from "../source-control/git.js";
import { NodechronusHost } from "../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../workspace-manager/pnpm.js";
import { findChangeStatus } from "./find.js";

export async function getWorkspaceStatus(root: string) {
  const host = NodechronusHost;
  const config = await resolveConfig(host, root);
  const pnpm = createPnpmWorkspaceManager(host);
  const workspace = await pnpm.load(root);
  const sourceControl = createGitSourceControl(workspace.path);
  const status = await findChangeStatus(host, sourceControl, workspace, config);
  return status;
}
