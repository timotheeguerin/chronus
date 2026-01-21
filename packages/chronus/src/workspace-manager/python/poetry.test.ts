import { beforeEach, describe, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { WorkspaceManager } from "../types.js";
import { PoetryWorkspaceManager } from "./poetry.js";

let host: TestHost;
let ws: WorkspaceManager;

beforeEach(async () => {
  host = createTestHost({
    "proj/pyproject.toml": `
[tool.poetry]
name = "my-workspace"
version = "0.1.0"
description = "A Python workspace"
    `,
  });

  ws = new PoetryWorkspaceManager();
});

function createPyprojectToml({ name, version }: { name: string; version: string }): string {
  return `[tool.poetry]
name = "${name}"
version = "${version}"
description = ""
authors = []
`;
}

it("finds 0 packages when workspace has none", async () => {
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages).toHaveLength(1); // Root package itself
  expect(workspace.packages[0]).toMatchObject({
    name: "my-workspace",
    version: "0.1.0",
  });
});

it("finds all packages", async () => {
  host.addFile("proj/packages/pkg-a/pyproject.toml", createPyprojectToml({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/packages/pkg-b/pyproject.toml", createPyprojectToml({ name: "pkg-b", version: "1.2.0" }));
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages.length).toBeGreaterThanOrEqual(2);
  
  const pkgA = workspace.packages.find((p) => p.name === "pkg-a");
  const pkgB = workspace.packages.find((p) => p.name === "pkg-b");
  
  expect(pkgA).toMatchObject({
    name: "pkg-a",
    version: "1.0.0",
    relativePath: "packages/pkg-a",
  });
  expect(pkgB).toMatchObject({
    name: "pkg-b",
    version: "1.2.0",
    relativePath: "packages/pkg-b",
  });
});

describe("updateVersionsForPackage", () => {
  it("updates the package version", async () => {
    host.addFile("proj/packages/pkg-a/pyproject.toml", createPyprojectToml({ name: "pkg-a", version: "1.0.0" }));
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: {},
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[tool.poetry]
name = "pkg-a"
version = "2.0.0"
description = ""
authors = []
`);
  });

  it("updates simple string dependency versions", async () => {
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dependencies]
pkg-b = "1.0.0"
requests = "^2.28.0"
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { "pkg-b": "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dependencies]
pkg-b = "2.0.0"
requests = "^2.28.0"
`);
  });

  it("updates object-style dependency versions", async () => {
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dependencies]
pkg-b = { version = "1.0.0", extras = ["dev"] }
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { "pkg-b": "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dependencies]
pkg-b = { version = "2.0.0", extras = ["dev"] }
`);
  });

  it("updates dev-dependencies versions", async () => {
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dev-dependencies]
pytest = "^7.0.0"
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { pytest: "^8.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dev-dependencies]
pytest = "^8.0.0"
`);
  });

  it("updates version and dependencies together", async () => {
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[tool.poetry]
name = "pkg-a"
version = "1.0.0"
description = ""
authors = []

[tool.poetry.dependencies]
pkg-b = "1.0.0"

[tool.poetry.dev-dependencies]
pkg-c = { version = "1.0.0", extras = ["full"] }
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "pkg-b": "1.5.0", "pkg-c": "1.25.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[tool.poetry]
name = "pkg-a"
version = "2.0.0"
description = ""
authors = []

[tool.poetry.dependencies]
pkg-b = "1.5.0"

[tool.poetry.dev-dependencies]
pkg-c = { version = "1.25.0", extras = ["full"] }
`);
  });
});
