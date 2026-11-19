import pc from "picocolors";
import { parse } from "semver";

import { getChangesetRequirementExemption } from "../../change/changeset-requirement.js";
import { resolveChangePath } from "../../change/common.js";
import { findChangeStatus } from "../../change/find.js";
import { readChangeDescriptions } from "../../change/read.js";
import { resolveConfig } from "../../config/resolve.js";
import { createGitSourceControl } from "../../source-control/git.js";
import { throwIfDiagnostic, type Diagnostic } from "../../utils/errors.js";
import { isPathAccessible } from "../../utils/fs-utils.js";
import { NodeChronusHost } from "../../utils/node-host.js";
import { resolvePath } from "../../utils/path-utils.js";
import { getWorkspaceManager, hasPackageManifest, loadPackages } from "../../workspace-manager/auto-discover.js";
import { loadChronusWorkspace } from "../../workspace/load.js";

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}

export interface VerifyChangesetOptions {
  readonly cwd: string;
  readonly since?: string;
}
export async function verifyChangeset({ cwd, since }: VerifyChangesetOptions): Promise<void> {
  const host = NodeChronusHost;
  const workspace = await loadChronusWorkspace(host, cwd);
  const changes = await readChangeDescriptions(host, workspace);
  const git = createGitSourceControl(workspace.path);
  const base =
    since !== undefined
      ? await git.getMergeBase(since)
      : await git.getMergeBaseFromBase(workspace.config.baseBranch, workspace.config.baseRemote);
  const baseHost = await git.getHostAtRef(base);
  const hasBaseConfig = await isPathAccessible(baseHost, resolvePath(workspace.path, ".chronus/config.yaml"));
  const baseConfig = hasBaseConfig ? await resolveConfig(baseHost, workspace.path) : workspace.config;
  const basePackageConfigs = [];
  for (const config of baseConfig.resolvedPackages) {
    const sourcePath = resolvePath(workspace.path, config.path);
    if (config.path.includes("*")) {
      basePackageConfigs.push(config);
      continue;
    }
    if (!(await isPathAccessible(baseHost, sourcePath))) continue;
    if (hasBaseConfig) {
      basePackageConfigs.push(config);
      continue;
    }
    const ecosystem = await getWorkspaceManager(host, sourcePath, config.type);
    if (await hasPackageManifest(baseHost, sourcePath, ecosystem.type)) {
      basePackageConfigs.push({ ...config, type: ecosystem.type });
    }
  }
  const basePackages = new Map(
    (await loadPackages(baseHost, workspace.path, basePackageConfigs)).map((pkg) => [pkg.name, pkg]),
  );
  const releasedPackages = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  for (const pkg of workspace.packages) {
    const version = parse(pkg.version);
    if (version === null) {
      diagnostics.push({
        code: "invalid-package-version",
        severity: "error",
        message: `Package '${pkg.name}' has an invalid version '${pkg.version}'.`,
        target: null,
      });
      continue;
    }

    const previous = basePackages.get(pkg.name);
    if (previous === undefined || previous.version === pkg.version) {
      continue;
    }
    releasedPackages.add(pkg.name);

    if (version.prerelease.length > 0) {
      continue;
    }

    for (const change of changes.filter((change) => change.packages.includes(pkg.name))) {
      const file = await host.readFile(resolveChangePath(workspace, change.id));
      diagnostics.push({
        code: "unconsumed-changeset",
        severity: "error",
        message: `Package '${pkg.name}' changed version from '${previous.version}' to '${pkg.version}', but changeset '${change.id}' still references it. Apply the pending changes with 'chronus version' before releasing.`,
        target: { file, pos: 0, end: 0 },
      });
    }
  }

  throwIfDiagnostic(diagnostics);

  const status = await findChangeStatus(host, git, workspace, { since: base });
  const exemption = await getChangesetRequirementExemption(workspace);
  if (exemption !== undefined) {
    log(pc.yellow(`Skipping new changeset requirement: ${exemption}.`));
    return;
  }

  const undocumentedPackages = [...status.packages.values()].filter(
    (x) => x.changed && !x.documented && !releasedPackages.has(x.package.name),
  );
  throwIfDiagnostic(
    undocumentedPackages.map(
      (pkg): Diagnostic => ({
        code: "undocumented-package",
        severity: "error",
        message: `Package '${pkg.package.name}' has changes but no changeset. Run 'chronus add' to document them.`,
        target: null,
      }),
    ),
  );

  const documentedPackages = [...status.packages.values()].filter(
    (x) => x.changed && (x.documented || releasedPackages.has(x.package.name)),
  );
  log(pc.green("All changed packages have been documented:"));
  for (const pkg of documentedPackages) {
    log(pc.green(` - ${pkg.package.name}`));
  }
}
