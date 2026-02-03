import { beforeEach, expect, it } from "vitest";
import { stringify } from "yaml";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { Ecosystem } from "../types.js";
import { createPnpmWorkspaceManager } from "./pnpm.js";

let host: TestHost;
let pnpm: Ecosystem;
beforeEach(async () => {
  host = createTestHost({
    "proj/pnpm-workspace.yaml": stringify({
      packages: ["packages/*", "!packages/pkg-excluded/**"],
    }),
  });

  pnpm = createPnpmWorkspaceManager();
});

it("finds 0 packages when workspace has none", async () => {
  const packages = await pnpm.load(host.host, "proj");
  expect(packages).toEqual([]);
});

it("finds all packages", async () => {
  host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "1.2.0" }));
  const packages = await pnpm.load(host.host, "proj");
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

it("doesn't include excluded packages", async () => {
  host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/packages/pkg-excluded/package.json", JSON.stringify({ name: "pkg-excluded", version: "1.2.0" }));
  const packages = await pnpm.load(host.host, "proj");
  expect(packages).toHaveLength(1);
  expect(packages[0]).toHaveProperty("name", "pkg-a");
});
