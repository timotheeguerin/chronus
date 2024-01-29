import { dump } from "js-yaml";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../testing/test-host.js";
import { createRushWorkspaceManager } from "./rush.js";
import type { WorkspaceManager } from "./types.js";

describe("rush", () => {
  let host: TestHost;
  let rush: WorkspaceManager;
  beforeEach(async () => {
    host = createTestHost({});

    rush = createRushWorkspaceManager(host.host);
  });

  it("finds 0 packages when workspace has none", async () => {
    host.addFile(
      "proj/rush.json",
      dump({
        projects: [],
      }),
    );
    const workspace = await rush.load("proj");
    expect(workspace.packages).toEqual([]);
  });

  it("finds all packages", async () => {
    host.addFile(
      "proj/rush.json",
      dump({
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
    host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
    host.addFile("proj/packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "1.2.0" }));
    const workspace = await rush.load("proj");
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
