import pc from "picocolors";
import { isCI } from "std-env";
import { applyReleasePlan, updatePackageVersions } from "../../apply-release-plan/apply-release-plan.js";
import { readChangeDescriptions } from "../../change/read.js";
import { getPrereleaseVersionActions } from "../../prerelease-versioning/index.js";
import { assembleReleasePlan } from "../../release-plan/assemble-release-plan.js";
import type { ReleasePlan } from "../../release-plan/types.js";
import type { ChronusHost } from "../../utils/host.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import { loadChronusWorkspace } from "../../workspace/load.js";
import type { ChronusWorkspace } from "../../workspace/types.js";

const DefaultPrereleaseTemplate = "{nextVersion}-dev.{changeCountWithPatch}";

export interface BumpVersionOptions {
  readonly ignorePolicies?: boolean;
  readonly prerelease?: boolean | string;
  readonly only?: string[];
  readonly exclude?: string[];
}

export async function bumpVersions(cwd: string, options?: BumpVersionOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);

  if (options?.prerelease) {
    await bumpPrereleaseVersion(
      host,
      workspace,
      options.prerelease === true || options.prerelease === "" ? DefaultPrereleaseTemplate : options.prerelease,
      { only: options.only, exclude: options.exclude },
    );
  } else {
    const releasePlan = await resolveReleasePlan(host, workspace, options);
    const interactive = process.stdout?.isTTY && !isCI;
    await applyReleasePlan(host, workspace, releasePlan, interactive);
  }
}

export async function resolveReleasePlan(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  options?: BumpVersionOptions | undefined,
): Promise<ReleasePlan> {
  const changesets = await readChangeDescriptions(host, workspace);

  const releasePlan = assembleReleasePlan(changesets, workspace, options);
  return releasePlan;
}

async function bumpPrereleaseVersion(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  prereleaseTemplate: string,
  filters: { only?: string[]; exclude?: string[] } = {},
) {
  const changes = await readChangeDescriptions(host, workspace);
  const versionActions = await getPrereleaseVersionActions(changes, workspace, prereleaseTemplate, filters);
  const maxLength = workspace.packages.reduce((max, pkg) => Math.max(max, pkg.name.length), 0);
  for (const [pkgName, action] of versionActions) {
    log(`Bumping ${pc.magenta(pkgName.padEnd(maxLength))} to ${pc.cyan(action.newVersion)}`);
  }
  await updatePackageVersions(host, workspace, versionActions, "prerelease");
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
