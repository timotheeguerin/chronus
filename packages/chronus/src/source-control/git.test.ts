import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDir, type TestDir } from "../testing/index.js";
import { execAsync } from "../utils/exec-async.js";
import { createGitSourceControl, type GitRepository } from "./git.js";

describe("git", () => {
  let cwd: string;
  let testDir: TestDir;
  let git: GitRepository;
  beforeEach(async () => {
    testDir = await createTestDir();
    cwd = testDir.path;
    git = createGitSourceControl(cwd);

    // Init mock repo
    await execAsync("git", ["init", "--initial-branch", "main"], { cwd });
    // Need to set fake email and name
    await execAsync("git", ["config", "user.email", "a@b.c"], { cwd });
    await execAsync("git", ["config", "user.name", "abc"], { cwd });
  });

  async function listStaggedFiles(): Promise<string[]> {
    return git.listStagedFiles();
  }

  async function listUntrackedFiles(): Promise<string[]> {
    return git.listUntrackedFiles();
  }

  describe("getRepoRoot", () => {
    beforeEach(async () => {
      await testDir.addFile("packages/pkg-a/src/foo/bar.ts");
    });

    it("finds repo root when located one folder deep", async () => {
      const createdUnderPackages = createGitSourceControl(join(cwd, "packages"));
      expect(await createdUnderPackages.getRepoRoot()).toEqual(cwd);
    });

    it("finds repo root when located multiple folder deep", async () => {
      const createdUnderPackages = createGitSourceControl(join(cwd, "packages/pkg-a/src"));
      expect(await createdUnderPackages.getRepoRoot()).toEqual(cwd);
    });
  });

  describe("get current branch", () => {
    beforeEach(async () => {
      await testDir.addFile("package.json", "{}");
      await git.add("package.json");
      await git.commit("initial");
    });

    it("main default branch", async () => {
      const git = createGitSourceControl(cwd);
      expect(await git.getCurrentBranch()).toEqual("main");
    });

    it("picks up current branch", async () => {
      const git = createGitSourceControl(cwd);
      await execAsync("git", ["checkout", "-b", "test-branch"], { cwd });

      expect(await git.getCurrentBranch()).toEqual("test-branch");
    });
  });

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
      await git.add("packages/pkg-a/src/index.ts");

      expect(await listStaggedFiles()).toEqual(["packages/pkg-a/src/index.ts"]);
    });

    it("should stage a directory", async () => {
      await git.add("packages/pkg-a");

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
      await git.add("packages/pkg-a/src/index.ts");
      await git.commit("Adding pkg-a index.ts only");

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

      await git.add("packages/pkg-a/tracked-not-modified.ts");
      await git.add("packages/pkg-a/tracked-modified.ts");
      await git.commit("Adding pkg-a index.ts only");

      await git.add("packages/pkg-a/staged.ts");

      await testDir.writeFile("packages/pkg-a/tracked-modified.ts", "export default {};");
    });

    describe("listUntrackedFiles", () => {
      it("should only list untracked files", async () => {
        expect(await git.listUntrackedFiles()).toEqual(["packages/pkg-a/not-tracked.ts"]);
      });
    });

    describe("listModifiedFiles", () => {
      it("should only tracked files that are modified", async () => {
        expect(await git.listModifiedFiles()).toEqual(["packages/pkg-a/tracked-modified.ts"]);
      });
    });

    describe("listUntrackedOrModifiedFiles", () => {
      it("should list untracked and modified files that are not staged", async () => {
        expect(await git.listUntrackedOrModifiedFiles()).toEqual([
          "packages/pkg-a/not-tracked.ts",
          "packages/pkg-a/tracked-modified.ts",
        ]);
      });
    });

    describe("listStagedFiles", () => {
      it("should only list staged files", async () => {
        expect(await git.listStagedFiles()).toEqual(["packages/pkg-a/staged.ts"]);
      });
    });
  });

  describe("getChangedFilesSince", () => {
    let initialCommit: string;
    let secondCommit: string;
    let thirdCommit: string;

    async function addFileAndCommit(message: string, paths: string[]) {
      for (const path of paths) {
        await testDir.addFile(path);
        await git.add(path);
      }
      await git.commit(message);
      return await git.getCurrentCommitId();
    }

    /**
     * Initial Commit -> Second Commit -> Third Commit
     *                            |-> Feat commit
     *
     */
    beforeEach(async () => {
      initialCommit = await addFileAndCommit("Initial commit", ["initial.ts"]);
      secondCommit = await addFileAndCommit("Second commit", ["second-1.ts", "test/second-2.ts"]);
      thirdCommit = await addFileAndCommit("Third commit", ["third.ts"]);

      // Branch of a the 2nd commit
      await execAsync("git", ["checkout", secondCommit], { cwd });
      await execAsync("git", ["checkout", "-b", "feat-1"], { cwd });
      await addFileAndCommit("Feat commit", ["feat-1.ts", "feat-2.ts"]);

      await testDir.addFile("uncommited.ts");
      await git.add("uncommited.ts");
      await testDir.addFile("untracked.ts");
    });

    it("shows every change since the inital commit", async () => {
      expect(await git.listChangedFilesSince(initialCommit)).toEqual([
        "feat-1.ts",
        "feat-2.ts",
        "second-1.ts",
        "test/second-2.ts",
      ]);
    });

    it("shows every change since the second commit", async () => {
      expect(await git.listChangedFilesSince(secondCommit)).toEqual(["feat-1.ts", "feat-2.ts"]);
    });

    it("resolve common base and only shows change in current branch", async () => {
      expect(await git.listChangedFilesSince(thirdCommit)).toEqual(["feat-1.ts", "feat-2.ts"]);
      expect(await git.listChangedFilesSince("main")).toEqual(["feat-1.ts", "feat-2.ts"]);
    });
  });
});
