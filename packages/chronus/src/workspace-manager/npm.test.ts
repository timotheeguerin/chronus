import { beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { createTestHost, type TestHost } from "../testing/test-host.js";
import { createNpmWorkspaceManager } from "./npm.js";
import type { WorkspaceManager } from "./types.js";

describe("npm", () => {
  let host: TestHost;
  let pnpm: WorkspaceManager;
  beforeEach(async () => {
    host = createTestHost({
      "proj/package.json": stringify({
        workspaces: ["packages/*"],
      }),
    });

    pnpm = createNpmWorkspaceManager(host.host);
  });

  it("finds 0 packages when workspace has none", async () => {
    const workspace = await pnpm.load("proj");
    expect(workspace.packages).toEqual([]);
  });

  it("finds all packages", async () => {
    host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
    host.addFile("proj/packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "1.2.0" }));
    const workspace = await pnpm.load("proj");
    expect(workspace.packages).toHaveLength(2);
    expect(workspace.packages[0]).toEqual({
      name: "pkg-a",
      version: "1.0.0",
      relativePath: "packages/pkg-a",
      manifest: { name: "pkg-a", version: "1.0.0" },
    });
    expect(workspace.packages[1]).toEqual({
      name: "pkg-b",
      version: "1.2.0",
      relativePath: "packages/pkg-b",
      manifest: { name: "pkg-b", version: "1.2.0" },
    });
  });
});
