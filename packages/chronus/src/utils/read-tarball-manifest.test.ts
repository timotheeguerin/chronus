import { writeFile } from "fs/promises";

import { createTarGzip } from "nanotar";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestDir, type TestDir } from "../testing/test-dir.js";
import { resolvePath } from "./path-utils.js";
import { readPackageManifestFromTarball } from "./read-tarball-manifest.js";

let testDir: TestDir;
beforeEach(async () => {
  testDir = await createTestDir();
});

async function writeTarball(name: string, files: { name: string; data: string }[]): Promise<string> {
  const gzipped = await createTarGzip(files);
  const path = resolvePath(testDir.path, name);
  await writeFile(path, gzipped);
  return path;
}

describe("readPackageManifestFromTarball", () => {
  it("reads name, version and _id from package/package.json", async () => {
    const tarball = await writeTarball("pkg.tgz", [
      { name: "package/README.md", data: "# decoy" },
      { name: "package/package.json", data: JSON.stringify({ name: "my-pkg", version: "1.2.3" }) },
    ]);

    const manifest = await readPackageManifestFromTarball(tarball);

    expect(manifest).toMatchObject({
      _id: "my-pkg@1.2.3",
      name: "my-pkg",
      version: "1.2.3",
    });
  });

  it("passes through extra manifest fields", async () => {
    const tarball = await writeTarball("pkg-deps.tgz", [
      {
        name: "package/package.json",
        data: JSON.stringify({
          name: "with-deps",
          version: "2.0.0",
          dependencies: { dep: "^1.0.0" },
        }),
      },
    ]);

    const manifest = await readPackageManifestFromTarball(tarball);

    expect(manifest.dependencies).toEqual({ dep: "^1.0.0" });
  });

  it("throws when package/package.json is missing", async () => {
    const tarball = await writeTarball("no-manifest.tgz", [{ name: "package/README.md", data: "# nope" }]);

    await expect(readPackageManifestFromTarball(tarball)).rejects.toThrow("Could not find `package/package.json`");
  });
});
