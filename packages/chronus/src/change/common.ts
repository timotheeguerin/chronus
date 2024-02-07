import { resolvePath } from "../utils/index.js";
import type { ChronusWorkspace } from "../workspace/types.js";

export const changesRelativeDir = ".chronus/changes";
export function resolveChangesDir(workspace: ChronusWorkspace) {
  return resolvePath(workspace.path, changesRelativeDir);
}

export function resolveChangePath(workspace: ChronusWorkspace, changeId: string) {
  return resolvePath(resolveChangesDir(workspace), `${changeId}.md`);
}

export function resolveChangeRelativePath(changeId: string) {
  return resolvePath(changesRelativeDir, `${changeId}.md`);
}
