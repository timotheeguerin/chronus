import { isCI } from "std-env";
import { readChangeDescriptions } from "../../change/read.js";
import type { ChangeDescription } from "../../change/types.js";
import { resolveChangelogGenerator } from "../../changelog/generate.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { Reporter } from "../../reporters/index.js";
import { ChronusUserError } from "../../utils/errors.js";
import { NodeChronusHost } from "../../utils/index.js";
import { loadChronusWorkspace } from "../../workspace/index.js";
import type { ChronusWorkspace } from "../../workspace/types.js";

export interface ChangelogOptions {
  readonly reporter: Reporter;
  readonly dir: string;
  readonly package?: string | string[];
  readonly policy?: string | string[];
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

export async function changelog({ dir, ...options }: ChangelogOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  const changes = await readChangeDescriptions(host, workspace);
  const interactive = process.stdout?.isTTY && !isCI;

  // Normalize inputs to arrays
  const packages = options.package ? (Array.isArray(options.package) ? options.package : [options.package]) : [];
  const policies = options.policy ? (Array.isArray(options.policy) ? options.policy : [options.policy]) : [];

  // Validate at least one is specified
  if (packages.length === 0 && policies.length === 0) {
    throw new ChronusUserError("Need to specify at least one package or policy to generate a changelog");
  }

  // Generate changelogs for all requested items
  const changelogs: string[] = [];
  
  for (const pkgName of packages) {
    const changelog = await getPackageChangelog(workspace, changes, pkgName, interactive);
    if (changelog) {
      changelogs.push(changelog);
    }
  }

  for (const policyName of policies) {
    const changelog = await getPolicyChangelog(workspace, changes, policyName, interactive);
    if (changelog) {
      changelogs.push(changelog);
    }
  }

  // Output all changelogs
  const output = changelogs.join("\n\n");
  log(output);
}

async function getPackageChangelog(
  workspace: ChronusWorkspace,
  changes: ChangeDescription[],
  pkgName: string,
  interactive: boolean,
) {
  const plan = assembleReleasePlan(changes, workspace);

  const action = plan.actions.find((x) => x.packageName === pkgName);
  if (!action) {
    throw new ChronusUserError(`No release action found for package ${pkgName}`);
  }
  const generator = await resolveChangelogGenerator(workspace, changes, interactive);

  return generator.renderPackageVersion(action.newVersion, action.changes);
}

async function getPolicyChangelog(
  workspace: ChronusWorkspace,
  changes: ChangeDescription[],
  policyName: string,
  interactive: boolean,
) {
  const plan = assembleReleasePlan(changes, workspace);
  const policy = workspace.config.versionPolicies?.find((x) => x.name === policyName);
  if (policy === undefined) {
    throw new ChronusUserError(
      `Policy ${policyName} is not defined in the chronus config. Available policies are: ${workspace.config.versionPolicies?.map((x) => x.name).join(", ")}`,
    );
  }
  const actions = plan.actions.filter((x) => policy.packages.some((y) => x.packageName === y));
  if (actions.length === 0) {
    return "";
  }
  const notableChanges = Object.fromEntries(actions.map((x) => [x.packageName, x.changes]));
  const generator = await resolveChangelogGenerator(workspace, Object.values(notableChanges).flat(), interactive);
  return generator.renderAggregatedChangelog(actions[0].newVersion, notableChanges);
}
