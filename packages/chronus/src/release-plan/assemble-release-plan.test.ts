import type { NewChangeset, VersionType } from "@changesets/types";
import { describe, expect, it } from "vitest";
import type { ChronusConfig } from "../config/types.js";
import type { Workspace } from "../workspace-manager/types.js";
import { assembleReleasePlan } from "./assemble-release-plan.js";

describe("Assemble Release Plan", () => {
  let idCounter = 0;
  function makeChangeset(pkg: string, type: VersionType): NewChangeset {
    const id = String(idCounter++);
    return { id, summary: `Changeset ${id}`, releases: [{ name: pkg, type }] };
  }
  const workspace: Workspace = {
    path: "/",
    packages: [
      { name: "pkg-a", manifest: {}, relativePath: "packages/pkg-a", version: "1.0.0" },
      { name: "pkg-b", manifest: {}, relativePath: "packages/pkg-b", version: "1.0.0" },
      { name: "pkg-c", manifest: {}, relativePath: "packages/pkg-c", version: "1.0.0" },
    ],
  };

  const baseConfig: ChronusConfig = { baseBranch: "main" };

  describe("bumps package independently", () => {
    it("only packages with changeset ", () => {
      const plan = assembleReleasePlan([makeChangeset("pkg-a", "minor")], workspace, baseConfig);
      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    describe("picks the heighest version type", () => {
      it("major", () => {
        const plan = assembleReleasePlan(
          [makeChangeset("pkg-a", "patch"), makeChangeset("pkg-a", "minor"), makeChangeset("pkg-a", "major")],
          workspace,
          baseConfig,
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "2.0.0" });
      });
      it("minor", () => {
        const plan = assembleReleasePlan(
          [makeChangeset("pkg-a", "patch"), makeChangeset("pkg-a", "minor")],
          workspace,
          baseConfig,
        );
        expect(plan.actions).toHaveLength(1);
        expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      });
    });

    it("each package with changeset gets bumped accordingly", () => {
      const plan = assembleReleasePlan(
        [makeChangeset("pkg-a", "minor"), makeChangeset("pkg-b", "patch")],
        workspace,
        baseConfig,
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.0.1" });
    });
  });

  describe("lockStepVersioning", () => {
    const lockStepConfig: ChronusConfig = {
      ...baseConfig,
      versionPolicies: [{ name: "lockStep", type: "lockstep", step: "minor", packages: ["pkg-a", "pkg-b"] }],
    };

    it("bumps all packages in the lockstep if one changed", () => {
      const plan = assembleReleasePlan([makeChangeset("pkg-a", "minor")], workspace, lockStepConfig);
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("bumps all packages in the lockstep of the step regardless of what changesets says (higher)", () => {
      const plan = assembleReleasePlan(
        [makeChangeset("pkg-a", "minor"), makeChangeset("pkg-a", "major")],
        workspace,
        lockStepConfig,
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("bumps all packages in the lockstep of the step regardless of what changesets says (lower)", () => {
      const plan = assembleReleasePlan(
        [makeChangeset("pkg-a", "patch"), makeChangeset("pkg-a", "patch")],
        workspace,
        lockStepConfig,
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.1.0" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-b", oldVersion: "1.0.0", newVersion: "1.1.0" });
    });

    it("ignore policy when options.ignorePolicies: true", () => {
      const plan = assembleReleasePlan(
        [makeChangeset("pkg-a", "patch"), makeChangeset("pkg-c", "patch")],
        workspace,
        lockStepConfig,
        { ignorePolicies: true },
      );
      expect(plan.actions).toHaveLength(2);
      expect(plan.actions[0]).toMatchObject({ packageName: "pkg-a", oldVersion: "1.0.0", newVersion: "1.0.1" });
      expect(plan.actions[1]).toMatchObject({ packageName: "pkg-c", oldVersion: "1.0.0", newVersion: "1.0.1" });
    });
  });
});
