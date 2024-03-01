import { REGISTRY_MOCK_PORT, prepare, start } from "@pnpm/registry-mock";
import type { ChildProcess } from "child_process";
import { mkdir } from "fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createTestDir, type TestDir } from "../testing/test-dir.js";
import { execAsync } from "../utils/exec-async.js";
import { resolvePath } from "../utils/path-utils.js";
import type { PackageBase } from "../workspace-manager/types.js";
import { publishPackage } from "./publish-package.js";

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
});

async function addPackageJson(path: string, name: string): Promise<PackageBase> {
  const manifest = { name, version: "1.0.0" };
  await testDir.addFile(path, JSON.stringify(manifest));
  return { name, version: manifest.version, manifest };
}

async function runNpm(args: string[], { cwd }: { cwd?: string } = {}) {
  const result = await execAsync("npm", args, { cwd });
  if (result.code !== 0) {
    throw new Error(`Failed to run npm: ${JSON.stringify(args)}\n${result.stdall}`);
  }
}

it("publish package directly from folder", { timeout: 20_000 }, async () => {
  const pkg = await addPackageJson("packages/pkg-a/package.json", "pkg-a");
  const result = await publishPackage(pkg, resolvePath(testDir.path, "packages/pkg-a/"), { registry: MOCK_REGISTRY });
  expect(result).toEqual({
    published: true,
    name: pkg.name,
    version: pkg.version,
    filename: "pkg-a-1.0.0.tgz",
    size: expect.any(Number),
    unpackedSize: expect.any(Number),
  });
});

it("publish tgz", { timeout: 20_000 }, async () => {
  const pkg = await addPackageJson("packages/pkg-a/package.json", "pkg-a");
  await mkdir(resolvePath(testDir.path, "artifacts"), { recursive: true });
  await runNpm(["pack", "--pack-destination", resolvePath(testDir.path, "artifacts")], {
    cwd: resolvePath(testDir.path, "packages/pkg-a/"),
  });
  const result = await publishPackage(pkg, resolvePath(testDir.path, "artifacts", "pkg-a-1.0.0.tgz"), {
    registry: MOCK_REGISTRY,
  });
  expect(result).toEqual({
    published: true,
    name: pkg.name,
    version: pkg.version,
    filename: "pkg-a-1.0.0.tgz",
    size: expect.any(Number),
    unpackedSize: expect.any(Number),
  });
});
