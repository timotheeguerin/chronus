import { beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { createTestHost, type TestHost } from "../testing/test-host.js";
import { loadWorkspace } from "./auto-discover.js";

describe("getWorkspaceManager", () => {
  let host: TestHost;
  beforeEach(async () => {
    host = createTestHost({});
  });

  function makePnpmWorkspace() {
    host.addFile(
      "proj/pnpm-workspace.yaml",
      stringify({
        packages: ["packages/*"],
      }),
    );
  }
  function makeCargoWorkspace() {
    host.addFile(
      "proj/Cargo.toml",
      `
[workspace]
resolver = "2"

members = ["crates/*"]
exclude = ["crates/pkg-excluded/**"]
    `,
    );
  }

  function makeRushWorkspace() {
    host.addFile(
      "proj/rush.json",
      JSON.stringify({
        projects: [
          {
            packageName: "pkg-a",
            projectFolder: "packages/pkg-a",
            shouldPublish: true,
          },
          {
            packageName: "pkg-b",
            projectFolder: "packages/pkg-b",
            shouldPublish: true,
          },
        ],
      }),
    );
  }
  function makeNpmWorkspace() {
    host.addFile(
      "proj/package.json",
      JSON.stringify({
        workspaces: ["packages/*"],
      }),
    );
  }

  describe("auto", () => {
    it("finds pnpm workspace", async () => {
      makePnpmWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "auto");
      expect(workspace.type).toBe("node:pnpm");
    });
    it("finds rush workspace", async () => {
      makeRushWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "auto");
      expect(workspace.type).toBe("node:rush");
    });
    it("find npm workspace", async () => {
      makeNpmWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "auto");
      expect(workspace.type).toBe("node:npm");
    });

    it("finds pnpm workspace over npm workspace", async () => {
      makeNpmWorkspace();
      makePnpmWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "auto");
      expect(workspace.type).toBe("node:pnpm");
    });

    it("finds rush workspace over npm workspace", async () => {
      makeNpmWorkspace();
      makeRushWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "auto");
      expect(workspace.type).toBe("node:rush");
    });

    it("finds cargo workspace", async () => {
      makeCargoWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "auto");
      expect(workspace.type).toBe("rust:cargo");
    });
  });

  describe("forced", () => {
    beforeEach(() => {
      makeNpmWorkspace();
      makeRushWorkspace();
      makePnpmWorkspace();
      makeCargoWorkspace();
    });

    it("finds pnpm workspace with 'node:pnpm'", async () => {
      makePnpmWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "node:pnpm");
      expect(workspace.type).toBe("node:pnpm");
    });
    it("finds pnpm workspace with 'pnpm'", async () => {
      makePnpmWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "pnpm");
      expect(workspace.type).toBe("node:pnpm");
    });

    it("finds rush workspace with 'node:rush'", async () => {
      makeRushWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "node:rush");
      expect(workspace.type).toBe("node:rush");
    });

    it("finds rush workspace with 'rush'", async () => {
      makeRushWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "rush");
      expect(workspace.type).toBe("node:rush");
    });

    it("finds npm workspace", async () => {
      makeNpmWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "npm");
      expect(workspace.type).toBe("node:npm");
    });

    it("finds cargo workspace", async () => {
      makeCargoWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "cargo");
      expect(workspace.type).toBe("rust:cargo");
    });

    it("finds cargo workspace with 'rust:cargo'", async () => {
      makeCargoWorkspace();
      const workspace = await loadWorkspace(host.host, "proj", "cargo");
      expect(workspace.type).toBe("rust:cargo");
    });
  });
});
