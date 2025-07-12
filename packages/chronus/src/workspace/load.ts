import micromatch from "micromatch";
import { resolveConfig } from "../config/index.js";
import type { ChronusResolvedConfig, VersionPolicy } from "../config/types.js";
import { ChronusError, throwIfDiagnostic, type Diagnostic } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { loadWorkspace } from "../workspace-manager/auto-discover.js";
import type { Package, Workspace } from "../workspace-manager/node/types.js";
import { findPackagesFromPattern } from "../workspace-manager/node/utils.js";
import { getLocationInYamlScript } from "../yaml/location.js";
import type { ChronusPackage, ChronusPackageState, ChronusWorkspace } from "./types.js";

function getPackageState(config: ChronusResolvedConfig, pkg: Package): ChronusPackageState {
  if (config.ignore && config.ignore.some((x) => micromatch.isMatch(pkg.name, x))) {
    return "ignored";
  }
  if (pkg.manifest.private) {
    return "private";
  }
  return "versioned";
}

export async function loadChronusWorkspace(host: ChronusHost, dir: string): Promise<ChronusWorkspace> {
  const config = await resolveConfig(host, dir);
  const additionalPackages: Package[] = await loadStandalonePackages(host, config);
  const workspace: Workspace = await loadWorkspace(host, config.workspaceRoot, config.workspaceType);
  validateConfigWithWorkspace(config, workspace, additionalPackages);
  return createChronusWorkspace(workspace, config, additionalPackages);
}

/** Any packages that do not belong to the namespace but are referenced in the config */
async function loadStandalonePackages(host: ChronusHost, config: ChronusResolvedConfig) {
  return config.additionalPackages
    ? await findPackagesFromPattern(host, config.workspaceRoot, config.additionalPackages)
    : [];
}

function validateConfigWithWorkspace(
  config: ChronusResolvedConfig,
  workspace: Workspace,
  additionalPackages: Package[],
): void {
  const diagnostics: Diagnostic[] = [];
  if (config.versionPolicies) {
    for (const [policyIndex, policy] of config.versionPolicies.entries()) {
      for (const [pkgIndex, pkgName] of policy.packages.entries()) {
        if (
          !workspace.packages.some((pkg) => pkg.name === pkgName) &&
          !additionalPackages.some((pkg) => pkg.name === pkgName)
        ) {
          diagnostics.push({
            code: "package-not-found",
            message: `Package '${pkgName}' is not found in workspace`,
            severity: "error",
            target: config.source
              ? getLocationInYamlScript(config.source, ["versionPolicies", policyIndex, "packages", pkgIndex])
              : null,
          });
        }
      }
    }
  }

  throwIfDiagnostic(diagnostics);
}

export function createChronusWorkspace(
  workspace: Workspace,
  config: ChronusResolvedConfig,
  additionalPackages: Package[] = [],
): ChronusWorkspace {
  const policyPerPackage = new Map<string, VersionPolicy>();
  for (const policy of config.versionPolicies ?? []) {
    for (const pkg of policy.packages) {
      policyPerPackage.set(pkg, policy);
    }
  }
  const defaultPolicy: VersionPolicy = {
    name: "_default",
    type: "independent",
    packages: [],
  };
  const chronusPackages = [
    ...workspace.packages.map((pkg): ChronusPackage => {
      return {
        ...pkg,
        state: getPackageState(config, pkg),
        policy: policyPerPackage.get(pkg.name) ?? defaultPolicy,
      };
    }),
    ...additionalPackages.map((pkg): ChronusPackage => {
      return {
        ...pkg,
        state: "standalone",
        policy: policyPerPackage.get(pkg.name) ?? defaultPolicy,
      };
    }),
  ];
  const map = new Map<string, ChronusPackage>(chronusPackages.map((pkg) => [pkg.name, pkg]));
  return {
    path: config.workspaceRoot,
    workspace,
    packages: chronusPackages.filter(
      (pkg): pkg is ChronusPackage & { ignored: false } => pkg.state === "versioned" || pkg.state === "standalone",
    ),
    allPackages: chronusPackages,
    config,
    getPackage: (packageName: string) => {
      const value = map.get(packageName);
      if (value === undefined) {
        throw new ChronusError(`Could not find package '${packageName}'`);
      }
      return value;
    },
  };
}
