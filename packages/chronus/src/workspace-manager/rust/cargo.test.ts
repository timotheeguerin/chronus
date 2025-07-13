import { beforeEach, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { WorkspaceManager } from "../types.js";
import { CargoWorkspaceManager } from "./cargo.js";

let host: TestHost;
let ws: WorkspaceManager;

beforeEach(async () => {
  host = createTestHost({
    "proj/Cargo.toml": `
[workspace]
resolver = "2"

members = ["crates/*"]
exclude = ["crates/pkg-excluded/**"]
    `,
  });

  ws = new CargoWorkspaceManager();
});

function createCargoToml({ name, version }: { name: string; version: string }): string {
  return `[package]
name = "${name}"
version = "${version}"
edition = "2021"
`;
}

it("finds 0 packages when workspace has none", async () => {
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages).toEqual([]);
});

it("finds all packages", async () => {
  host.addFile("proj/crates/pkg-a/Cargo.toml", createCargoToml({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/crates/pkg-b/Cargo.toml", createCargoToml({ name: "pkg-b", version: "1.2.0" }));
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages).toHaveLength(2);
  expect(workspace.packages[0]).toMatchObject({
    name: "pkg-a",
    version: "1.0.0",
    relativePath: "crates/pkg-a",
  });
  expect(workspace.packages[1]).toMatchObject({
    name: "pkg-b",
    version: "1.2.0",
    relativePath: "crates/pkg-b",
  });
});

it("doesn't included excluded packages", async () => {
  host.addFile("proj/crates/pkg-a/Cargo.toml", createCargoToml({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/crates/pkg-excluded/Cargo.toml", createCargoToml({ name: "pkg-excluded", version: "1.2.0" }));
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages).toHaveLength(1);
  expect(workspace.packages[0]).toHaveProperty("name", "pkg-a");
});
