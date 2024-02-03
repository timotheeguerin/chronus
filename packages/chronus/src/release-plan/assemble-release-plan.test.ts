import type { NewChangeset, VersionType } from "@changesets/types";
import { describe, expect, it } from "vitest";
import type { ChronusResolvedConfig } from "../config/types.js";
import type { Package, PackageJson, Workspace } from "../workspace-manager/types.js";
import { createChronusWorkspace } from "../workspace/load.js";
import { assembleReleasePlan } from "./assemble-release-plan.js";

describe("Assemble Release Plan", () => {
  let idCounter = 0;
  function mkChangeset(pkg: string, type: VersionType): NewChangeset {
    const id = String(idCounter++);
    return { id, summary: `Changeset ${id}`, releases: [{ name: pkg, type }] };
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

  const baseConfig: ChronusResolvedConfig = { workspaceRoot: "proj", baseBranch: "main" };

  describe("bumps package independently", () => {
    it("only packages with changeset ", () => {
      const plan = assembleReleasePlan([mkChangeset("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig));
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });
    describe("picks the heighest version type", () => {
      it("major", () => {
        const plan = assembleReleasePlan(
          [mkChangeset("pkg-a", "patch"), mkChangeset("pkg-a", "minor"), mkChangeset("pkg-a", "major")],
          createChronusWorkspace(workspace, baseConfig),
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "2.0.0" });
      });
      it("minor", () => {
        const plan = assembleReleasePlan(
          [mkChangeset("pkg-a", "patch"), mkChangeset("pkg-a", "minor")],
          createChronusWorkspace(workspace, baseConfig),
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      });
    });

    it("each package with changeset gets bumped accordingly", () => {
      const plan = assembleReleasePlan(
        [mkChangeset("pkg-a", "minor"), mkChangeset("pkg-b", "patch")],
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
        const plan = assembleReleasePlan(
          [mkChangeset("pkg-a", "minor")],
          createChronusWorkspace(workspace, baseConfig),
        );
        expect(plan.actions).toHaveLength(2);
        expect(plan.actions[0]).toMatchObject({
          packageName: "pkg-a",
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
        });
        expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.0.1" });
      });
    });
  });

  describe("lockStepVersioning", () => {
    const lockStepConfig: ChronusResolvedConfig = {
      ...baseConfig,
      versionPolicies: [{ name: "lockStep", type: "lockstep", step: "minor", packages: ["pkg-a", "pkg-b"] }],
    };

    it("bumps all packages in the lockstep if one changed", () => {
      const plan = assembleReleasePlan(
        [mkChangeset("pkg-a", "minor")],
        createChronusWorkspace(workspace, lockStepConfig),
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("bumps all packages in the lockstep of the step regardless of what changesets says (higher)", () => {
      const plan = assembleReleasePlan(
        [mkChangeset("pkg-a", "minor"), mkChangeset("pkg-a", "major")],
        createChronusWorkspace(workspace, lockStepConfig),
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("bumps all packages in the lockstep of the step regardless of what changesets says (lower)", () => {
      const plan = assembleReleasePlan(
        [mkChangeset("pkg-a", "patch"), mkChangeset("pkg-a", "patch")],
        createChronusWorkspace(workspace, lockStepConfig),
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("ignore policy when options.ignorePolicies: true", () => {
      const plan = assembleReleasePlan(
        [mkChangeset("pkg-a", "patch"), mkChangeset("pkg-c", "patch")],
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
        [mkChangeset("pkg-private-b", "minor")],
        createChronusWorkspace(workspace, baseConfig),
      );
      expect(plan.actions).toHaveLength(0);
    });

    it("package marked as ignore will also not get versioned even if a changelog exist", () => {
      const workspace = mkWorkspace([mkPkg("pkg-a", {})]);
      const plan = assembleReleasePlan(
        [mkChangeset("pkg-a", "minor")],
        createChronusWorkspace(workspace, { ...baseConfig, ignore: ["pkg-a"] }),
      );
      expect(plan.actions).toHaveLength(0);
    });

    it("package marked as private: true will not get versioned when a dependency need to change version", () => {
      const workspace: Workspace = mkWorkspace([
        mkPkg("pkg-a", {}),
        mkPkg("pkg-private-b", { private: true, dependencies: { "pkg-a": "1.0.0" } }),
      ]);
      const plan = assembleReleasePlan([mkChangeset("pkg-a", "minor")], createChronusWorkspace(workspace, baseConfig));
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });
  });
});
