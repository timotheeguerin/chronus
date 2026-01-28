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

describe("packages with both pyproject.toml (for tools) and setup.py (for packaging)", () => {
  it("loads package from setup.py when pyproject.toml exists but has no [project] section", async () => {
    // pyproject.toml exists but only for tools (no [project] section)
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[tool.black]
line-length = 88

[tool.isort]
profile = "black"
`,
    );
    // setup.py has the actual packaging info
    host.addFile("proj/packages/pkg-a/setup.py", createSetupPy({ name: "pkg-a", version: "1.0.0" }));

    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    expect(pkg).toMatchObject({
      name: "pkg-a",
      version: "1.0.0",
      relativePath: "packages/pkg-a",
    });
  });

  it("updates setup.py when pyproject.toml exists but has no [project] section", async () => {
    // pyproject.toml exists but only for tools
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[tool.black]
line-length = 88
`,
    );
    // setup.py has the packaging info
    host.addFile(
      "proj/packages/pkg-a/setup.py",
      `from setuptools import setup

setup(
    name="pkg-a",
    version="1.0.0",
    install_requires=["pkg-b>=1.0.0"]
)
`,
    );

    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "pkg-b": "1.5.0" },
    });

    // setup.py should be updated
    const updatedSetupPy = await host.host.readFile("proj/packages/pkg-a/setup.py");
    expect(updatedSetupPy.content).toContain('version="2.0.0"');
    expect(updatedSetupPy.content).toContain("pkg-b>=1.5.0");

    // pyproject.toml should remain unchanged
    const pyprojectContent = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(pyprojectContent.content).toBe(`[tool.black]
line-length = 88
`);
  });

  it("uses pyproject.toml when it has [project] section, even if setup.py exists", async () => {
    // pyproject.toml has packaging info
    host.addFile(
      "proj/packages/pkg-a/pyproject.toml",
      `[project]
name = "pkg-a"
version = "1.0.0"
dependencies = ["pkg-b>=1.0.0"]
`,
    );
    // setup.py also exists (maybe for backward compatibility)
    host.addFile("proj/packages/pkg-a/setup.py", createSetupPy({ name: "pkg-a", version: "0.9.0" }));

    const workspace = await ws.load(host.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "pkg-a")!;

    // Should use pyproject.toml version (1.0.0), not setup.py version (0.9.0)
    expect(pkg).toMatchObject({
      name: "pkg-a",
      version: "1.0.0",
      relativePath: "packages/pkg-a",
    });

    await ws.updateVersionsForPackage(host.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "pkg-b": "1.5.0" },
    });

    // pyproject.toml should be updated
    const updatedPyproject = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedPyproject.content).toContain('version = "2.0.0"');
    expect(updatedPyproject.content).toContain("pkg-b>=1.5.0");

    // setup.py should remain unchanged
    const setupPyContent = await host.host.readFile("proj/packages/pkg-a/setup.py");
    expect(setupPyContent.content).toContain('version="0.9.0"');
  });
});

describe("Azure SDK pattern with _version.py", () => {
  it("loads package with version from _version.py", async () => {
    // Create a fresh host for this test
    const azureHost = createTestHost({
      // Add a root marker so the workspace manager knows this is a Python workspace
      "proj/pyproject.toml": `[tool.black]
line-length = 88
`,
    });
    
    // Setup.py that reads version from _version.py
    azureHost.addFile(
      "proj/packages/azure-mgmt-compute/setup.py",
      `from setuptools import setup
import os.path

with open(os.path.join('azure/mgmt/compute', '_version.py'), 'r') as fd:
    version = fd.read()

setup(
    name="azure-mgmt-compute",
    version=version,
    install_requires=["azure-core>=1.0.0"]
)
`,
    );
    // The _version.py file
    azureHost.addFile(
      "proj/packages/azure-mgmt-compute/azure/mgmt/compute/_version.py",
      `# coding=utf-8
# --------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
# --------------------------------------------------------------------------

VERSION = "1.0.0"
`,
    );

    const workspace = await ws.load(azureHost.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "azure-mgmt-compute")!;

    expect(pkg).toMatchObject({
      name: "azure-mgmt-compute",
      version: "1.0.0",
      relativePath: "packages/azure-mgmt-compute",
    });
  });

  it("updates version in _version.py when setup.py references it", async () => {
    // Create a fresh host for this test
    const azureHost = createTestHost({
      // Add a root marker so the workspace manager knows this is a Python workspace
      "proj/pyproject.toml": `[tool.black]
line-length = 88
`,
    });
    
    azureHost.addFile(
      "proj/sdk/azure-mgmt-compute/setup.py",
      `from setuptools import setup
import os.path

with open(os.path.join('azure/mgmt/compute', '_version.py'), 'r') as fd:
    version = fd.read()

setup(
    name="azure-mgmt-compute",
    version=version,
    install_requires=["azure-core>=1.0.0"]
)
`,
    );
    azureHost.addFile("proj/sdk/azure-mgmt-compute/azure/mgmt/compute/_version.py", `VERSION = "1.0.0"`);

    const workspace = await ws.load(azureHost.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "azure-mgmt-compute")!;

    await ws.updateVersionsForPackage(azureHost.host, workspace, pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: { "azure-core": "1.5.0" },
    });

    // _version.py should be updated
    const updatedVersionFile = await azureHost.host.readFile(
      "proj/sdk/azure-mgmt-compute/azure/mgmt/compute/_version.py",
    );
    expect(updatedVersionFile.content).toBe(`VERSION = "2.0.0"`);

    // setup.py dependencies should be updated
    const updatedSetupPy = await azureHost.host.readFile("proj/sdk/azure-mgmt-compute/setup.py");
    expect(updatedSetupPy.content).toContain("azure-core>=1.5.0");
  });
});

