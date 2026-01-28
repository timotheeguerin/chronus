import type { ChronusUserConfig } from "../config/types.js";
import { ChronusError, type ChronusHost } from "../utils/index.js";
import { createNodeWorkspaceManager } from "./node/node.js";
import { createPnpmWorkspaceManager } from "./node/pnpm.js";
import { createRushWorkspaceManager } from "./node/rush.js";
import { PipWorkspaceManager } from "./python/pip.js";
import { CargoWorkspaceManager } from "./rust/cargo.js";
import type { Workspace, WorkspaceManager, WorkspaceManagerConfig } from "./types.js";

const ecosystems = [
  createPnpmWorkspaceManager(),
  createRushWorkspaceManager(),
  createNodeWorkspaceManager(),
  new CargoWorkspaceManager(),
  new PipWorkspaceManager(),
];
const ecosystemMap = new Map<string, WorkspaceManager>(ecosystems.map((x) => [x.type, x]));

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

export async function loadWorkspace(
  host: ChronusHost,
  root: string,
  type?: string | "auto",
  userConfig?: ChronusUserConfig,
): Promise<Workspace> {
  const manager = await getWorkspaceManager(host, root, type);
  const config: WorkspaceManagerConfig = {
    packagePatterns: userConfig?.packagePatterns,
  };
  return manager.load(host, root, config);
}

export function getEcosystem(type: string) {
  const ecosystem = ecosystemMap.get(type);
  if (!ecosystem) {
    throw new ChronusError(
      `Unknown ecosystem type: ${type}. Available types: ${ecosystems.map((e) => e.type).join(", ")}`,
    );
  }
  return ecosystem;
}
