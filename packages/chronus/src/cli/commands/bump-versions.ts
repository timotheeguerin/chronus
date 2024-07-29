import pc from "picocolors";
import { parse } from "semver";
import { isCI } from "std-env";
import { updatePackageVersions } from "../../apply-release-plan/apply-release-plan.js";
import { applyReleasePlan } from "../../apply-release-plan/index.js";
import type { VersionAction } from "../../apply-release-plan/update-package-json.js";
import { readChangeDescriptions } from "../../change/read.js";
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
}

export async function bumpVersions(cwd: string, options?: BumpVersionOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);

  if (options?.prerelease) {
    await bumpPrereleaseVersion(
      host,
      workspace,
      options.prerelease === true ? DefaultPrereleaseTemplate : options.prerelease,
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

async function bumpPrereleaseVersion(host: ChronusHost, workspace: ChronusWorkspace, prereleaseTemplate: string) {
  const changesets = await readChangeDescriptions(host, workspace);
  const releasePlan = assembleReleasePlan(changesets, workspace);

  const changePerPackage = new Map<string, number>();
  for (const pkg of workspace.packages) {
    changePerPackage.set(pkg.name, 0);
  }

  for (const change of changesets) {
    for (const pkgName of change.packages) {
      const existing = changePerPackage.get(pkgName);
      if (existing !== undefined) {
        changePerPackage.set(pkgName, existing + 1);
      }
    }
  }

  const versionActions = new Map<string, VersionAction>();
  for (const pkg of workspace.packages) {
    const changeCount = changePerPackage.get(pkg.name) ?? 0;
    const action = releasePlan.actions.find((x) => x.packageName === pkg.name)!;
    const version = parse(pkg.version)!;

    const prereleaseVersion = interpolateTemplate(prereleaseTemplate, {
      changeCount,
      changeCountWithPatch: changeCount + version.patch,
      nextVersion: action.newVersion,
    });
    versionActions.set(pkg.name, { newVersion: prereleaseVersion });
  }

  const maxLength = workspace.packages.reduce((max, pkg) => Math.max(max, pkg.name.length), 0);
  for (const [pkgName, action] of versionActions) {
    log(`Bumping ${pc.magenta(pkgName.padEnd(maxLength))} to ${pc.cyan(action.newVersion)}`);
  }
  await updatePackageVersions(host, workspace, versionActions, "prerelease");
}

interface InterpolatePrereleaseVersionArgs {
  readonly changeCount: number;
  readonly changeCountWithPatch: number;
  readonly nextVersion: string;
}

function interpolateTemplate(template: string, args: InterpolatePrereleaseVersionArgs) {
  return template.replace(/{(\w+)}/g, (_, key) => {
    return String(args[key as keyof typeof args]);
  });
}

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