describe("Azure SDK pyproject.toml with dynamic version", () => {
  it("loads package with dynamic version from _version.py", async () => {
    const azureHost = createTestHost({
      "proj/pyproject.toml": `[tool.black]
line-length = 88
`,
    });

    // Modern Azure SDK pyproject.toml with dynamic version
    azureHost.addFile(
      "proj/sdk/azure-keyvault-keys/pyproject.toml",
      `[build-system]
requires = ["setuptools>=61.0.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "azure-keyvault-keys"
authors = [
    {name = "Microsoft Corporation", email = "azpysdkhelp@microsoft.com"},
]
description = "Microsoft Azure Key Vault Keys Client Library for Python"
keywords = ["azure", "azure sdk"]
requires-python = ">=3.9"
license = {text = "MIT License"}
dependencies = [
    "azure-core>=1.31.0",
    "cryptography>=2.1.4",
]
dynamic = ["version", "readme"]
`,
    );

    // The _version.py file
    azureHost.addFile("proj/sdk/azure-keyvault-keys/azure/keyvault/keys/_version.py", `VERSION = "4.9.0"`);

    const workspace = await ws.load(azureHost.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "azure-keyvault-keys")!;

    expect(pkg).toMatchObject({
      name: "azure-keyvault-keys",
      version: "4.9.0",
      relativePath: "sdk/azure-keyvault-keys",
    });
  });

  it("updates _version.py when pyproject.toml has dynamic version", async () => {
    const azureHost = createTestHost({
      "proj/pyproject.toml": `[tool.black]
line-length = 88
`,
    });

    azureHost.addFile(
      "proj/sdk/azure-keyvault-keys/pyproject.toml",
      `[build-system]
requires = ["setuptools>=61.0.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "azure-keyvault-keys"
description = "Microsoft Azure Key Vault Keys Client Library for Python"
dependencies = [
    "azure-core>=1.31.0",
    "cryptography>=2.1.4",
]
dynamic = ["version", "readme"]
`,
    );

    azureHost.addFile("proj/sdk/azure-keyvault-keys/azure/keyvault/keys/_version.py", `VERSION = "4.9.0"`);

    const workspace = await ws.load(azureHost.host, "proj");
    const pkg = workspace.packages.find((p) => p.name === "azure-keyvault-keys")!;

    await ws.updateVersionsForPackage(azureHost.host, workspace, pkg, {
      newVersion: "5.0.0",
      dependenciesVersions: { "azure-core": "2.0.0" },
    });

    // _version.py should be updated (because version is dynamic)
    const updatedVersionFile = await azureHost.host.readFile(
      "proj/sdk/azure-keyvault-keys/azure/keyvault/keys/_version.py",
    );
    expect(updatedVersionFile.content).toBe(`VERSION = "5.0.0"`);

    // pyproject.toml dependencies should be updated
    const updatedPyproject = await azureHost.host.readFile("proj/sdk/azure-keyvault-keys/pyproject.toml");
    expect(updatedPyproject.content).toContain("azure-core>=2.0.0");
    // pyproject.toml should NOT have a version field (it's dynamic)
    expect(updatedPyproject.content).not.toContain('version = "5.0.0"');
  });
});
