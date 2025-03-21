import { describe, expect, it } from "vitest";
import type { ChangeDescription } from "../change/types.js";
import { addNameToChangeKinds, defaultChangeKinds } from "../config/resolve.js";
import type { ChronusResolvedConfig } from "../config/types.js";
import type { VersionType } from "../types.js";
import type { Package, PackageJson, Workspace } from "../workspace-manager/types.js";
import { createChronusWorkspace } from "../workspace/load.js";
import { getPrereleaseVersionActions } from "./prerelease-versioning.js";

describe("Assemble Release Plan", () => {
  let idCounter = 0;
  const changeKinds = addNameToChangeKinds(defaultChangeKinds);
  function mkChange(pkg: string | string[], type: VersionType): ChangeDescription {
    const id = String(idCounter++);
    return {
      id,
      content: `Changeset ${id}`,
      changeKind: changeKinds[type],
      packages: Array.isArray(pkg) ? pkg : [pkg],
    };
  }

  function mkWorkspace(packages: Package[]): Workspace {
    return { type: "pnpm", path: "/", packages };
  }
  function mkPkg(name: string, manifest: PackageJson): Package {
    const version = manifest.version ?? "1.0.0";
    return { name, manifest: { ...manifest, version }, relativePath: `packages/${name}`, version };
  }
  const workspace: Workspace = mkWorkspace([
    mkPkg("pkg-a", { version: "1.0.0" }),
    mkPkg("pkg-b", { version: "1.0.3" }),
    mkPkg("pkg-c", { version: "1.0.0" }),
  ]);

  const baseConfig: ChronusResolvedConfig = { workspaceRoot: "proj", baseBranch: "main", changeKinds };

  describe("interpolate nextVersion", () => {
    it.each([
      ["major", "2.0.0"],
      ["minor", "1.1.0"],
      ["patch", "1.0.1"],
    ] as const)("%s", async (type, nextVersion) => {
      const res = await getPrereleaseVersionActions(
        [mkChange(["pkg-a"], type)],
        createChronusWorkspace(workspace, baseConfig),
        "{nextVersion}-dev.{changeCount}",
      );

      expect(res.get("pkg-a")?.newVersion).toBe(`${nextVersion}-dev.1`);
    });
  });

  it("interpolate changeCountWithPatch", async () => {
    const res = await getPrereleaseVersionActions(
      [mkChange(["pkg-a"], "major")],
      createChronusWorkspace(workspace, baseConfig),
      "{nextVersion}-dev.{changeCountWithPatch}",
    );

    expect(res.size).toBe(3);
    expect(res.get("pkg-a")?.newVersion).toBe("2.0.0-dev.1");
    expect(res.get("pkg-b")?.newVersion).toBe("1.0.4-dev.3");
    expect(res.get("pkg-c")?.newVersion).toBe("1.0.1-dev.0");
  });

  it("interpolate changeCount", async () => {
    const res = await getPrereleaseVersionActions(
      [mkChange(["pkg-a"], "major"), mkChange(["pkg-a"], "minor")],
      createChronusWorkspace(workspace, baseConfig),
      "{nextVersion}-dev.{changeCount}",
    );

    expect(res.size).toBe(3);
    expect(res.get("pkg-a")?.newVersion).toBe("2.0.0-dev.2");
    expect(res.get("pkg-b")?.newVersion).toBe("1.0.4-dev.0");
    expect(res.get("pkg-c")?.newVersion).toBe("1.0.1-dev.0");
  });

  it("respect filters", async () => {
    const res = await getPrereleaseVersionActions(
      [mkChange(["pkg-a"], "minor"), mkChange(["pkg-b"], "minor")],
      createChronusWorkspace(workspace, baseConfig),
      "{nextVersion}-dev.{changeCount}",
      { only: ["pkg-a"] },
    );

    expect(res.size).toBe(1);
    expect(res.get("pkg-a")?.newVersion).toBe("1.1.0-dev.1");
  });
});
