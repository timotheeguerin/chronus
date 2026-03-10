import { describe, expect, it } from "vitest";
import { addNameToChangeKinds, defaultChangeKinds } from "../config/resolve.js";
import type { ChronusResolvedConfig } from "../config/types.js";
import { createPackageFromPackageJson } from "../workspace-manager/node/utils.js";
import type { Package, PackageJson } from "../workspace-manager/types.js";
import { createChronusWorkspace } from "../workspace/load.js";
import { getManifestPatchRequest, type VersionAction } from "./get-manifest-patch-request.js";

const changeKinds = addNameToChangeKinds(defaultChangeKinds);

function mkPkg(name: string, manifest: PackageJson, options?: { standalone?: boolean }): Package {
  const version = manifest.version ?? "1.0.0";
  return {
    relativePath: `packages/${name}`,
    standalone: options?.standalone,
    ...createPackageFromPackageJson({ ...manifest, name, version }, "npm"),
  };
}

const baseConfig: ChronusResolvedConfig = {
  workspaceRoot: "proj",
  baseBranch: "main",
  changeKinds,
  resolvedPackages: [{ path: "." }],
};

describe("getManifestPatchRequest", () => {
  it("updates dependency versions for versioned packages", () => {
    const packages: Package[] = [
      mkPkg("pkg-a", {}),
      mkPkg("pkg-b", { dependencies: { "pkg-a": "1.0.0" } }),
    ];
    const workspace = createChronusWorkspace(packages, baseConfig);
    const actions = new Map<string, VersionAction>([["pkg-a", { newVersion: "2.0.0" }]]);
    const patch = getManifestPatchRequest(workspace, workspace.getPackage("pkg-b"), actions);
    expect(patch.dependenciesVersions["pkg-a"]).toBe("2.0.0");
  });

  it("does not update dependency versions for standalone packages", () => {
    const packages: Package[] = [
      mkPkg("pkg-a", {}),
      mkPkg("pkg-b", { dependencies: { "pkg-a": "1.0.0" } }, { standalone: true }),
    ];
    const workspace = createChronusWorkspace(packages, baseConfig);
    const actions = new Map<string, VersionAction>([["pkg-a", { newVersion: "2.0.0" }]]);
    const patch = getManifestPatchRequest(workspace, workspace.getPackage("pkg-b"), actions);
    expect(patch.dependenciesVersions).toEqual({});
  });

  it("still bumps version for standalone packages that have an action", () => {
    const packages: Package[] = [
      mkPkg("pkg-a", {}),
      mkPkg("pkg-b", { dependencies: { "pkg-a": "1.0.0" } }, { standalone: true }),
    ];
    const workspace = createChronusWorkspace(packages, baseConfig);
    const actions = new Map<string, VersionAction>([
      ["pkg-a", { newVersion: "2.0.0" }],
      ["pkg-b", { newVersion: "1.1.0" }],
    ]);
    const patch = getManifestPatchRequest(workspace, workspace.getPackage("pkg-b"), actions);
    expect(patch.newVersion).toBe("1.1.0");
    expect(patch.dependenciesVersions).toEqual({});
  });
});
