import type { PackageDependencySpec } from "./types.js";

export type DependencyEntry = [string, PackageDependencySpec];

/**
 * Build the dependency map for a package from the per-kind dependency lists.
 *
 * A package can declare the same dependency in multiple lists(e.g. both as a `peerDependency` and a
 * `devDependency` so it can be resolved when building/testing). The map is keyed by name so only one
 * spec can win: a `prod` spec always takes precedence over a `dev` one, regardless of the order the
 * lists are passed in. Picking `dev` there would hide a real dependency from the release plan and the
 * dependent would never get bumped when the dependency makes a breaking change.
 */
export function createDependencyMap(...entryLists: DependencyEntry[][]): Map<string, PackageDependencySpec> {
  const map = new Map<string, PackageDependencySpec>();
  for (const entries of entryLists) {
    for (const [name, spec] of entries) {
      const existing = map.get(name);
      if (existing && existing.kind === "prod" && spec.kind === "dev") {
        continue;
      }
      map.set(name, spec);
    }
  }
  return map;
}
