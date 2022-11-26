import { beforeEach, describe, expect, it } from "@jest/globals";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execAsync } from "../utils/exec-async.js";
import { createGitSourceControl, GitSourceControl } from "./git.js";

async function tempdir(): Promise<string> {
  const date = new Date().toJSON().slice(0, -5);
  const uid = randomBytes(8).toString("hex");
  const path = join(process.cwd(), `.temp/tests/${date}/${uid}`);
  await mkdir(path, { recursive: true });
  return path;
}

export interface TestDir {
  readonly path: string;
  addFile(path: string, content?: string): Promise<void>;
}

async function createTestDir(): Promise<TestDir> {
  const testDirPath = await tempdir();

  return {
    path: testDirPath,
    addFile,
  };

  async function addFile(path: string, content: string = "") {
    const fullpath = join(testDirPath, path);
    const dir = dirname(fullpath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullpath, content);
  }
}

describe("git", () => {
  let cwd: string;
  let testDir: TestDir;
  let git: GitSourceControl;
  beforeEach(async () => {
    testDir = await createTestDir();
    cwd = testDir.path;
    git = createGitSourceControl();

    // Init mock repo
    await execAsync("git", ["init"], { cwd });
  });

  async function listStaggedFiles(): Promise<string[]> {
    const result = await execAsync("git", ["ls-files", "--cached"], {
      cwd,
    });
    return result.stdout
      .toString()
      .split("\n")
      .filter((a) => a);
  }

  async function listUntrackedChanges(): Promise<string[]> {
    const result = await execAsync("git", ["ls-files", "--others"], {
      cwd,
    });
    return result.stdout
      .toString()
      .split("\n")
      .filter((a) => a);
  }

  describe("add", () => {
    beforeEach(async () => {
      await testDir.addFile("packages/pkg-a/package.json", "{}");
      await testDir.addFile("packages/pkg-a/src/index.ts");
      await testDir.addFile("packages/pkg-a/src/index.test.ts");

      await testDir.addFile("packages/pkg-b/package.json", "{}");
      await testDir.addFile("packages/pkg-b/src/index.ts");
      await testDir.addFile("packages/pkg-b/src/index.test.ts");
    });

    it("should stage a single file", async () => {
      await git.add("packages/pkg-a/src/index.ts", cwd);

      expect(await listStaggedFiles()).toEqual(["packages/pkg-a/src/index.ts"]);
    });

    it("should stage a directory", async () => {
      await git.add("packages/pkg-a", cwd);

      expect(await listStaggedFiles()).toEqual([
        "packages/pkg-a/package.json",
        "packages/pkg-a/src/index.test.ts",
        "packages/pkg-a/src/index.ts",
      ]);
    });
  });

  describe("commit", () => {
    beforeEach(async () => {
      await testDir.addFile("packages/pkg-a/package.json", "{}");
      await testDir.addFile("packages/pkg-a/src/index.ts");
      await testDir.addFile("packages/pkg-a/src/index.test.ts");
    });

    it("should commit only staged files", async () => {
      await git.add("packages/pkg-a/src/index.ts", cwd);
      await git.commit("Adding pkg-a index.ts only", cwd);

      const gitCmd = await execAsync("git", ["log", "-1", "--pretty=%B"], {
        cwd,
      });
      const commitMessage = gitCmd.stdout.toString().trim();
      expect(commitMessage).toEqual("Adding pkg-a index.ts only");

      expect(await listUntrackedChanges()).toEqual(["packages/pkg-a/package.json", "packages/pkg-a/src/index.test.ts"]);
    });
  });
});
