import { beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { createTestHost, type TestHost } from "../testing/test-host.js";
import { loadPackages } from "./auto-discover.js";

let host: TestHost;
beforeEach(async () => {
  host = createTestHost({});
});

interface NpmPkgOptions {
  name: string;
  version?: string;
}

interface WorkspaceOptions {
  dir?: string;
  packages?: NpmPkgOptions[];
}

interface CargoPkgOptions {
  name: string;
  version?: string;
}

interface CargoWorkspaceOptions {
  dir?: string;
  packages?: CargoPkgOptions[];
}

function addNpmPkg(dir: string, subdir: string, pkg: NpmPkgOptions) {
  host.addFile(
    `${dir}/${subdir}/${pkg.name}/package.json`,
    JSON.stringify({ name: pkg.name, version: pkg.version ?? "1.0.0" }),
  );
}

function addNpmPkgs(dir: string, packages: NpmPkgOptions[], subdir: string = "packages") {
  for (const pkg of packages) {
    addNpmPkg(dir, subdir, pkg);
  }
}

function addCargoPkg(dir: string, pkg: CargoPkgOptions) {
  host.addFile(
    `${dir}/crates/${pkg.name}/Cargo.toml`,
    `
[package]
name = "${pkg.name}"
version = "${pkg.version ?? "1.0.0"}"
edition = "2021"
`,
  );
}

function addCargoPkgs(dir: string, packages: CargoPkgOptions[]) {
  for (const pkg of packages) {
    addCargoPkg(dir, pkg);
  }
}

function makePnpmWorkspace(options: WorkspaceOptions = {}) {
  const dir = options.dir ?? "proj";
  const packages = options.packages ?? [{ name: "pkg-a" }];
  host.addFile(
    `${dir}/pnpm-workspace.yaml`,
    stringify({
      packages: ["packages/*"],
    }),
  );
  addNpmPkgs(dir, packages, "packages");
}

function makeNpmWorkspace(options: WorkspaceOptions = {}) {
  const dir = options.dir ?? "proj";
  const packages = options.packages ?? [{ name: "pkg-a" }];
  host.addFile(
    `${dir}/package.json`,
    JSON.stringify({
      workspaces: ["packages/*"],
    }),
  );
  addNpmPkgs(dir, packages, "packages");
}

function makeRushWorkspace(options: WorkspaceOptions = {}) {
  const dir = options.dir ?? "proj";
  const packages = options.packages ?? [{ name: "pkg-a" }, { name: "pkg-b" }];
  host.addFile(
    `${dir}/rush.json`,
    JSON.stringify({
      projects: packages.map((pkg) => ({
        packageName: pkg.name,
        projectFolder: `packages/${pkg.name}`,
        shouldPublish: true,
      })),
    }),
  );
  addNpmPkgs(dir, packages, "packages");
}

function makeCargoWorkspace(options: CargoWorkspaceOptions = {}) {
  const dir = options.dir ?? "proj";
  const packages = options.packages ?? [{ name: "pkg-a" }];
  host.addFile(
    `${dir}/Cargo.toml`,
    `
[workspace]
resolver = "2"
members = ["crates/*"]
exclude = ["crates/pkg-excluded/**"]
`,
  );
  addCargoPkgs(dir, packages);
}

describe("auto", () => {
  it("finds pnpm workspace", async () => {
    makePnpmWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "" }]);
    expect(packages[0].ecosystem).toBe("node:pnpm");
  });
  it("finds rush workspace", async () => {
    makeRushWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "" }]);
    expect(packages[0].ecosystem).toBe("node:rush");
  });
  it("find npm workspace", async () => {
    makeNpmWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "" }]);
    expect(packages[0].ecosystem).toBe("node:npm");
  });

  it("finds pnpm workspace over npm workspace", async () => {
    makeNpmWorkspace();
    makePnpmWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "" }]);
    expect(packages[0].ecosystem).toBe("node:pnpm");
  });

  it("finds rush workspace over npm workspace", async () => {
    makeNpmWorkspace();
    makeRushWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "" }]);
    expect(packages[0].ecosystem).toBe("node:rush");
  });

  it("finds cargo workspace", async () => {
    makeCargoWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "" }]);
    expect(packages[0].ecosystem).toBe("rust:cargo");
  });
});

