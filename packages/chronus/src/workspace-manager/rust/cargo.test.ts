import { beforeEach, describe, expect, it } from "vitest";
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

it("doesn't include excluded packages", async () => {
  host.addFile("proj/crates/pkg-a/Cargo.toml", createCargoToml({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/crates/pkg-excluded/Cargo.toml", createCargoToml({ name: "pkg-excluded", version: "1.2.0" }));
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages).toHaveLength(1);
  expect(workspace.packages[0]).toHaveProperty("name", "pkg-a");
});

describe("updateVersionsForPackage", () => {
  it("updates the package version", async () => {
    host.addFile("proj/crates/pkg-a/Cargo.toml", createCargoToml({ name: "pkg-a", version: "1.0.0" }));
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages[0];

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: {},
    });

    const updatedFile = await host.host.readFile("proj/crates/pkg-a/Cargo.toml");
    expect(updatedFile.content).toBe(`[package]
name = "pkg-a"
version = "2.0.0"
edition = "2021"
`);
  });

  it("updates simple string dependency versions", async () => {
    host.addFile(
      "proj/crates/pkg-a/Cargo.toml",
      `[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dependencies]
pkg-b = "1.0.0"
tokio = "1.0.0"
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages[0];

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { "pkg-b": "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/crates/pkg-a/Cargo.toml");
    expect(updatedFile.content).toBe(`[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dependencies]
pkg-b = "2.0.0"
tokio = "1.0.0"
`);
  });

  it("updates object-style dependency versions", async () => {
    host.addFile(
      "proj/crates/pkg-a/Cargo.toml",
      `[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dependencies]
pkg-b = { version = "1.0.0", features = ["derive"] }
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages[0];

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { "pkg-b": "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/crates/pkg-a/Cargo.toml");
    expect(updatedFile.content).toBe(`[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dependencies]
pkg-b = { version = "2.0.0", features = ["derive"] }
`);
  });

  it("updates dev-dependencies versions", async () => {
    host.addFile(
      "proj/crates/pkg-a/Cargo.toml",
      `[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dev-dependencies]
proptest = "1.0.0"
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages[0];

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { proptest: "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/crates/pkg-a/Cargo.toml");
    expect(updatedFile.content).toBe(`[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dev-dependencies]
proptest = "2.0.0"
`);
  });

  it("updates build-dependencies versions", async () => {
    host.addFile(
      "proj/crates/pkg-a/Cargo.toml",
      `[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[build-dependencies]
cc = "1.0.0"
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages[0];

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { cc: "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/crates/pkg-a/Cargo.toml");
    expect(updatedFile.content).toBe(`[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[build-dependencies]
cc = "2.0.0"
`);
  });

  it("updates version and dependencies together", async () => {
    host.addFile(
      "proj/crates/pkg-a/Cargo.toml",
      `[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"

[dependencies]
pkg-b = "1.0.0"

[dev-dependencies]
pkg-c = { version = "1.0.0", features = ["full"] }
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages[0];

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "pkg-b": "1.5.0", "pkg-c": "1.25.0" },
    });

    const updatedFile = await host.host.readFile("proj/crates/pkg-a/Cargo.toml");
    expect(updatedFile.content).toBe(`[package]
name = "pkg-a"
version = "2.0.0"
edition = "2021"

[dependencies]
pkg-b = "1.5.0"

[dev-dependencies]
pkg-c = { version = "1.25.0", features = ["full"] }
`);
  });
});
