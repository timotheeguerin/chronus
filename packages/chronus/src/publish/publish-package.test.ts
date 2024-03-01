import { REGISTRY_MOCK_PORT, prepare, start } from "@pnpm/registry-mock";
import type { ChildProcess } from "child_process";
import { mkdir } from "fs/promises";
import { dump } from "js-yaml";
import pacote, { type Manifest } from "pacote";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDir, type TestDir } from "../testing/test-dir.js";
import { execAsync } from "../utils/exec-async.js";
import { resolvePath } from "../utils/path-utils.js";
import type { PackageBase, PackageJson } from "../workspace-manager/types.js";
import { publishPackageWithNpm, publishPackageWithPnpm } from "./publish-package.js";

const MOCK_REGISTRY = `http://localhost:${REGISTRY_MOCK_PORT}/`;
let killed = false;
let server: ChildProcess;

beforeAll(() => {
  prepare();
  server = start({
    stdio: "ignore",
  });
  server.on("close", () => {
    if (!killed) {
      throw new Error("Error: The registry server was killed!");
    }
  });
});

afterAll(() => {
  killed = true;
  server.kill();
});

let testDir: TestDir;
beforeEach(async () => {
  testDir = await createTestDir();
  await testDir.addFile(".npmrc", `//localhost:${REGISTRY_MOCK_PORT}/:_authToken="fake"`);
});

async function addPackageJson(
  path: string,
  name: string,
  manifestProps: Partial<PackageJson> = {},
): Promise<PackageBase> {
  const manifest = { name, version: "1.0.0", ...manifestProps };
  await testDir.addFile(path, JSON.stringify(manifest));
  return { name, version: manifest.version, manifest };
}

async function execAsyncSuccess(cmd: string, args: string[], { cwd }: { cwd?: string } = {}) {
  const result = await execAsync(cmd, args, { cwd });
  if (result.code !== 0) {
    throw new Error(`Failed to run npm: ${JSON.stringify(args)}\n${result.stdall}`);
  }
}
async function runNpm(args: string[], { cwd }: { cwd?: string } = {}) {
  await execAsyncSuccess("npm", args, { cwd });
}

async function checkPackagePublished(name: string, extra: Partial<Manifest> = {}) {
  const manifest = await pacote.manifest(`${name}@1.0.0`, { registry: MOCK_REGISTRY, fullMetadata: true });
  expect(manifest).toMatchObject({
    ...extra,
    _id: `${name}@1.0.0`,
    _resolved: `http://localhost:4873/${name}/-/${name}-1.0.0.tgz`,
    dist: {
      tarball: `http://localhost:4873/${name}/-/${name}-1.0.0.tgz`,
    },
  });
}

describe("with npm", () => {
  it("publish package directly from folder", { timeout: 20_000 }, async () => {
    const pkg = await addPackageJson("packages/pkg-npm-a/package.json", "pkg-npm-a");
    const result = await publishPackageWithNpm(pkg, resolvePath(testDir.path, "packages/pkg-npm-a/"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      filename: "pkg-npm-a-1.0.0.tgz",
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-npm-a");
  });

  it("publish tgz", { timeout: 20_000 }, async () => {
    const pkg = await addPackageJson("packages/pkg-npm-b/package.json", "pkg-npm-b");
    await mkdir(resolvePath(testDir.path, "artifacts"), { recursive: true });
    await runNpm(["pack", "--pack-destination", resolvePath(testDir.path, "artifacts")], {
      cwd: resolvePath(testDir.path, "packages/pkg-npm-b/"),
    });
    const result = await publishPackageWithNpm(pkg, resolvePath(testDir.path, "artifacts", "pkg-npm-b-1.0.0.tgz"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      filename: "pkg-npm-b-1.0.0.tgz",
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-npm-a");
  });
});
describe("with pnpm", () => {
  it("publish package directly from folder", { timeout: 20_000 }, async () => {
    const pkg = await addPackageJson("packages/pkg-pnpm-a/package.json", "pkg-pnpm-a");
    const result = await publishPackageWithPnpm(pkg, resolvePath(testDir.path, "packages/pkg-pnpm-a/"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      filename: "pkg-pnpm-a-1.0.0.tgz",
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-npm-a");
  });

  it("publish tgz", { timeout: 20_000 }, async () => {
    const pkg = await addPackageJson("packages/pkg-pnpm-b/package.json", "pkg-pnpm-b");
    await mkdir(resolvePath(testDir.path, "artifacts"), { recursive: true });
    await runNpm(["pack", "--pack-destination", resolvePath(testDir.path, "artifacts")], {
      cwd: resolvePath(testDir.path, "packages/pkg-pnpm-b/"),
    });
    const result = await publishPackageWithPnpm(pkg, resolvePath(testDir.path, "artifacts", "pkg-pnpm-b-1.0.0.tgz"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      filename: "pkg-pnpm-b-1.0.0.tgz",
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-npm-a");
  });

  it("replace workspace: annotation with real versions", { timeout: 20_000 }, async () => {
    await testDir.addFile(
      "pnpm-workspace.yaml",
      dump({
        packages: ["packages/*"],
      }),
    );
    await addPackageJson("packages/pkg-pnpm-a/package.json", "pkg-pnpm-a");
    await addPackageJson("packages/pkg-pnpm-b/package.json", "pkg-pnpm-b");
    const pkg = await addPackageJson("packages/pkg-pnpm-c/package.json", "pkg-pnpm-c", {
      dependencies: { "pkg-pnpm-a": "workspace:*", "pkg-pnpm-b": "workspace:^" },
    });
    await execAsyncSuccess("pnpm", ["install"], { cwd: testDir.path });
    const result = await publishPackageWithPnpm(pkg, resolvePath(testDir.path, "packages/pkg-pnpm-c/"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      filename: "pkg-pnpm-c-1.0.0.tgz",
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-pnpm-c", {
      dependencies: {
        "pkg-pnpm-a": "1.0.0",
        "pkg-pnpm-b": "^1.0.0",
      },
    });
  });
});
