import pluralize from "pluralize";
import type { ChangeDescription } from "../change/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { ReleaseAction } from "../release-plan/types.js";
import type { ChronusHost } from "../utils/host.js";
import { resolvePath } from "../utils/path-utils.js";
import type { ChronusPackage } from "../workspace/types.js";

export async function updateChangelog(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  action: ReleaseAction,
): Promise<void> {
  const newEntry = getChangelogEntry(workspace, action);
  const wrapped = `\n\n${newEntry}\n`;

  const pkg = workspace.getPackage(action.packageName);
  const changelogPath = resolvePath(workspace.path, pkg.relativePath, "CHANGELOG.md");
  const existingContent = await getExistingChangelog(host, changelogPath);

  const newContent = existingContent ? prependChangelogEntry(existingContent, wrapped) : newChangelog(pkg, wrapped);
  await host.writeFile(changelogPath, newContent);
}

function prependChangelogEntry(existingContent: string, newEntry: string): string {
  return existingContent.replace("\n", newEntry);
}
function newChangelog(pkg: ChronusPackage, newEntry: string): string {
  return `# Changelog - ${pkg.name}\n\n${newEntry}`;
}

async function getExistingChangelog(host: ChronusHost, filename: string): Promise<string | undefined> {
  try {
    return (await host.readFile(filename)).content;
  } catch {
    return undefined;
  }
}

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

  const lines = [`## ${action.newVersion}`, ""];
  let hasChange = false;
  for (const changeKind of Object.values(workspace.config.changeKinds)) {
    const changes = changesByKind.get(changeKind.name);
    if (changes && changes.length > 0) {
      hasChange = true;
      lines.push(`### ${changeKind.title ? pluralize(changeKind.title) : capitalize(changeKind.name)}`);
      lines.push(" ");
      for (const change of changes) {
        lines.push(`- ${change.content}`);
      }
    }
  }
  if (!hasChange) {
    lines.push("No changes, version bump only.");
  }
  return lines.join("\n");
}

function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}
