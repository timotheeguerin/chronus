import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGitSourceControl, type GitRepository } from "../../source-control/git.js";
import { createTestDir, type TestDir } from "../../testing/index.js";
import { mkChronusConfigFile, mkPnpmWorkspaceFile } from "../../testing/test-chronus-workspace.js";
import { execAsync } from "../../utils/exec-async.js";
import { addChangeset } from "./add-changeset.js";

let cwd: string;
let testDir: TestDir;
let git: GitRepository;

async function setupWorkspace() {
  testDir = await createTestDir();
  cwd = testDir.path;
  git = createGitSourceControl(cwd);

  // Init mock repo (no remote needed - git.ts handles this case)
  await execAsync("git", ["init", "--initial-branch", "main"], { cwd });
  await execAsync("git", ["config", "user.email", "test@test.com"], { cwd });
  await execAsync("git", ["config", "user.name", "Test User"], { cwd });

  // Setup a basic pnpm workspace with chronus config
  await testDir.addFile("pnpm-workspace.yaml", mkPnpmWorkspaceFile());
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile());

  // Add packages
  await testDir.addFile("packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  await testDir.addFile("packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "2.0.0" }));

  // Initial commit
  await git.add(".");
  await git.commit("Initial commit");
}

async function createFeatureBranchWithChanges(packages: string[]) {
  // Create a feature branch
  await execAsync("git", ["checkout", "-b", "feature-branch"], { cwd });

  // Make changes to specified packages
  for (const pkg of packages) {
    await testDir.addFile(`packages/${pkg}/src/index.ts`, `export const foo = '${pkg}';`);
  }
  await git.add(".");
  await git.commit(`Add feature to ${packages.join(", ")}`);
}

describe("with all options provided", () => {
  it("creates a changeset file with specified packages, changeKind, and message", async () => {
    await setupWorkspace();
    await createFeatureBranchWithChanges(["pkg-a"]);

    await addChangeset({
      cwd,
      packages: ["pkg-a"],
      changeKind: "minor",
      message: "Add new foo feature",
    });

    // Verify changeset file was created
    const changeDir = join(cwd, ".chronus/changes");
    const files = await readdir(changeDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^feature-branch-/);

    // Verify content of changeset
    const content = await readFile(join(changeDir, files[0]), "utf-8");
    expect(content).toContain("changeKind: minor");
    expect(content).toContain("packages:");
    expect(content).toContain("- pkg-a");
    expect(content).toContain("Add new foo feature");
  });

  it("creates a changeset with multiple packages", async () => {
    await setupWorkspace();
    await createFeatureBranchWithChanges(["pkg-a", "pkg-b"]);

    await addChangeset({
      cwd,
      packages: ["pkg-a", "pkg-b"],
      changeKind: "patch",
      message: "Fix bug in both packages",
    });

    const changeDir = join(cwd, ".chronus/changes");
    const files = await readdir(changeDir);
    expect(files).toHaveLength(1);

    const content = await readFile(join(changeDir, files[0]), "utf-8");
    expect(content).toContain("changeKind: patch");
    expect(content).toContain("- pkg-a");
    expect(content).toContain("- pkg-b");
    expect(content).toContain("Fix bug in both packages");
  });

  it("throws error when changeKind is not defined in config", async () => {
    await setupWorkspace();
    await createFeatureBranchWithChanges(["pkg-a"]);

    await expect(
      addChangeset({
        cwd,
        packages: ["pkg-a"],
        changeKind: "nonexistent",
        message: "Some message",
      }),
    ).rejects.toThrow(/Change kind 'nonexistent' is not defined in the configuration/);
  });
});
