import parseChangeset from "@changesets/parse";
import type { VersionType } from "@changesets/types";
import pc from "picocolors";
import { resolveConfig } from "../../config/parse.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleaseAction } from "../../release-plan/types.js";
import { NodechronusHost } from "../../utils/node-host.js";
import { createPnpmWorkspaceManager } from "../../workspace-manager/pnpm.js";

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function showStatus(cwd: string): Promise<void> {
  const host = NodechronusHost;
  const pnpm = createPnpmWorkspaceManager(host);
  const config = await resolveConfig(host, cwd);
  const workspace = await pnpm.load(cwd);

  const changelogs = await host.glob(".changeset/*.md", { baseDir: workspace.path });
  const changesets = await Promise.all(
    changelogs
      .filter((x) => x.toLowerCase() !== ".changeset/readme.md")
      .map(async (x) => {
        const file = await host.readFile(x);
        return parseChangeset(file.content);
      }),
  );

  const releasePlan = assembleReleasePlan(changesets, workspace, config);

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
