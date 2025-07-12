import { REGISTRY_MOCK_PORT, prepare, start } from "@chronus/registry-mock";
import type { ChildProcess } from "child_process";
import { mkdir, readFile, writeFile } from "fs/promises";
import pacote, { type Manifest } from "pacote";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { createTestDir, type TestDir } from "../testing/test-dir.js";
import { execAsync } from "../utils/exec-async.js";
import { resolvePath } from "../utils/path-utils.js";
import type { Package, PackageJson } from "../workspace-manager/node/types.js";
import { publishPackageWithNpm, publishPackageWithPnpm } from "./publish-package.js";

const MOCK_REGISTRY = `http://localhost:${REGISTRY_MOCK_PORT}/`;
let killed = false;
let server: ChildProcess;

interface TestPackage extends Package {
  readonly absolutePath: string;
}
beforeAll(async () => {
  await prepare();
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
  await writeCredentials();
  await createTestPackage("", "root", { private: true });
});

async function writeCredentials(dir: string = "") {
  await testDir.addFile(resolvePath(dir, ".npmrc"), `//localhost:${REGISTRY_MOCK_PORT}/:_authToken="fake"`);
}

async function createTestPackage(
  path: string,
  name: string,
  manifestProps: Partial<PackageJson> = {},
): Promise<TestPackage> {
  const manifest = { name, version: "1.0.0", ...manifestProps };
  await testDir.addFile(resolvePath(path, "package.json"), JSON.stringify(manifest));
  await writeCredentials(path);

  return {
    name,
    version: manifest.version,
    manifest,
    relativePath: path,
    absolutePath: resolvePath(testDir.path, path),
  };
}
async function patchPackageJson(pkg: TestPackage, manifestProps: Partial<PackageJson> = {}): Promise<TestPackage> {
  const path = resolvePath(pkg.absolutePath, "package.json");
  const content = await readFile(path, "utf8");
  const manifest = { ...JSON.parse(content), ...manifestProps };
  await writeFile(path, JSON.stringify(manifest));
  return {
    ...pkg,
    version: manifest.version,
    manifest,
  };
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
function getTagVersion(pkg: TestPackage, tag: string) {
  return pacote.manifest(`${pkg.name}@${tag}`, { registry: MOCK_REGISTRY }).then((manifest) => manifest.version);
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
  it("publish directly from folder", { timeout: 20_000 }, async () => {
    const pkg = await createTestPackage("packages/pkg-npm-a", "pkg-npm-a");
    const result = await publishPackageWithNpm(pkg, resolvePath(testDir.path, "packages/pkg-npm-a/"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-npm-a");
  });

  it("publish tgz", { timeout: 20_000 }, async () => {
    const pkg = await createTestPackage("packages/pkg-npm-b", "pkg-npm-b");
    await mkdir(resolvePath(testDir.path, "artifacts"), { recursive: true });

    await runNpm(["pack", "--pack-destination", resolvePath(testDir.path, "artifacts")], {
      cwd: pkg.absolutePath,
    });
    const result = await publishPackageWithNpm(pkg, resolvePath(testDir.path, "artifacts", "pkg-npm-b-1.0.0.tgz"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-npm-b");
  });

  it("apply tags", { timeout: 20_000 }, async () => {
    let pkg: TestPackage = await createTestPackage("packages/pkg-npm-tags", "pkg-npm-tags");

    const first = await publishPackageWithNpm(pkg, pkg.absolutePath, {
      registry: MOCK_REGISTRY,
    });
    expect(first.published).toBe(true);
    expect(await getTagVersion(pkg, "latest")).toBe("1.0.0");

    pkg = await patchPackageJson(pkg, { version: "1.0.1" });
    const second = await publishPackageWithNpm(pkg, pkg.absolutePath, {
      registry: MOCK_REGISTRY,
    });
    expect(second.published).toBe(true);
    expect(await getTagVersion(pkg, "latest")).toBe("1.0.1");

    pkg = await patchPackageJson(pkg, { version: "1.0.2" });
    const third = await publishPackageWithNpm(pkg, pkg.absolutePath, {
      registry: MOCK_REGISTRY,
      tag: "next",
    });
    expect(third.published).toBe(true);
    expect(await getTagVersion(pkg, "next")).toBe("1.0.2");
    expect(await getTagVersion(pkg, "latest")).toBe("1.0.1");
  });
});

describe("with pnpm", () => {
  it("publish directly from folder", { timeout: 20_000 }, async () => {
    const pkg = await createTestPackage("packages/pkg-pnpm-a", "pkg-pnpm-a");
    const result = await publishPackageWithPnpm(pkg, resolvePath(testDir.path, "packages/pkg-pnpm-a/"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-pnpm-a");
  });

  it.skip("publish tgz", { timeout: 20_000 }, async () => {
    const pkg = await createTestPackage("packages/pkg-pnpm-b", "pkg-pnpm-b");

    await mkdir(resolvePath(testDir.path, "artifacts"), { recursive: true });
    await runNpm(["pack", "--pack-destination", resolvePath(testDir.path, "artifacts")], {
      cwd: pkg.absolutePath,
    });
    const result = await publishPackageWithPnpm(pkg, resolvePath(testDir.path, "artifacts", "pkg-pnpm-b-1.0.0.tgz"), {
      registry: MOCK_REGISTRY,
    });
    expect(result).toEqual({
      published: true,
      name: pkg.name,
      version: pkg.version,
      size: expect.any(Number),
      unpackedSize: expect.any(Number),
    });
    await checkPackagePublished("pkg-pnpm-b");
  });

  it("replace workspace: annotation with real versions", { timeout: 20_000 }, async () => {
    await testDir.addFile(
      "pnpm-workspace.yaml",
      stringify({
        packages: ["packages/*"],
      }),
    );
    await createTestPackage("packages/pkg-pnpm-a", "pkg-pnpm-a");
    await createTestPackage("packages/pkg-pnpm-b", "pkg-pnpm-b");
    const pkg = await createTestPackage("packages/pkg-pnpm-c", "pkg-pnpm-c", {
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

  it("apply tags", { timeout: 20_000 }, async () => {
    let pkg: TestPackage = await createTestPackage("packages/pkg-pnpm-tags", "pkg-pnpm-tags");

    const first = await publishPackageWithPnpm(pkg, pkg.absolutePath, {
      registry: MOCK_REGISTRY,
    });
    expect(first.published).toBe(true);
    expect(await getTagVersion(pkg, "latest")).toBe("1.0.0");

    pkg = await patchPackageJson(pkg, { version: "1.0.1" });
    const second = await publishPackageWithPnpm(pkg, pkg.absolutePath, {
      registry: MOCK_REGISTRY,
    });
    expect(second.published).toBe(true);
    expect(await getTagVersion(pkg, "latest")).toBe("1.0.1");

    pkg = await patchPackageJson(pkg, { version: "1.0.2" });
    const third = await publishPackageWithPnpm(pkg, pkg.absolutePath, {
      registry: MOCK_REGISTRY,
      tag: "next",
    });
    expect(third.published).toBe(true);
    expect(await getTagVersion(pkg, "next")).toBe("1.0.2");
    expect(await getTagVersion(pkg, "latest")).toBe("1.0.1");
  });
});