describe("forced", () => {
  beforeEach(() => {
    makeNpmWorkspace();
    makeRushWorkspace();
    makePnpmWorkspace();
    makeCargoWorkspace();
  });

  it("finds pnpm workspace with 'node:pnpm'", async () => {
    makePnpmWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "node:pnpm" }]);
    expect(packages[0].ecosystem).toBe("node:pnpm");
  });
  it("finds pnpm workspace with 'pnpm'", async () => {
    makePnpmWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "pnpm" }]);
    expect(packages[0].ecosystem).toBe("node:pnpm");
  });

  it("finds rush workspace with 'node:rush'", async () => {
    makeRushWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "node:rush" }]);
    expect(packages[0].ecosystem).toBe("node:rush");
  });

  it("finds rush workspace with 'rush'", async () => {
    makeRushWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "rush" }]);
    expect(packages[0].ecosystem).toBe("node:rush");
  });

  it("finds npm workspace", async () => {
    makeNpmWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "npm" }]);
    expect(packages[0].ecosystem).toBe("node:npm");
  });

  it("finds cargo workspace", async () => {
    makeCargoWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "cargo" }]);
    expect(packages[0].ecosystem).toBe("rust:cargo");
  });

  it("finds cargo workspace with 'rust:cargo'", async () => {
    makeCargoWorkspace();
    const packages = await loadPackages(host.host, "proj", [{ path: "", type: "rust:cargo" }]);
    expect(packages[0].ecosystem).toBe("rust:cargo");
  });
});

describe("multiple workspaces in subfolders", () => {
  it("loads pnpm workspace from subfolder with subfolder as root", async () => {
    makePnpmWorkspace({
      dir: "proj/node-libs",
      packages: [{ name: "pkg-a" }, { name: "pkg-b", version: "2.0.0" }],
    });

    const packages = await loadPackages(host.host, "proj/node-libs", [{ path: "" }]);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["pkg-a", "pkg-b"]);
    expect(packages[0].ecosystem).toBe("node:pnpm");
  });

  it("loads multiple workspaces from different roots", async () => {
    makePnpmWorkspace({ dir: "proj/node-libs", packages: [{ name: "node-pkg" }] });
    makeCargoWorkspace({ dir: "proj/rust-libs", packages: [{ name: "rust-pkg" }] });

    // Load each workspace with its own root
    const nodePackages = await loadPackages(host.host, "proj/node-libs", [{ path: "" }]);
    const rustPackages = await loadPackages(host.host, "proj/rust-libs", [{ path: "" }]);
    const packages = [...nodePackages, ...rustPackages];

    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["node-pkg", "rust-pkg"]);
    expect(packages.find((p) => p.name === "node-pkg")?.ecosystem).toBe("node:pnpm");
    expect(packages.find((p) => p.name === "rust-pkg")?.ecosystem).toBe("rust:cargo");
  });

  it("detects and loads different ecosystem types", async () => {
    makePnpmWorkspace({ dir: "proj-pnpm", packages: [{ name: "pkg-a" }] });
    makeNpmWorkspace({ dir: "proj-npm", packages: [{ name: "pkg-b" }] });

    const pnpmPackages = await loadPackages(host.host, "proj-pnpm", [{ path: "" }]);
    const npmPackages = await loadPackages(host.host, "proj-npm", [{ path: "" }]);

    expect(pnpmPackages[0].ecosystem).toBe("node:pnpm");
    expect(npmPackages[0].ecosystem).toBe("node:npm");
  });
});

