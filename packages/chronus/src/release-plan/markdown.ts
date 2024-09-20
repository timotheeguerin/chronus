import type { VersionType } from "../types.js";
import type { ReleaseAction, ReleasePlan } from "./types.js";

/**
 * Render a markdown summary of the given release plan
 */
export async function renderReleasePlanAsMarkdown(releasePlan: ReleasePlan): Promise<string> {
  return [
    "",
    "## Change summary:",
    "",
    ...typeAsMarkdown(releasePlan.actions, "major"),
    "",
    ...typeAsMarkdown(releasePlan.actions, "minor"),
    "",
    ...typeAsMarkdown(releasePlan.actions, "patch"),
    "",
  ].join("\n");
}

function typeAsMarkdown(actions: ReleaseAction[], type: VersionType): string[] {
  const bold = (x: string) => `**${x}**`;
  const filteredActions = actions.filter((x) => x.type === type);
  if (filteredActions.length === 0) {
    return [`### ${"No"} packages to be bumped at ${bold(type)}`];
  } else {
    return [
      `### ${filteredActions.length} packages to be bumped at ${bold(type)}:`,
      ...filteredActions.map((action) => `- ${action.packageName} \`${action.oldVersion}\` → \`${action.newVersion}\``),
    ];
  }
}
