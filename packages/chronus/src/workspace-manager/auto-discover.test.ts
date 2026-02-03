import { beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { createTestHost, type TestHost } from "../testing/test-host.js";
import { loadPackages } from "./auto-discover.js";

let host: TestHost;
beforeEach(async () => {
  host = createTestHost({});
});

function addNpmPkg() {
  host.addFile("proj/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
}

function makePnpmWorkspace() {
  host.addFile(
    "proj/pnpm-workspace.yaml",
    stringify({
      packages: ["packages/*"],
    }),
  );
  addNpmPkg();
}
function makeCargoWorkspace() {
  host.addFile(
    "proj/Cargo.toml",
    `
[workspace]
resolver = "2"

members = ["crates/*"]
exclude = ["crates/pkg-excluded/**"]
    `,
  );
  host.addFile(
    "proj/crates/pkg-a/Cargo.toml",
    `
[package]
name = "pkg-a"
version = "1.0.0"
edition = "2021"
`,
  );
}

function makeRushWorkspace() {
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
  addNpmPkg();
}
function makeNpmWorkspace() {
  host.addFile(
    "proj/package.json",
    JSON.stringify({
      workspaces: ["packages/*"],
    }),
  );
  addNpmPkg();
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
