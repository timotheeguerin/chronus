import pluralize from "pluralize";
import type { ChangeDescription } from "../change/types.js";
import type { ChangeKindResolvedConfig } from "../config/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { ReleaseAction } from "../release-plan/types.js";

export interface ChangelogGenerator {
  packageVersionChangeLog(workspace: ChronusWorkspace, action: ReleaseAction): Promise<string>;
  // workspaceBumpChangelog(workspace: ChronusWorkspace, action: ReleaseAction[]): Promise<string>;
}

export const SimpleChangelogGenerator: ChangelogGenerator = {
  packageVersionChangeLog: async (workspace: ChronusWorkspace, action: ReleaseAction): Promise<string> => {
    return new SimpleChangelogGeneratorCls(workspace).releaseNotes(action);
  },
};

export class SimpleChangelogGeneratorCls {
  readonly workspace: ChronusWorkspace;
  constructor(workspace: ChronusWorkspace) {
    this.workspace = workspace;
  }

  releaseNotes(action: ReleaseAction): string {
    const lines = [`## ${action.newVersion}`, ""];
    if (action.changes.length === 0) {
      lines.push("No changes, version bump only.");
    } else {
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

      for (const changeKind of Object.values(this.workspace.config.changeKinds)) {
        const changes = changesByKind.get(changeKind.name);
        if (changes && changes.length > 0) {
          lines.push(this.changeKindSection(changeKind, changes));
        }
      }
    }

    return lines.join("\n");
  }

  changeKindSection(changeKind: ChangeKindResolvedConfig, changes: ChangeDescription[]): string {
    if (changes.length === 0) return "";
    return [this.changeKindTitle(changeKind), "", changes.map((change) => this.item(change)), ""].join("\n");
  }

  changeKindTitle(changeKind: ChangeKindResolvedConfig): string {
    return `### ${changeKind.title ? pluralize(changeKind.title) : capitalize(changeKind.name)}`;
  }

  item(change: ChangeDescription): string {
    return `- ${change}`;
  }
}

function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}

export class GitChangelogGeneratorCls extends SimpleChangelogGeneratorCls {
  #commitForChange: Map<string, string>;

  constructor(workspace: ChronusWorkspace, commitForChange: Map<string, string>) {
    super(workspace);
    this.#commitForChange = commitForChange;
  }

  item(change: ChangeDescription): string {
    return `- ${this.#commitForChange.get(change.id) ?? ""} ${change}`;
  }
}
