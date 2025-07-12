import { describe, expect, it } from "vitest";
import type { ChangeDescription } from "../change/types.js";
import { addNameToChangeKinds, defaultChangeKinds } from "../config/resolve.js";
import type { ChronusResolvedConfig } from "../config/types.js";
import type { VersionType } from "../types.js";
import type { Package, PackageJson, Workspace } from "../workspace-manager/types.js";
import { createChronusWorkspace } from "../workspace/load.js";
import { assembleReleasePlan } from "./assemble-release-plan.js";

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
    mkPkg("pkg-a", {}),
    mkPkg("pkg-b", {}),
    mkPkg("pkg-c", {}),
    mkPkg("pkg-private-d", { private: true }),
    mkPkg("pkg-private-e", { private: true }),
  ]);

  const baseConfig: ChronusResolvedConfig = { workspaceRoot: "proj", baseBranch: "main", changeKinds };

  describe("bumps package independently", () => {
    it("only packages with changeset", () => {
      const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig));
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });
    describe("picks the heighest version type", () => {
      it("major", () => {
        const plan = assembleReleasePlan(
          [mkChange("pkg-a", "patch"), mkChange("pkg-a", "minor"), mkChange("pkg-a", "major")],
          createChronusWorkspace(workspace, baseConfig),
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "2.0.0" });
      });
      it("minor", () => {
        const plan = assembleReleasePlan(
          [mkChange("pkg-a", "patch"), mkChange("pkg-a", "minor")],
          createChronusWorkspace(workspace, baseConfig),
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      });
    });

    it("each package with changeset gets bumped accordingly", () => {
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "minor"), mkChange("pkg-b", "patch")],
        createChronusWorkspace(workspace, baseConfig),
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.0.1" });
    });

    describe("bumps dependencies", () => {
      it("if package depends on a package getting bumped and the version is incompatible it will also get bumped", () => {
        const workspace: Workspace = mkWorkspace([
          mkPkg("pkg-a", {}),
          mkPkg("pkg-b", { dependencies: { "pkg-a": "1.0.0" } }),
        ]);
        const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig));
        expect(plan.actions).toHaveLength(2);
        expect(plan.actions[0]).toMatchObject({
          packageName: "pkg-a",
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
        });
        expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.0.1" });
      });

      it("dependency with workspace: requirement are only bumped if the new version will be incompatible with last release", () => {
        const workspace: Workspace = mkWorkspace([
          mkPkg("pkg-a", {}),
          mkPkg("pkg-b", { dependencies: { "pkg-a": "workspace:~" } }),
          mkPkg("pkg-c", { dependencies: { "pkg-a": "workspace:^" } }),
        ]);
        const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig));
        expect(plan.actions).toHaveLength(2);
        expect(plan.actions[0]).toMatchObject({
          packageName: "pkg-a",
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
        });
        expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.0.1" });
      });
    });

    describe("prerelease version (x.y.z-foo.n) only increase the n regardless of the change type", () => {
      const prereleaseWorkspace = mkWorkspace([mkPkg("pkg-a", { version: "1.0.0-alpha.1" })]);
      it.each(["patch", "minor", "major"] as const)("%s", (type) => {
        const plan = assembleReleasePlan(
          [mkChange("pkg-a", type)],
          createChronusWorkspace(prereleaseWorkspace, baseConfig),
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({
          packageName: "pkg-a",
          oldVersion: "1.0.0-alpha.1",
          newVersion: "1.0.0-alpha.2",
        });
      });
    });

    it("doesn't include action if package only has none changes", () => {
      const workspace: Workspace = mkWorkspace([mkPkg("pkg-a", {})]);
      const plan = assembleReleasePlan([mkChange(["pkg-a"], "none")], createChronusWorkspace(workspace, baseConfig), {
        only: ["pkg-a"],
      });
      expect(plan.actions).toHaveLength(0);
    });
  });

  describe("lockStepVersioning", () => {
    const lockStepConfig: ChronusResolvedConfig = {
      ...baseConfig,
      versionPolicies: [{ name: "lockStep", type: "lockstep", step: "minor", packages: ["pkg-a", "pkg-b"] }],
    };

    it("bumps all packages in the lockstep if one changed", () => {
      const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, lockStepConfig));
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("bumps all packages in the lockstep of the step regardless of what changesets says (higher)", () => {
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "minor"), mkChange("pkg-a", "major")],
        createChronusWorkspace(workspace, lockStepConfig),
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("bumps all packages in the lockstep of the step regardless of what changesets says (lower)", () => {
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "patch"), mkChange("pkg-a", "patch")],
        createChronusWorkspace(workspace, lockStepConfig),
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("ignore policy when options.ignorePolicies: true", () => {
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "patch"), mkChange("pkg-c", "patch")],
        createChronusWorkspace(workspace, lockStepConfig),
        { ignorePolicies: true },
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.0.1" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-c", oldVersion: "1.0.0", newVersion: "1.0.1" });
    });
  });

  describe("ignoring packages", () => {
    it("package that have private: true will not get versioned even if a changelog exist", () => {
      const workspace: Workspace = mkWorkspace([
        mkPkg("pkg-private-b", { private: true }),
        mkPkg("pkg-private-c", { private: true }),
      ]);
      const plan = assembleReleasePlan(
        [mkChange("pkg-private-b", "minor")],
        createChronusWorkspace(workspace, baseConfig),
      );
      expect(plan.actions).toHaveLength(0);
    });

    it("package marked as ignore will also not get versioned even if a changelog exist", () => {
      const workspace = mkWorkspace([mkPkg("pkg-a", {})]);
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "minor")],
        createChronusWorkspace(workspace, { ...baseConfig, ignore: ["pkg-a"] }),
      );
      expect(plan.actions).toHaveLength(0);
    });

    it("package marked as private: true will not get versioned when a dependency need to change version", () => {
      const workspace: Workspace = mkWorkspace([
        mkPkg("pkg-a", {}),
        mkPkg("pkg-private-b", { private: true, dependencies: { "pkg-a": "1.0.0" } }),
      ]);
      const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig));
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });
  });

  describe("partial release plan using only option", () => {
    it("ignore other packages with changes", () => {
      const workspace: Workspace = mkWorkspace([mkPkg("pkg-a", {}), mkPkg("pkg-b", {})]);
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "minor"), mkChange("pkg-b", "minor")],
        createChronusWorkspace(workspace, baseConfig),
        { only: ["pkg-a"] },
      );
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("ignore packages that would need to be bumped as dependent", () => {
      const workspace: Workspace = mkWorkspace([
        mkPkg("pkg-a", {}),
        mkPkg("pkg-b", { dependencies: { "pkg-a": "1.0.0" } }),
      ]);
      const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig), {
        only: ["pkg-a"],
      });
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("report changes as fully used if bumping all packages tagged in it", () => {
      const workspace: Workspace = mkWorkspace([mkPkg("pkg-a", {}), mkPkg("pkg-b", {}), mkPkg("pkg-c", {})]);
      const plan = assembleReleasePlan(
        [mkChange(["pkg-a", "pkg-b"], "minor")],
        createChronusWorkspace(workspace, baseConfig),
        {
          only: ["pkg-a", "pkg-b"],
        },
      );
      expect(plan.changes).toHaveLength(1);
      expect(plan.changes[0]).toMatchObject({ usage: "used", packages: ["pkg-a", "pkg-b"] });
    });
    it("report changes as partially used if only bumping some packages tagged in it", () => {
      const workspace: Workspace = mkWorkspace([mkPkg("pkg-a", {}), mkPkg("pkg-b", {})]);
      const plan = assembleReleasePlan(
        [mkChange(["pkg-a", "pkg-b"], "minor")],
        createChronusWorkspace(workspace, baseConfig),
        {
          only: ["pkg-a"],
        },
      );
      expect(plan.changes).toHaveLength(1);
      expect(plan.changes[0]).toMatchObject({ usage: "partial", packages: ["pkg-a"] });
    });
  });

  describe("partial release plan using exclude option", () => {
    it("ignore packages with changes", () => {
      const workspace: Workspace = mkWorkspace([mkPkg("pkg-a", {}), mkPkg("pkg-b", {})]);
      const plan = assembleReleasePlan(
        [mkChange("pkg-a", "minor"), mkChange("pkg-b", "minor")],
        createChronusWorkspace(workspace, baseConfig),
        { exclude: ["pkg-b"] },
      );
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("ignore packages that would need to be bumped as dependent", () => {
      const workspace: Workspace = mkWorkspace([
        mkPkg("pkg-a", {}),
        mkPkg("pkg-b", { dependencies: { "pkg-a": "1.0.0" } }),
      ]);
      const plan = assembleReleasePlan([mkChange("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig), {
        exclude: ["pkg-b"],
      });
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("report changes as partially used if only bumping some packages tagged in it", () => {
      const workspace: Workspace = mkWorkspace([mkPkg("pkg-a", {}), mkPkg("pkg-b", {})]);
      const plan = assembleReleasePlan(
        [mkChange(["pkg-a", "pkg-b"], "minor")],
        createChronusWorkspace(workspace, baseConfig),
        {
          exclude: ["pkg-b"],
        },
      );
      expect(plan.changes).toHaveLength(1);
      expect(plan.changes[0]).toMatchObject({ usage: "partial", packages: ["pkg-a"] });
    });
  });
});