describe("loading packages via patterns", () => {
  beforeEach(() => {
    addNpmPkgs("proj", [{ name: "pkg-a" }, { name: "pkg-b", version: "2.0.0" }, { name: "pkg-c", version: "3.0.0" }]);
    addNpmPkgs("proj", [{ name: "lib-x" }, { name: "lib-y" }], "libs");
    addNpmPkgs("proj", [{ name: "tool-z" }], "tools");
  });

  it("loads packages matching a single pattern", async () => {
    const packages = await loadPackages(host.host, "proj", [{ path: "packages/*", type: "npm" }]);
    expect(packages).toHaveLength(3);
    expect(packages.map((p) => p.name).sort()).toEqual(["pkg-a", "pkg-b", "pkg-c"]);
  });

  it("loads packages matching multiple patterns", async () => {
    const packages = await loadPackages(host.host, "proj", [
      { path: "packages/*", type: "npm" },
      { path: "libs/*", type: "npm" },
    ]);
    expect(packages).toHaveLength(5);
    expect(packages.map((p) => p.name).sort()).toEqual(["lib-x", "lib-y", "pkg-a", "pkg-b", "pkg-c"]);
  });

  it("loads packages from pattern in different directories", async () => {
    const packages = await loadPackages(host.host, "proj", [
      { path: "packages/*", type: "npm" },
      { path: "tools/*", type: "npm" },
    ]);
    expect(packages).toHaveLength(4);
    expect(packages.map((p) => p.name).sort()).toEqual(["pkg-a", "pkg-b", "pkg-c", "tool-z"]);
  });

  it("loads subset of packages using partial pattern", async () => {
    // Using pattern to select only packages starting with 'lib-'
    const packages = await loadPackages(host.host, "proj", [{ path: "libs/lib-*", type: "npm" }]);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["lib-x", "lib-y"]);
  });

  it("throws error when using pattern without specifying type", async () => {
    await expect(loadPackages(host.host, "proj", [{ path: "packages/*" }])).rejects.toThrow(
      "When using patterns in package paths, you must specify ecosystem type.",
    );
  });
});

describe("loading individual packages by path", () => {
  beforeEach(() => {
    addNpmPkgs("proj", [{ name: "pkg-a" }, { name: "pkg-b", version: "2.0.0" }, { name: "pkg-c", version: "3.0.0" }]);
    addCargoPkgs("proj", [{ name: "crate-a" }, { name: "crate-b", version: "2.0.0" }]);
  });

  it("loads a single npm package by explicit path", async () => {
    const packages = await loadPackages(host.host, "proj", [{ path: "packages/pkg-a", type: "npm" }]);
    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe("pkg-a");
    expect(packages[0].version).toBe("1.0.0");
    expect(packages[0].ecosystem).toBe("node:npm");
  });

  it("loads multiple npm packages by explicit paths", async () => {
    const packages = await loadPackages(host.host, "proj", [
      { path: "packages/pkg-a", type: "npm" },
      { path: "packages/pkg-b", type: "npm" },
    ]);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["pkg-a", "pkg-b"]);
  });

  it("loads subset of packages excluding others", async () => {
    const packages = await loadPackages(host.host, "proj", [
      { path: "packages/pkg-a", type: "npm" },
      { path: "packages/pkg-c", type: "npm" },
    ]);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["pkg-a", "pkg-c"]);
    expect(packages.find((p) => p.name === "pkg-b")).toBeUndefined();
  });

  it("loads a single cargo package by explicit path", async () => {
    const packages = await loadPackages(host.host, "proj", [{ path: "crates/crate-a", type: "cargo" }]);
    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe("crate-a");
    expect(packages[0].version).toBe("1.0.0");
    expect(packages[0].ecosystem).toBe("rust:cargo");
  });

  it("loads mixed ecosystem packages by explicit paths", async () => {
    const packages = await loadPackages(host.host, "proj", [
      { path: "packages/pkg-a", type: "npm" },
      { path: "crates/crate-a", type: "cargo" },
    ]);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["crate-a", "pkg-a"]);
    expect(packages.find((p) => p.name === "pkg-a")?.ecosystem).toBe("node:npm");
    expect(packages.find((p) => p.name === "crate-a")?.ecosystem).toBe("rust:cargo");
  });
});
