import type { Changeset } from "@changesets/types";
import { getDependentsGraph } from "../dependency-graph/index.js";
import type { Package, Workspace } from "../workspace-manager/types.js";
import applyLinks from "./apply-links.js";
import determineDependents from "./determine-dependents.js";
import { incrementVersion } from "./increment-version.js";
import { matchFixedConstraint } from "./match-fixed-constraints.js";
import type { InternalRelease } from "./types.internal.js";
import type { ReleaseAction, ReleasePlan } from "./types.js";

export function assembleReleasePlan(changesets: Changeset[], workspace: Workspace): ReleasePlan {
  const packagesByName = new Map(workspace.packages.map((pkg) => [pkg.name, pkg]));
  const releases = flattenReleases(changesets, packagesByName, []);
  console.log("release", releases);

  const dependentsGraph = getDependentsGraph(workspace.packages);
  console.log("dependentsGraph", dependentsGraph);

  let releasesValidated = false;
  while (releasesValidated === false) {
    // The map passed in to determineDependents will be mutated
    const dependentAdded = determineDependents({
      releases,
      packagesByName,
      dependentsGraph,
    });

    // `releases` might get mutated here
    const fixedConstraintUpdated = matchFixedConstraint(releases, packagesByName, [
      [
        "@typespec/compiler",
        "@typespec/http",
        "@typespec/versioning",
        "@typespec/rest",
        "@typespec/openapi",
        "@typespec/openapi3",
        "@typespec/protobuf",
        "@typespec/prettier-plugin-typespec",
        "@typespec/eslint-config-typespec",
        "@typespec/eslint-plugin",
        "@typespec/html-program-viewer",
        "@typespec/json-schema",
        "@typespec/internal-build-utils",
        "typespec-vs",
        "typespec-vscode",
        "@typespec/library-linter",
      ],
    ]);
    // const fixedConstraintUpdated = matchFixedConstraint(releases, packagesByName, refinedConfig);
    const linksUpdated = applyLinks(releases, packagesByName, []);

    releasesValidated = !linksUpdated && !dependentAdded && !fixedConstraintUpdated;
  }

  const actions = [...releases.values()].map((incompleteRelease): ReleaseAction => {
    return {
      ...incompleteRelease,
      newVersion: getNewVersion(incompleteRelease),
    };
  });

  console.log("New versions", actions);

  return {
    actions,
  };
}

function flattenReleases(
  changesets: Changeset[],
  packagesByName: Map<string, Package>,
  ignoredPackages: Readonly<string[]>,
): Map<string, InternalRelease> {
  const releases: Map<string, InternalRelease> = new Map();

  changesets.forEach((changeset) => {
    changeset.releases
      // Filter out ignored packages because they should not trigger a release
      // If their dependencies need updates, they will be added to releases by `determineDependents()` with release type `none`
      .filter(({ name }) => !ignoredPackages.includes(name))
      .forEach(({ name, type }) => {
        let release: InternalRelease | undefined = releases.get(name);
        const pkg = packagesByName.get(name);
        if (!pkg) {
          throw new Error(
            `"${changeset}" changeset mentions a release for a package "${name}" but such a package could not be found.`,
          );
        }
        if (!release) {
          release = {
            packageName: name,
            type,
            oldVersion: pkg.version,
          };
        } else {
          if (
            type === "major" ||
            ((release.type === "patch" || release.type === "none") && (type === "minor" || type === "patch"))
          ) {
            release.type = type;
          }
        }

        releases.set(name, release);
      });
  });

  return releases;
}

function getNewVersion(release: InternalRelease): string {
  if (release.type === "none") {
    return release.oldVersion;
  }

  return incrementVersion(release);
}
