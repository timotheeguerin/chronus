import { rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";

import type { VerifyConfig } from "../../config/types.js";
import { createGitSourceControl, type GitRepository } from "../../source-control/git.js";
import { createTestDir, type TestDir } from "../../testing/index.js";
import { mkChangeFile, mkChronusConfigFile, mkPnpmWorkspaceFile } from "../../testing/test-chronus-workspace.js";
import { ChronusDiagnosticError } from "../../utils/errors.js";
import { execAsync } from "../../utils/exec-async.js";
import { verifyChangeset } from "./verify-changeset.js";

let testDir: TestDir;
let git: GitRepository;
let log: MockInstance;

async function gitCommand(...args: string[]): Promise<void> {
  const result = await execAsync("git", args, { cwd: testDir.path });
  if (result.code !== 0) {
    throw new Error(result.stderr.toString());
  }
}

async function setPolicy(verify?: VerifyConfig): Promise<void> {
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile({ verify }));
}

beforeEach(async () => {
  testDir = await createTestDir();
  git = createGitSourceControl(testDir.path);
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  for (const name of [
    "GITHUB_EVENT_NAME",
    "GITHUB_EVENT_PATH",
    "GITHUB_HEAD_REF",
    "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER",
    "SYSTEM_PULLREQUEST_SOURCEBRANCH",
    "BUILD_REPOSITORY_NAME",
    "GH_REPO",
    "GH_PR_NUMBER",
    "GH_PR_HEAD_REF",
    "GH_PR_TITLE",
  ]) {
    vi.stubEnv(name, undefined);
  }
  await gitCommand("init", "--initial-branch", "main");
  await gitCommand("config", "user.email", "test@example.com");
  await gitCommand("config", "user.name", "Test User");
  await testDir.addFile("pnpm-workspace.yaml", mkPnpmWorkspaceFile());
  await setPolicy();
  await testDir.addFile("packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  await git.add(".");
  await git.commit("Initial workspace");
  await gitCommand("switch", "-c", "feature");
  await testDir.addFile("packages/pkg-a/index.ts", "export const value = 1;");
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(testDir.path, { recursive: true, force: true });
});

it("waives new changesets for a configured local branch and reports the reason", async () => {
  await setPolicy({ changesetRequirement: { excludeBranches: ["publish/**"] } });
  await gitCommand("switch", "-c", "publish/release");
  await expect(verifyChangeset({ cwd: testDir.path })).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(expect.stringContaining("source branch 'publish/release'"));
});

it("matches CI source branches, including Azure DevOps refs, instead of the local checkout branch", async () => {
  await setPolicy({ changesetRequirement: { excludeBranches: ["publish/**"] } });
  vi.stubEnv("GH_PR_HEAD_REF", "refs/heads/publish/release");
  await expect(verifyChangeset({ cwd: testDir.path })).resolves.toBeUndefined();
});

it("matches configured literal title fragments case-insensitively", async () => {
  await setPolicy({ changesetRequirement: { excludeTitleContains: ["[skip chg]"] } });
  vi.stubEnv("GH_PR_TITLE", "[SKIP CHG] Update CI");
  await expect(verifyChangeset({ cwd: testDir.path })).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(expect.stringContaining("PR title contains '[skip chg]'"));
});

it.each([
  { label: "an unconfigured skip marker", verify: undefined, title: "[skip chg] Update CI" },
  {
    label: "an unavailable PR title",
    verify: { changesetRequirement: { excludeTitleContains: ["[skip chg]"] } },
    title: undefined,
  },
  {
    label: "a nonmatching source branch",
    verify: { changesetRequirement: { excludeBranches: ["publish/**"] } },
    title: undefined,
  },
])("still requires changesets with $label", async ({ verify, title }) => {
  await setPolicy(verify);
  vi.stubEnv("GH_PR_TITLE", title);
  const result = await execAsync(process.execPath, [join(import.meta.dirname, "../../../cmd/cli.mjs"), "verify"], {
    cwd: testDir.path,
  });
  expect(result.code).toBe(1);
  expect(result.stdout.toString()).toContain("pkg-a");
});

it("still rejects malformed changesets when a branch exemption matches", async () => {
  await setPolicy({ changesetRequirement: { excludeBranches: ["feature"] } });
  await testDir.addFile(".chronus/changes/invalid.md", "Missing front matter");
  await expect(verifyChangeset({ cwd: testDir.path })).rejects.toBeInstanceOf(ChronusDiagnosticError);
});

it.each(["branch", "title"] as const)(
  "still rejects unconsumed stable-release changesets when a %s exemption matches",
  async (kind) => {
    await setPolicy({
      changesetRequirement:
        kind === "branch" ? { excludeBranches: ["feature"] } : { excludeTitleContains: ["[skip chg]"] },
    });
    vi.stubEnv("GH_PR_TITLE", "[skip chg] Release");
    await testDir.writeFile("packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.1.0" }));
    await testDir.addFile(".chronus/changes/pending.md", mkChangeFile("pkg-a", "minor"));
    await expect(verifyChangeset({ cwd: testDir.path })).rejects.toMatchObject({
      diagnostics: [{ code: "unconsumed-changeset", message: expect.stringContaining("pkg-a") }],
    });
  },
);

it("recognizes staged changesets even when changedFiles excludes Markdown", async () => {
  await testDir.addFile(".chronus/config.yaml", mkChronusConfigFile({ changedFiles: ["**/*.ts"] }));
  await testDir.addFile(".chronus/changes/documented.md", mkChangeFile("pkg-a", "minor"));
  await git.add(".chronus/changes/documented.md");
  await expect(verifyChangeset({ cwd: testDir.path })).resolves.toBeUndefined();
});
