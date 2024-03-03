import pluralize from "pluralize";
import type { ChangeDescription } from "../change/types.js";
import type { ChronusWorkspace } from "../workspace/index.js";

export class BasicChangelogGenerator {
  constructor(protected workspace: ChronusWorkspace) {}

  renderPackageVersion(newVersion: string, changes: ChangeDescription[]) {
    const changesByKind = new Map<string, ChangeDescription[]>();

    for (const change of changes) {
      const kind = change.changeKind.name;
      const existing = changesByKind.get(kind);
      if (existing) {
        existing.push(change);
      } else {
        changesByKind.set(kind, [change]);
      }
    }

    const lines = [`## ${newVersion}`, ""];
    let hasChange = false;
    for (const changeKind of Object.values(this.workspace.config.changeKinds)) {
      const changes = changesByKind.get(changeKind.name);
      if (changes && changes.length > 0) {
        hasChange = true;
        lines.push(`### ${changeKind.title ? pluralize(changeKind.title) : capitalize(changeKind.name)}`);
        lines.push(" ");
        for (const change of changes) {
          lines.push(this.renderEntry(change));
        }
      }
    }
    if (!hasChange) {
      lines.push("No changes, version bump only.");
    }
    return lines.join("\n");
  }

  renderEntry(change: ChangeDescription) {
    return `- ${change.content}`;
  }
}

function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}
