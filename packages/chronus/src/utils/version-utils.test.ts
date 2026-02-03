import { describe, expect, it } from "vitest";
import type { LockstepVersionPolicy } from "../config/types.js";
import type { ChronusWorkspace } from "../index.js";
import type { VersionType } from "../types.js";
import { createChronusWorkspace } from "../workspace/load.js";
import { resolveCurrentLockStepVersion } from "./version-utils.js";

describe("resolveCurrentLockStepVersion()", () => {
  function mkWorkspace(packages: Record<string, string>): ChronusWorkspace {
    const workspacePackages = Object.entries(packages).map(([name, version]) => {
      return { name, manifest: { version }, relativePath: `packages/${name}`, version };
    });
    return createChronusWorkspace(workspacePackages as any, { workspaceRoot: "/" } as any);
  }

  function mkLockStepPolicy(step: Omit<VersionType, "none">): LockstepVersionPolicy {
    return {
      type: "lockstep",
      name: "policy",
      packages: ["pkg-a", "pkg-b", "pkg-c"],
      step,
    };
  }

  it("picks the same version all packages in the policy have", () => {
    const workspace = mkWorkspace({
      "pkg-a": "1.1.0",
      "pkg-b": "1.1.0",
      "pkg-c": "1.1.0",
      "pkg-d": "1.4.0",
    });

    expect(resolveCurrentLockStepVersion(workspace, mkLockStepPolicy("minor"))).toEqual("1.1.0");
  });

  describe("when version don't match", () => {
    it("pick the latest", () => {
      const workspace = mkWorkspace({
        "pkg-a": "1.2.0",
        "pkg-b": "1.1.0",
        "pkg-c": "1.3.0",
        "pkg-d": "1.4.0",
      });

      expect(resolveCurrentLockStepVersion(workspace, mkLockStepPolicy("minor"))).toEqual("1.3.0");
    });
  });

  describe("when version was bumped outside of lock step policy", () => {
    it("when step is 'patch' drops prerelease-info", () => {
      const workspace = mkWorkspace({
        "pkg-a": "1.1.1-alpha.1",
        "pkg-b": "1.1.1-alpha.1",
        "pkg-c": "1.1.1-alpha.1",
        "pkg-d": "1.4.0",
      });

      expect(resolveCurrentLockStepVersion(workspace, mkLockStepPolicy("patch"))).toEqual("1.1.1");
    });

    it("when step is 'patch' keeps patch version", () => {
      const workspace = mkWorkspace({
        "pkg-a": "1.1.1",
        "pkg-b": "1.1.1",
        "pkg-c": "1.1.1",
        "pkg-d": "1.4.0",
      });

      expect(resolveCurrentLockStepVersion(workspace, mkLockStepPolicy("patch"))).toEqual("1.1.1");
    });

    it("when step is 'minor' drop patch", () => {
      const workspace = mkWorkspace({
        "pkg-a": "1.1.1",
        "pkg-b": "1.1.1",
        "pkg-c": "1.1.1",
        "pkg-d": "1.4.0",
      });

      expect(resolveCurrentLockStepVersion(workspace, mkLockStepPolicy("minor"))).toEqual("1.1.0");
    });

    it("when step is 'major' drop patch and minor", () => {
      const workspace = mkWorkspace({
        "pkg-a": "1.1.1",
        "pkg-b": "1.1.1",
        "pkg-c": "1.1.1",
        "pkg-d": "1.4.0",
      });

      expect(resolveCurrentLockStepVersion(workspace, mkLockStepPolicy("major"))).toEqual("1.0.0");
    });
  });
});
