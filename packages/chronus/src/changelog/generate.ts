import type { ChangeDescription } from "../change/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { ReleaseAction } from "../release-plan/types.js";

export function getChangelogEntry(workspace: ChronusWorkspace, action: ReleaseAction): string {
  const changesByKind = new Map<string, ChangeDescription[]>();

  for (const change of action.changes) {
    const kind = change.changeKind.name;
    const existing = changesByKind.get(kind);
    if (existing) {
      existing.push(change);
    } else {
      changesByKind.set(kind, [change]);
    }
  }

  const lines = [];
  for (const changeKind of Object.values(workspace.config.changeKinds)) {
    const changes = changesByKind.get(changeKind.name);
    if (changes && changes.length > 0) {
      lines.push(`### ${changeKind.name}`);
      lines.push(" ");
      for (const change of changes) {
        lines.push(`- ${change.content}`);
      }
    }
  }
  return lines.join("\n");
}
