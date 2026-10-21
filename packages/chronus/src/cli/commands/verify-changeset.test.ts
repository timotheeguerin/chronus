import { rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitSourceControl, type GitRepository } from "../../source-control/git.js";
import { createTestDir, type TestDir } from "../../testing/index.js";
import { mkChangeFile, mkChronusConfigFile, mkPnpmWorkspaceFile } from "../../testing/test-chronus-workspace.js";
import { execAsync } from "../../utils/exec-async.js";
import { bumpVersions } from "./bump-versions.js";
import { verifyChangeset } from "./verify-changeset.js";

let testDir: TestDir;
let git: GitRepository;

async function gitCommand(...args: string[]): Promise<void> {
  const result = await execAsync("git", args, { cwd: testDir.path });
  if (result.code !== 0) {
    throw new Error(result.stderr.toString());
  }
}

async function setVersion(name: string, version: string): Promise<void> {
  await testDir.addFile(`packages/${name}/package.json`, JSON.stringify({ name, version }));
}

async function addChange(name: string, packages: string | string[]): Promise<void> {
  await testDir.addFile(`.chronus/changes/${name}.md`, mkChangeFile(packages, "minor"));
}

async function commit(): Promise<void> {
  await git.add(".");
  await git.commit("Update workspace");
}

function runVerify(since?: string): Promise<void> {
  return verifyChangeset({ cwd: testDir.path, since });
}

beforeEach(async () => {
  testDir = await createTestDir();
  git = createGitSourceControl(testDir.path);
  vi.spyOn(console, "log").mockImplementation(() => {});
  await gitCommand("init", "--initial-branch", "main");
  await gitCommand("config", "user.email", "test@example.com");
  await gitCommand("config", "user.name", "Test User");
  await testDir.addFile("pnpm-workspace.yaml", mkPnpmWorkspaceFile());
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile());
  await setVersion("pkg-a", "1.0.0");
  await setVersion("pkg-b", "1.0.0");
  await addChange("existing", ["pkg-a", "pkg-b"]);
  await commit();
  await gitCommand("switch", "-c", "feature");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(testDir.path, { recursive: true, force: true });
});

it("allows ordinary package changes and pending changesets without a version bump", async () => {
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await addChange("new", "pkg-a");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("requires a new or modified changeset for ordinary changes, not an existing pending one", async () => {
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await commit();
  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "undocumented-package", message: expect.stringContaining("pkg-a") }],
  });
});

it("recognizes staged package changes and staged changesets", async () => {
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await git.add("packages/pkg-a/index.ts");
  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "undocumented-package", message: expect.stringContaining("pkg-a") }],
  });
  await addChange("staged", "pkg-a");
  await git.add(".chronus/changes/staged.md");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("recognizes changesets even when changedFiles excludes Markdown", async () => {
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile({ changedFiles: ["**/*.ts"] }));
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await addChange("new", "pkg-a");
  await commit();
  await expect(runVerify()).resolves.toBeUndefined();
});

it("reports every remaining changeset for a stable version bump, including unchanged changesets", async () => {
  await setVersion("pkg-a", "1.1.0");
  await addChange("new", "pkg-a");
  await commit();

  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [
      {
        code: "unconsumed-changeset",
        message: expect.stringContaining("Package 'pkg-a' changed version from '1.0.0' to '1.1.0'"),
        target: { file: { path: expect.stringContaining("/.chronus/changes/existing.md") } },
      },
      {
        code: "unconsumed-changeset",
        target: { file: { path: expect.stringContaining("/.chronus/changes/new.md") } },
      },
    ],
  });
});

it("allows a release after a shared changeset stops referencing the bumped package", async () => {
  await setVersion("pkg-a", "1.1.0");
  await testDir.addFile(".chronus/changes/existing.md", mkChangeFile("pkg-b", "minor"));
  await commit();
  await expect(runVerify()).resolves.toBeUndefined();
});

it("allows a complete release with no pending changesets and no extra flag", async () => {
  await bumpVersions(testDir.path);
  await commit();
  await expect(runVerify()).resolves.toBeUndefined();
});

