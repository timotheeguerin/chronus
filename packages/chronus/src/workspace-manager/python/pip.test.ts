import { beforeEach, describe, expect, it } from "vitest";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import type { Ecosystem } from "../types.js";
import { PipWorkspaceManager } from "./pip.js";

let host: TestHost;
let ws: Ecosystem;

beforeEach(async () => {
  host = createTestHost({
    "proj/pyproject.toml": `
[project]
name = "my-package"
version = "0.1.0"
description = "A Python package"
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

describe("is", () => {
  it("detects pyproject.toml", async () => {
    expect(await ws.is(host.host, "proj")).toBe(true);
  });

  it("returns false when no pyproject.toml", async () => {
    host = createTestHost({});
    expect(await ws.is(host.host, "proj")).toBe(false);
  });

  it("returns true when pyproject.toml exists even without [project] section", async () => {
    host = createTestHost({
      "proj/pyproject.toml": `[tool.black]
line-length = 88
`,
    });
    expect(await ws.is(host.host, "proj")).toBe(true);
  });
});

describe("load", () => {
  it("loads package from pyproject.toml", async () => {
    const packages = await ws.load(host.host, ".", "proj");
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      name: "my-package",
      version: "0.1.0",
      relativePath: "proj",
    });
  });

  it("returns empty when pyproject.toml has no [project] section", async () => {
    host = createTestHost({
      "proj/pyproject.toml": `[tool.black]
line-length = 88
`,
    });
    const packages = await ws.load(host.host, ".", "proj");
    expect(packages).toHaveLength(0);
  });
});

describe("loadPattern", () => {
  it("finds all packages matching pattern", async () => {
    host.addFile("proj/packages/pkg-a/pyproject.toml", createPyprojectToml({ name: "pkg-a", version: "1.0.0" }));
    host.addFile("proj/packages/pkg-b/pyproject.toml", createPyprojectToml({ name: "pkg-b", version: "1.2.0" }));

    const packages = await ws.loadPattern(host.host, "proj", "packages/*");

    expect(packages).toHaveLength(2);
    expect(packages.find((p) => p.name === "pkg-a")).toMatchObject({
      name: "pkg-a",
      version: "1.0.0",
      relativePath: "packages/pkg-a",
    });
    expect(packages.find((p) => p.name === "pkg-b")).toMatchObject({
      name: "pkg-b",
      version: "1.2.0",
      relativePath: "packages/pkg-b",
    });
  });
});

describe("updateVersionsForPackage", () => {
  it("updates the package version", async () => {
    host.addFile("proj/packages/pkg-a/pyproject.toml", createPyprojectToml({ name: "pkg-a", version: "1.0.0" }));
    const [pkg] = await ws.load(host.host, "proj", "packages/pkg-a");

    await ws.updateVersionsForPackage(host.host, "proj", pkg, {
      newVersion: "2.0.0",
      dependenciesVersions: {},
    });

    const updatedFile = await host.host.readFile("proj/packages/pkg-a/pyproject.toml");
    expect(updatedFile.content).toContain('version = "2.0.0"');
  });
});

describe("dynamic version with different backends", () => {
  it("loads package with dynamic version from _version.py (default fallback)", async () => {
    host.addFile(
      "proj/sdk/my-pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dependencies = ["requests>=2.0.0"]
dynamic = ["version"]
`,
    );
    host.addFile("proj/sdk/my-pkg/my_pkg/_version.py", `VERSION = "4.9.0"`);

    const [pkg] = await ws.load(host.host, "proj", "sdk/my-pkg");

    expect(pkg).toMatchObject({
      name: "my-pkg",
      version: "4.9.0",
      relativePath: "sdk/my-pkg",
    });
  });

  it("updates _version.py when version is dynamic", async () => {
    host.addFile(
      "proj/sdk/my-pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dependencies = ["requests>=2.0.0"]
dynamic = ["version"]
`,
    );
    host.addFile("proj/sdk/my-pkg/my_pkg/_version.py", `VERSION = "4.9.0"`);

    const [pkg] = await ws.load(host.host, "proj", "sdk/my-pkg");

    await ws.updateVersionsForPackage(host.host, "proj", pkg, {
      newVersion: "5.0.0",
      dependenciesVersions: {},
    });

    const versionFile = await host.host.readFile("proj/sdk/my-pkg/my_pkg/_version.py");
    expect(versionFile.content).toContain('VERSION = "5.0.0"');

    const pyproject = await host.host.readFile("proj/sdk/my-pkg/pyproject.toml");
    expect(pyproject.content).not.toContain('version = "5.0.0"');
  });
});

describe("setuptools backend", () => {
  it("reads version from attr config", async () => {
    host.addFile(
      "proj/pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dynamic = ["version"]

[tool.setuptools.dynamic]
version = {attr = "my_pkg._version.VERSION"}
`,
    );
    host.addFile("proj/pkg/my_pkg/_version.py", `VERSION = "1.2.3"`);

    const [pkg] = await ws.load(host.host, "proj", "pkg");
    expect(pkg.version).toBe("1.2.3");
  });

  it("reads version from file config", async () => {
    host.addFile(
      "proj/pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dynamic = ["version"]

[tool.setuptools.dynamic]
version = {file = "VERSION.txt"}
`,
    );
    host.addFile("proj/pkg/VERSION.txt", `VERSION = "2.0.0"`);

    const [pkg] = await ws.load(host.host, "proj", "pkg");
    expect(pkg.version).toBe("2.0.0");
  });
});

describe("hatch backend", () => {
  it("reads version from hatch path config", async () => {
    host.addFile(
      "proj/pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dynamic = ["version"]

[tool.hatch.version]
path = "src/my_pkg/__about__.py"
`,
    );
    host.addFile("proj/pkg/src/my_pkg/__about__.py", `__version__ = "3.0.0"`);

    const [pkg] = await ws.load(host.host, "proj", "pkg");
    expect(pkg.version).toBe("3.0.0");
  });
});

describe("flit backend", () => {
  it("reads __version__ from module", async () => {
    host.addFile(
      "proj/pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dynamic = ["version"]

[tool.flit.module]
name = "my_pkg"
`,
    );
    host.addFile("proj/pkg/my_pkg/__init__.py", `__version__ = "1.5.0"`);

    const [pkg] = await ws.load(host.host, "proj", "pkg");
    expect(pkg.version).toBe("1.5.0");
  });
});

describe("pdm backend", () => {
  it("reads version from pdm file config", async () => {
    host.addFile(
      "proj/pkg/pyproject.toml",
      `[project]
name = "my-pkg"
dynamic = ["version"]

[tool.pdm.version]
source = "file"
path = "my_pkg/__version__.py"
`,
    );
    host.addFile("proj/pkg/my_pkg/__version__.py", `__version__ = "4.0.0"`);

    const [pkg] = await ws.load(host.host, "proj", "pkg");
    expect(pkg.version).toBe("4.0.0");
  });
});
