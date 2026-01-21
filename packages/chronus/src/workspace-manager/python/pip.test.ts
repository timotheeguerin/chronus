import { beforeEach, describe, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { WorkspaceManager } from "../types.js";
import { PipWorkspaceManager } from "./pip.js";

let host: TestHost;
let ws: WorkspaceManager;

beforeEach(async () => {
  host = createTestHost({
    "proj/pyproject.toml": `
[project]
name = "my-workspace"
version = "0.1.0"
description = "A Python workspace"
    `,
  });

  ws = new PipWorkspaceManager();
});

function createPyprojectToml({ name, version }: { name: string; version: string }): string {
  return `[project]
name = "${name}"
version = "${version}"
description = ""
`;
}

function createSetupPy({ name, version }: { name: string; version: string }): string {
  return `from setuptools import setup

setup(
    name="${name}",
    version="${version}",
    description="",
)
`;
}

it("detects pyproject.toml workspace", async () => {
  const isWorkspace = await ws.is(host.host, "proj");
  expect(isWorkspace).toBe(true);
});

it("detects setup.py workspace", async () => {
  host = createTestHost({
    "proj/setup.py": createSetupPy({ name: "my-workspace", version: "0.1.0" }),
  });
  const isWorkspace = await ws.is(host.host, "proj");
  expect(isWorkspace).toBe(true);
});

it("finds root package when no sub-packages exist", async () => {
  const workspace = await ws.load(host.host, "proj");
  expect(workspace.packages).toHaveLength(1);
  expect(workspace.packages[0]).toMatchObject({
    name: "my-workspace",
    version: "0.1.0",
  });
});

it("finds all packages with pyproject.toml", async () => {
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

it("finds all packages with setup.py", async () => {
  host.addFile("proj/packages/pkg-a/setup.py", createSetupPy({ name: "pkg-a", version: "1.0.0" }));
  host.addFile("proj/packages/pkg-b/setup.py", createSetupPy({ name: "pkg-b", version: "1.2.0" }));
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

describe("updateVersionsForPackage with pyproject.toml", () => {
  it("updates the package version", async () => {
    host.addFile("proj/packages/pkg-a/pyproject.toml", createPyprojectToml({ name: "pkg-a", version: "1.0.0" }));
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: {},
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[project]
name = "pkg-a"
version = "2.0.0"
description = ""
`);
  });

  it("updates dependency versions", async () => {
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[project]
name = "pkg-a"
version = "1.0.0"
description = ""
dependencies = [
    "pkg-b>=1.0.0",
    "requests>=2.28.0"
]
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { "pkg-b": "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toContain("pkg-b>=2.0.0");
  });

  it("updates version and dependencies together", async () => {
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[project]
name = "pkg-a"
version = "1.0.0"
description = ""
dependencies = [
    "pkg-b>=1.0.0"
]
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "pkg-b": "1.5.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toBe(`[project]
name = "pkg-a"
version = "2.0.0"
description = ""
dependencies = [
    "pkg-b>=1.5.0"
]
`);
  });
});

describe("updateVersionsForPackage with setup.py", () => {
  it("updates the package version", async () => {
    host.addFile("proj/packages/pkg-a/setup.py", createSetupPy({ name: "pkg-a", version: "1.0.0" }));
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: {},
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/setup.py");
    expect(updatedFile.content).toContain('version="2.0.0"');
  });

  it("updates dependency versions", async () => {
    host.addFile(
      "proj/packages/pkg-a/setup.py",
      `from setuptools import setup

setup(
    name="pkg-a",
    version="1.0.0",
    install_requires=[
        "pkg-b>=1.0.0",
        "requests>=2.28.0"
    ]
)
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      dependenciesVersions: { "pkg-b": "2.0.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/setup.py");
    expect(updatedFile.content).toContain("pkg-b>=2.0.0");
  });

  it("updates version and dependencies together", async () => {
    host.addFile(
      "proj/packages/pkg-a/setup.py",
      `from setuptools import setup

setup(
    name="pkg-a",
    version="1.0.0",
    install_requires=[
        "pkg-b>=1.0.0"
    ]
)
`,
    );
    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "pkg-b": "1.5.0" },
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/setup.py");
    expect(updatedFile.content).toContain('version="2.0.0"');
    expect(updatedFile.content).toContain("pkg-b>=1.5.0");
  });
});