it("still requires changesets for unreleased package changes in a partial release", async () => {
  await setVersion("pkg-a", "1.1.0");
  await rm(join(testDir.path, ".chronus/changes/existing.md"));
  await testDir.addFile("packages/pkg-b/index.ts", "export const value = 1;");
  await commit();
  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "undocumented-package", message: expect.stringContaining("pkg-b") }],
  });
  await addChange("unreleased", "pkg-b");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("checks staged and unstaged version bumps in the working tree", async () => {
  await setVersion("pkg-a", "1.1.0");
  await git.add("packages/pkg-a/package.json");
  await setVersion("pkg-b", "1.1.0");

  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [
      { code: "unconsumed-changeset", message: expect.stringContaining("Package 'pkg-a'") },
      { code: "unconsumed-changeset", message: expect.stringContaining("Package 'pkg-b'") },
    ],
  });
});

it("allows prerelease version bumps without consuming changesets", async () => {
  await setVersion("pkg-a", "1.1.0-dev.1");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("recognizes alpha-versioned package releases after consuming their changesets", async () => {
  await gitCommand("switch", "main");
  await setVersion("pkg-a", "0.1.0-alpha.45");
  await commit();
  await gitCommand("switch", "-c", "release");
  await setVersion("pkg-a", "0.1.0-alpha.46");
  await rm(join(testDir.path, ".chronus/changes/existing.md"));
  await commit();
  await expect(runVerify()).resolves.toBeUndefined();
});

it("still requires changesets for ordinary changes to an unchanged prerelease version", async () => {
  await gitCommand("switch", "main");
  await setVersion("pkg-a", "0.1.0-alpha.45");
  await commit();
  await gitCommand("switch", "-c", "feature-alpha");
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "undocumented-package", message: expect.stringContaining("pkg-a") }],
  });
  await addChange("new", "pkg-a");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("requires changesets to be consumed when promoting a prerelease to stable", async () => {
  await gitCommand("switch", "main");
  await setVersion("pkg-a", "1.1.0-dev.1");
  await commit();
  await gitCommand("switch", "-c", "release");
  await setVersion("pkg-a", "1.1.0");

  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "unconsumed-changeset", message: expect.stringContaining("'1.1.0-dev.1' to '1.1.0'") }],
  });
});

it("allows changesets for newly added packages", async () => {
  await setVersion("pkg-new", "1.0.0");
  await addChange("new-package", "pkg-new");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("requires a changeset for a newly added package instead of treating it as a release", async () => {
  await setVersion("pkg-new", "1.0.0");
  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "undocumented-package", message: expect.stringContaining("pkg-new") }],
  });
});

