import { beforeEach, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { Ecosystem } from "../types.js";
import { createRushWorkspaceManager } from "./rush.js";

let host: TestHost;
let rush: Ecosystem;

beforeEach(async () => {
  host = createTestHost({});

  rush = createRushWorkspaceManager();
});

it("finds 0 packages when workspace has none", async () => {
  host.addFile(
    "proj/rush.json",
    JSON.stringify({
      projects: [],
    }),
  );
  const packages = await rush.load(host.host, "proj");
  expect(packages).toEqual([]);
});

it("finds all packages", async () => {
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
  host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "1.2.0" }));
  const packages = await rush.load(host.host, "proj");
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
