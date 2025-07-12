import { ChronusError, type ChronusHost } from "../utils/index.js";
import { createNodeWorkspaceManager } from "./node/node.js";
import { createPnpmWorkspaceManager } from "./node/pnpm.js";
import { createRushWorkspaceManager } from "./node/rush.js";
import type { Workspace, WorkspaceManager } from "./node/types.js";

const ecosystems = [createPnpmWorkspaceManager(), createRushWorkspaceManager(), createNodeWorkspaceManager()];

async function findWorkspaceManager(host: ChronusHost, root: string): Promise<WorkspaceManager> {
  for (const ecosystem of ecosystems) {
    if (await ecosystem.is(host, root)) {
      return ecosystem;
    }
  }

  throw new ChronusError("Couldn't figure out the workspace type.");
}

export async function getWorkspaceManager(
  host: ChronusHost,
  root: string,
  type?: string | "auto",
): Promise<WorkspaceManager> {
  if (type === "auto" || type === undefined) {
    return findWorkspaceManager(host, root);
  }
  for (const ecosystem of ecosystems) {
    if (ecosystem.aliases?.includes(type ?? "auto") || ecosystem.type === type) {
      return ecosystem;
    }
  }

  throw new ChronusError(
    `Unknown workspace type: ${type}. Available types: ${ecosystems.map((e) => e.type).join(", ")}`,
  );
}

export async function loadWorkspace(host: ChronusHost, root: string, type?: string | "auto"): Promise<Workspace> {
  const manager = await getWorkspaceManager(host, root, type);
  return manager.load(host, root);
}
