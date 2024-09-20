import pc from "picocolors";
import { resolveCurrentReleasePlan } from "../../release-plan/current.js";
import type { ReleaseAction } from "../../release-plan/types.js";
import type { VersionType } from "../../types.js";
import { NodeChronusHost } from "../../utils/node-host.js";

export interface ShowStatusOptions {
  readonly ignorePolicies?: boolean;
  readonly only?: string[];
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
export async function showStatus(cwd: string, options: ShowStatusOptions): Promise<void> {
  const releasePlan = await resolveCurrentReleasePlan(NodeChronusHost, cwd, options);

  let max = 50;
  for (const action of releasePlan.actions) {
    if (action.packageName.length > max) {
      max = action.packageName.length;
    }
  }
  const pad = max + 10;
  log("");
  log(pc.bold("Change summary:"));
  logType(releasePlan.actions, "major", pad, pc.red);
  logType(releasePlan.actions, "minor", pad, pc.yellow);
  logType(releasePlan.actions, "patch", pad, pc.italic);
  log("");
}

function logType(actions: ReleaseAction[], type: VersionType, pad: number, color: (x: string) => string) {
  const filteredActions = actions.filter((x) => x.type === type);
  log("");
  if (filteredActions.length === 0) {
    log(`${pc.cyan("No")} packages to be bumped at ${color(type)}`);
  } else {
    log(`${pc.green(filteredActions.length)} packages to be bumped at ${color(type)}:`);
    for (const action of filteredActions) {
      log(
        `${pc.green(` - ${action.packageName}`)}`.padEnd(pad, " ") +
          pc.magenta(action.oldVersion) +
          " → " +
          pc.cyan(action.newVersion),
      );
    }
  }
}
