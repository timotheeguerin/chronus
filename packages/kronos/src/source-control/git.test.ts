import { beforeEach, describe, expect, it } from "@jest/globals";
import { createTestDir, TestDir } from "../testing/index.js";
import { execAsync } from "../utils/exec-async.js";
import { createGitSourceControl, GitSourceControl } from "./git.js";

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
    // Need to set fake email and name
    await execAsync("git", ["config", "user.email", "a@b.c"], { cwd });
    await execAsync("git", ["config", "user.name", "abc"], { cwd });
  });

  async function listStaggedFiles(): Promise<string[]> {
    return git.listStagedFiles(cwd);
  }

  async function listUntrackedFiles(): Promise<string[]> {
    return git.listUntrackedFiles(cwd);
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

      expect(await listUntrackedFiles()).toEqual(["packages/pkg-a/package.json", "packages/pkg-a/src/index.test.ts"]);
    });
  });

  describe("list files", () => {
    beforeEach(async () => {
      await testDir.addFile("packages/pkg-a/tracked-not-modified.ts");
      await testDir.addFile("packages/pkg-a/tracked-modified.ts");
      await testDir.addFile("packages/pkg-a/staged.ts");
      await testDir.addFile("packages/pkg-a/not-tracked.ts");

      await git.add("packages/pkg-a/tracked-not-modified.ts", cwd);
      await git.add("packages/pkg-a/tracked-modified.ts", cwd);
      await git.commit("Adding pkg-a index.ts only", cwd);

      await git.add("packages/pkg-a/staged.ts", cwd);

      await testDir.writeFile("packages/pkg-a/tracked-modified.ts", "export default {};");
    });

    describe("listUntrackedFiles", () => {
      it("should only list untracked files", async () => {
        expect(await git.listUntrackedFiles(cwd)).toEqual(["packages/pkg-a/not-tracked.ts"]);
      });
    });

    describe("listModifiedFiles", () => {
      it("should only tracked files that are modified", async () => {
        expect(await git.listModifiedFiles(cwd)).toEqual(["packages/pkg-a/tracked-modified.ts"]);
      });
    });

    describe("listUntrackedOrModifiedFiles", () => {
      it("should list untracked and modified files that are not staged", async () => {
        expect(await git.listUntrackedOrModifiedFiles(cwd)).toEqual([
          "packages/pkg-a/not-tracked.ts",
          "packages/pkg-a/tracked-modified.ts",
        ]);
      });
    });

    describe("listStagedFiles", () => {
      it("should only list staged files", async () => {
        expect(await git.listStagedFiles(cwd)).toEqual(["packages/pkg-a/staged.ts"]);
      });
    });
  });
});
