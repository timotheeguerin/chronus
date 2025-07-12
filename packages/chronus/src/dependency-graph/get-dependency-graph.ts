import { Range } from "semver";
import { ChronusError } from "../utils/errors.js";
import type { Package, PackageJson } from "../workspace-manager/node/types.js";

const DEPENDENCY_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

const getAllDependencies = (config: PackageJson) => {
  const allDependencies = new Map<string, string>();

  for (const type of DEPENDENCY_TYPES) {
    const deps = config[type];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      const depRange = deps[name];
      if ((depRange.startsWith("link:") || depRange.startsWith("file:")) && type === "devDependencies") {
        continue;
      }

      allDependencies.set(name, depRange);
    }
  }

  return allDependencies;
};

const isProtocolRange = (range: string) => range.indexOf(":") !== -1;

const getValidRange = (potentialRange: string) => {
  if (isProtocolRange(potentialRange)) {
    return null;
  }

  try {
    return new Range(potentialRange);
  } catch {
    return null;
  }
};

export function getDependencyGraph(
  packages: Package[],
  opts?: {
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  },
): {
  graph: Map<string, { pkg: Package; dependencies: string[] }>;
  valid: boolean;
} {
  const graph = new Map<string, { pkg: Package; dependencies: string[] }>();
  let valid = true;

  const packagesByName: { [key: string]: Package } = {};

  const queue = [];

  for (const pkg of packages) {
    queue.push(pkg);
    packagesByName[pkg.name] = pkg;
  }

  for (const pkg of queue) {
    const { name } = pkg;
    const dependencies = [];
    const allDependencies = getAllDependencies(pkg.manifest);

    for (const [depName, originalDepRange] of allDependencies) {
      let repRange = originalDepRange;
      const match = packagesByName[depName];
      if (!match) continue;

      const expected = match.version;
      const usesWorkspaceRange = originalDepRange.startsWith("workspace:");

      if (usesWorkspaceRange) {
        repRange = originalDepRange.replace(/^workspace:/, "");

        if (repRange === "*" || repRange === "^" || repRange === "~") {
          dependencies.push(depName);
          continue;
        }
      } else if (opts?.bumpVersionsWithWorkspaceProtocolOnly === true) {
        continue;
      }

      const range = getValidRange(repRange);

      if (((range && !range.test(expected)) || isProtocolRange(repRange)) && usesWorkspaceRange) {
        valid = false;
        throw new ChronusError(
          `Package "${name}" must depend on the current version of "${depName}": "${expected}" vs "${originalDepRange}"`,
        );
        continue;
      }

      // `depRange` could have been a tag and if a tag has been used there might have been a reason for that
      // we should not count this as a local monorepro dependant
      if (!range) {
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, { pkg, dependencies });
  }
  return { graph, valid };
}
