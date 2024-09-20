import { type BumpVersionOptions, resolveReleasePlan } from "../cli/commands/bump-versions.js";
import type { ChronusHost } from "../utils/host.js";
import { loadChronusWorkspace } from "../workspace/load.js";
import type { ReleasePlan } from "./types.js";

export async function resolveCurrentReleasePlan(
  host: ChronusHost,
  cwd: string,
  options?: BumpVersionOptions,
): Promise<ReleasePlan> {
  const workspace = await loadChronusWorkspace(host, cwd);
  return await resolveReleasePlan(host, workspace, options);
}
