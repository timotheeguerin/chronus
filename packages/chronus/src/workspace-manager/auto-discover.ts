import { ChronusError, type ChronusHost } from "../utils/index.js";
import { createNpmWorkspaceManager } from "./npm.js";
import { createPnpmWorkspaceManager } from "./pnpm.js";
import { createRushWorkspaceManager } from "./rush.js";
import type { Workspace, WorkspaceManager, WorkspaceType } from "./types.js";

async function findWorkspaceManager(host: ChronusHost, root: string): Promise<WorkspaceManager> {
  const npm = createNpmWorkspaceManager(host);
  const pnpm = createNpmWorkspaceManager(host);
  const rush = createNpmWorkspaceManager(host);

  if (await pnpm.is(root)) {
    return pnpm;
  } else if (await rush.is(root)) {
    return rush;
  } else if (await npm.is(root)) {
    return npm;
  } else {
    throw new ChronusError("Couldn't figure out the workspace type.");
  }
}

export async function getWorkspaceManager(
  host: ChronusHost,
  root: string,
  type?: WorkspaceType | "auto",
): Promise<WorkspaceManager> {
  switch (type) {
    case "npm":
      return createNpmWorkspaceManager(host);
    case "pnpm":
      return createPnpmWorkspaceManager(host);
    case "rush":
      return createRushWorkspaceManager(host);
    case "auto":
    case undefined:
      return findWorkspaceManager(host, root);
    default:
      throw new ChronusError(`Unknown workspace type: ${type}`);
  }
}

export async function loadWorkspace(
  host: ChronusHost,
  root: string,
  type?: WorkspaceType | "auto",
): Promise<Workspace> {
  const manager = await getWorkspaceManager(host, root, type);
  return manager.load(root);
}
