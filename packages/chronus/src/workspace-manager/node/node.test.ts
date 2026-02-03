import { beforeEach, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { Ecosystem } from "../types.js";
import { createNodeWorkspaceManager } from "./node.js";

let host: TestHost;
let ws: Ecosystem;

beforeEach(async () => {
  host = createTestHost({
    "proj/package.json": JSON.stringify({
      workspaces: ["packages/*"],
    }),
  });

  ws = createNodeWorkspaceManager();
});

it("finds 0 packages when workspace has none", async () => {
  const packages = await ws.load(host.host, "proj", ".");
  expect(packages).toEqual([]);
});

it("finds all packages", async () => {
  host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "1.2.0" }));
  const packages = await ws.load(host.host, "proj", ".");
  expect(packages).toHaveLength(2);
  expect(packages[0]).toMatchObject({
    name: "pkg-a",
    version: "1.0.0",
    relativePath: "packages/pkg-a",
    manifest: { name: "pkg-a", version: "1.0.0" },
  });
  expect(packages[1]).toMatchObject({
    name: "pkg-b",
    version: "1.2.0",
    relativePath: "packages/pkg-b",
    manifest: { name: "pkg-b", version: "1.2.0" },
  });
});