it("allows newly configured standalone packages without trying to load them at the base", async () => {
  await testDir.addFile(
    ".chronus/config.yaml",
    mkChronusConfigFile({
      packages: [
        { path: ".", type: "pnpm" },
        { path: "standalone", type: "npm", standalone: true },
      ],
    }),
  );
  await testDir.addFile("standalone/package.json", JSON.stringify({ name: "standalone", version: "1.0.0" }));
  await addChange("standalone", "standalone");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("supports adopting Chronus when the base has no Chronus configuration", async () => {
  await gitCommand("switch", "main");
  await rm(join(testDir.path, ".chronus/config.yaml"));
  await commit();
  await gitCommand("switch", "-c", "adopt-chronus");
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile());
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await addChange("new", "pkg-a");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("excludes private and ignored packages from the version consistency check", async () => {
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile({ ignore: ["pkg-a"] }));
  await setVersion("pkg-a", "1.1.0");
  await testDir.writeFile(
    "packages/pkg-b/package.json",
    JSON.stringify({ name: "pkg-b", version: "1.1.0", private: true }),
  );
  await expect(runVerify()).resolves.toBeUndefined();
});

it("supports Chronus workspaces below the Git repository root", async () => {
  await testDir.addFile("nested/.chronus/config.yaml", mkChronusConfigFile());
  await testDir.addFile("nested/pnpm-workspace.yaml", mkPnpmWorkspaceFile());
  await testDir.addFile("nested/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  await testDir.addFile("nested/.chronus/changes/pending.md", mkChangeFile("pkg-a", "minor"));
  await commit();
  const since = await git.getCurrentCommitId();
  await testDir.writeFile("nested/packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.1.0" }));
  await expect(verifyChangeset({ cwd: join(testDir.path, "nested/packages/pkg-a"), since })).rejects.toMatchObject({
    diagnostics: [{ code: "unconsumed-changeset", message: expect.stringContaining("'1.0.0' to '1.1.0'") }],
  });
});

it("matches packages by name when they move directories", async () => {
  await rename(join(testDir.path, "packages/pkg-a"), join(testDir.path, "packages/moved"));
  await testDir.writeFile("packages/moved/package.json", JSON.stringify({ name: "pkg-a", version: "1.1.0" }));
  await expect(runVerify()).rejects.toMatchObject({
    diagnostics: [{ code: "unconsumed-changeset", message: expect.stringContaining("Package 'pkg-a'") }],
  });
});

it("compares against the merge base, not newer changes on the base branch", async () => {
  await gitCommand("switch", "main");
  await setVersion("pkg-a", "1.1.0");
  await commit();
  await gitCommand("switch", "feature");
  await expect(runVerify()).resolves.toBeUndefined();
});

it("supports an explicit ref even when baseRemote is configured", async () => {
  const since = await git.getCurrentCommitId();
  await testDir.addFile(
    ".chronus/config.yaml",
    mkChronusConfigFile({ baseBranch: "missing-branch", baseRemote: "https://example.com/repo.git" }),
  );
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
  await addChange("new", "pkg-a");
  await commit();
  await expect(runVerify(since)).resolves.toBeUndefined();
});

it("reports unavailable comparison refs instead of succeeding", async () => {
  await expect(runVerify("missing-branch")).rejects.toThrow(/GitError running: git merge-base/);
});

it(
  "exposes the command and exits nonzero with an actionable diagnostic when data is invalid",
  { timeout: 20_000 },
  async () => {
    const cli = join(import.meta.dirname, "../../../cmd/cli.mjs");
    const valid = await execAsync(process.execPath, [cli, "verify", "--since", "main"], { cwd: testDir.path });
    expect(valid.code).toBe(0);
    expect(valid.stdout.toString()).toContain("All changed packages have been documented:");

    await setVersion("pkg-a", "1.1.0");
    const invalid = await execAsync(process.execPath, [cli, "verify", "--since", "main"], { cwd: testDir.path });
    expect(invalid.code).toBe(1);
    expect(invalid.stdout.toString()).toContain("unconsumed-changeset");
    expect(invalid.stdout.toString()).toContain(".chronus/changes/existing.md");
    expect(invalid.stdout.toString()).toContain("pkg-a");
  },
);

describe("existing data validation", () => {
  it("reports invalid package versions", async () => {
    await setVersion("pkg-a", "not-a-version");
    await expect(runVerify()).rejects.toMatchObject({
      diagnostics: [{ code: "invalid-package-version", message: expect.stringContaining("pkg-a") }],
    });
  });

  it("validates configuration before comparing versions", async () => {
    await testDir.addFile(".chronus/config.yaml", "baseBranch: 123");
    await expect(runVerify()).rejects.toMatchObject({
      diagnostics: [expect.objectContaining({ severity: "error" })],
    });
  });

  it("collects malformed changesets, invalid change kinds, and unknown package references", async () => {
    await testDir.addFile(".chronus/changes/bad-front-matter.md", "Missing front matter");
    await testDir.addFile(
      ".chronus/changes/bad-kind.md",
      mkChangeFile("pkg-a", "minor").replace("changeKind: minor", "changeKind: unknown"),
    );
    await addChange("bad-package", "unknown-package");

    await expect(runVerify()).rejects.toMatchObject({
      diagnostics: [
        { code: "missing-front-matter" },
        { code: "invalid-change-kind" },
        { code: "invalid-package-name" },
      ],
    });
  });
});

it("uses ecosystem loaders for historical Python dynamic versions", async () => {
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile({ packages: [{ path: "python", type: "pip" }] }));
  await rm(join(testDir.path, ".chronus/changes/existing.md"));
  await testDir.addFile(
    "python/pyproject.toml",
    '[project]\nname = "py-package"\ndynamic = ["version"]\n[tool.hatch.version]\npath = "src/_version.py"\n',
  );
  await testDir.addFile("python/src/_version.py", '__version__ = "1.0.0"\n');
  await addChange("python", "py-package");
  await commit();
  const since = await git.getCurrentCommitId();
  await testDir.writeFile("python/src/_version.py", '__version__ = "1.1.0"\n');

  await expect(runVerify(since)).rejects.toMatchObject({
    diagnostics: [{ code: "unconsumed-changeset", message: expect.stringContaining("'1.0.0' to '1.1.0'") }],
  });
});
