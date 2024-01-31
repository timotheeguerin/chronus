import parseChangeset from "@changesets/parse";
import type { VersionType } from "@changesets/types";
import pc from "picocolors";
import { resolveConfig } from "../../config/parse.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleaseAction, ReleasePlan } from "../../release-plan/types.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { loadWorkspace } from "../../workspace-manager/auto-discover.js";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function showStatus(cwd: string): Promise<void> {
  const releasePlan = await resolveCurrentReleasePlan(cwd);

  log("");
  log(pc.bold("Change summary:"));
  logType(releasePlan.actions, "major", pc.red);
  logType(releasePlan.actions, "minor", pc.yellow);
  logType(releasePlan.actions, "patch", pc.italic);
  log("");
}

function logType(actions: ReleaseAction[], type: VersionType, color: (x: string) => string) {
  const filteredActions = actions.filter((x) => x.type === type);
  log("");
  if (filteredActions.length === 0) {
    log(`${pc.cyan("No")} packages to be bumped at ${color(type)}`);
  } else {
    log(`${pc.green(filteredActions.length)} packages to be bumped at ${color(type)}:`);
    for (const action of filteredActions) {
      log(
        `${pc.green(` - ${action.packageName}`)}`.padEnd(50, " ") +
          pc.magenta(action.oldVersion) +
          " → " +
          pc.cyan(action.newVersion),
      );
    }
  }
}

async function resolveCurrentReleasePlan(cwd: string): Promise<ReleasePlan> {
  const host = NodechronusHost;
  const config = await resolveConfig(host, cwd);
  const workspace = await loadWorkspace(host, config.workspaceRoot, config.workspaceType);

  const changelogs = await host.glob(".changeset/*.md", { baseDir: workspace.path });
  const changesets = await Promise.all(
    changelogs
      .filter((x) => x.toLowerCase() !== ".changeset/readme.md")
      .map(async (x) => {
        const file = await host.readFile(x);
        return { ...parseChangeset(file.content), id: x.slice(".changeset/".length, -3) };
      }),
  );

  const releasePlan = assembleReleasePlan(changesets, workspace, config);
  return releasePlan;
}

export async function showStatusAsMarkdown(cwd: string): Promise<string> {
  const releasePlan = await resolveCurrentReleasePlan(cwd);
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
