import { isCI } from "std-env";
import { readChangeDescriptions } from "../../change/read.js";
import { resolveChangelogGenerator } from "../../changelog/generate.js";
import type { Reporter } from "../../reporters/index.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import { ChronusError } from "../../utils/errors.js";
import type { ChangeDescription } from "../../change/types.js";
import type { ChronusWorkspace } from "../../workspace/types.js";
import { loadChronusWorkspace } from "../../workspace/index.js";
import { NodeChronusHost } from "../../utils/index.js";

export interface ChangelogOptions {
  readonly reporter: Reporter;
  readonly dir: string;
  readonly package?: string;
  readonly policy?: string;
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

export async function changelog({dir, ...options}: ChangelogOptions) {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, dir);
  const changes = await readChangeDescriptions(host, workspace);
  const interactive = process.stdout?.isTTY && !isCI;
  
  let changelog: string;
  if(options.package) {
    changelog = await getPackageChangelog(workspace, changes, options.package, interactive);
  } else if (options.policy) {
    changelog = await getPolicyChangelog(workspace, changes, options.policy, interactive);
  } else {
    throw new ChronusError("Need to specify either a package or a policy to generate a changelog");
  }

  log(changelog);
}


async function getPackageChangelog(workspace: ChronusWorkspace, changes: ChangeDescription[], pkgName: string, interactive: boolean) {
  const plan = assembleReleasePlan(changes, workspace);

  const action = plan.actions.find((x) => x.packageName === pkgName);
  if(!action) {
    throw new ChronusError(`No release action found for package ${pkgName}`);
  }
  const generator = await resolveChangelogGenerator(workspace, changes, interactive);
  
  return generator.renderPackageVersion(action.newVersion, action.changes);
}

async function getPolicyChangelog(workspace: ChronusWorkspace, changes: ChangeDescription[], policyName: string, interactive: boolean) {
  const plan = assembleReleasePlan(changes, workspace);
  const policy = workspace.config.versionPolicies?.find(x=> x.name === policyName);
  if(policy === undefined) {
    throw new ChronusError(`Policy ${policyName} is not defined in the chronus config. Available policies are: ${workspace.config.versionPolicies?.map(x=> x.name).join(", ")}`);
  }
  const actions = plan.actions.filter((x) => policy.packages.some(y => x.packageName === y));
  if(actions.length === 0) {
    return "";
  }
  const notableChanges = Object.fromEntries(actions.map(x => [x.packageName, x.changes]));
  const generator = await resolveChangelogGenerator(workspace, Object.values(notableChanges).flat(), interactive);
  return generator.renderAggregatedChangelog(actions[0].newVersion, notableChanges);
}
