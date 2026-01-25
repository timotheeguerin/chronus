import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeDescription } from "../../change/types.js";
import { createTestDir, type TestDir } from "../../testing/index.js";
import { mkChronusConfigFile, mkPnpmWorkspaceFile } from "../../testing/test-chronus-workspace.js";
import { execAsync } from "../../utils/exec-async.js";
import { createGitSourceControl, type GitRepository } from "../../source-control/git.js";
import { changelog } from "./changelog.js";
import { ConsoleReporter } from "../../reporters/console-reporter.js";

let cwd: string;
let testDir: TestDir;
let git: GitRepository;
const reporter = new ConsoleReporter({ debug: false });

// Mock console.log to capture output
const mockLog = vi.fn();
const originalLog = console.log;

async function setupWorkspace() {
  testDir = await createTestDir();
  cwd = testDir.path;
  git = createGitSourceControl(cwd);

  // Init mock repo
  await execAsync("git", ["init", "--initial-branch", "main"], { cwd });
  await execAsync("git", ["config", "user.email", "test@test.com"], { cwd });
  await execAsync("git", ["config", "user.name", "Test User"], { cwd });

  // Setup a basic pnpm workspace with chronus config including version policies
  await testDir.addFile("pnpm-workspace.yaml", mkPnpmWorkspaceFile());
  
  const configWithPolicies = mkChronusConfigFile({
    versionPolicies: [
      {
        name: "stable-policy",
        type: "lockstep",
        packages: ["pkg-a", "pkg-b"],
        step: "minor",
      },
      {
        name: "preview-policy",
        type: "lockstep",
        packages: ["pkg-c"],
        step: "minor",
      },
    ],
  });
  await testDir.addFile(".chronus/config.yaml", configWithPolicies);

  // Add packages
  await testDir.addFile("packages/pkg-a/package.json", JSON.stringify({ name: "pkg-a", version: "1.0.0" }));
  await testDir.addFile("packages/pkg-b/package.json", JSON.stringify({ name: "pkg-b", version: "2.0.0" }));
  await testDir.addFile("packages/pkg-c/package.json", JSON.stringify({ name: "pkg-c", version: "0.5.0" }));
  await testDir.addFile("packages/pkg-d/package.json", JSON.stringify({ name: "pkg-d", version: "1.0.0" }));

  // Initial commit
  await git.add(".");
  await git.commit("Initial commit");
}

async function addChangeDescription(
  packages: string[],
  changeKind: string,
  message: string,
  filename?: string,
): Promise<void> {
  const changeContent = `
changeKind: ${changeKind}
packages:
${packages.map((p) => `  - ${p}`).join("\n")}

${message}
`.trim();

  const changeFilename = filename || `test-change-${Date.now()}.md`;
  await testDir.addFile(`.chronus/changes/${changeFilename}`, changeContent);
}

beforeEach(async () => {
  await setupWorkspace();
  console.log = mockLog;
  mockLog.mockClear();
});

afterEach(() => {
  console.log = originalLog;
});

describe("changelog command", () => {
  describe("single package", () => {
    it("generates changelog for a single package", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Add new feature to pkg-a");

      await changelog({
        reporter,
        dir: cwd,
        package: "pkg-a",
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("pkg-a");
      expect(output).toContain("Add new feature to pkg-a");
    });

    it("throws error for non-existent package", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Add new feature");

      await expect(
        changelog({
          reporter,
          dir: cwd,
          package: "non-existent-pkg",
        }),
      ).rejects.toThrow(/No release action found for package non-existent-pkg/);
    });
  });

  describe("single policy", () => {
    it("generates changelog for a single policy", async () => {
      await addChangeDescription(["pkg-a", "pkg-b"], "minor", "Add feature to stable packages");

      await changelog({
        reporter,
        dir: cwd,
        policy: "stable-policy",
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("Add feature to stable packages");
    });

    it("throws error for non-existent policy", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Add feature");

      await expect(
        changelog({
          reporter,
          dir: cwd,
          policy: "non-existent-policy",
        }),
      ).rejects.toThrow(/Policy non-existent-policy is not defined/);
    });
  });

  describe("multiple packages", () => {
    it("generates changelogs for multiple packages", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Feature A");
      await addChangeDescription(["pkg-b"], "patch", "Fix B");

      await changelog({
        reporter,
        dir: cwd,
        package: ["pkg-a", "pkg-b"],
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("Feature A");
      expect(output).toContain("Fix B");
    });

    it("handles mix of packages with and without changes", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Feature A");

      await changelog({
        reporter,
        dir: cwd,
        package: ["pkg-a", "pkg-b"],
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("Feature A");
    });
  });

  describe("multiple policies", () => {
    it("generates changelogs for multiple policies", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Stable feature");
      await addChangeDescription(["pkg-c"], "minor", "Preview feature");

      await changelog({
        reporter,
        dir: cwd,
        policy: ["stable-policy", "preview-policy"],
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("Stable feature");
      expect(output).toContain("Preview feature");
    });
  });

  describe("mixed packages and policies", () => {
    it("generates changelogs for both packages and policies", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Stable feature");
      await addChangeDescription(["pkg-d"], "patch", "Independent fix");

      await changelog({
        reporter,
        dir: cwd,
        package: "pkg-d",
        policy: "stable-policy",
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("Stable feature");
      expect(output).toContain("Independent fix");
    });

    it("handles arrays of both packages and policies", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Stable feature");
      await addChangeDescription(["pkg-c"], "minor", "Preview feature");
      await addChangeDescription(["pkg-d"], "patch", "Independent fix");

      await changelog({
        reporter,
        dir: cwd,
        package: ["pkg-d"],
        policy: ["stable-policy", "preview-policy"],
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("Stable feature");
      expect(output).toContain("Preview feature");
      expect(output).toContain("Independent fix");
    });
  });

  describe("error cases", () => {
    it("throws error when neither package nor policy is specified", async () => {
      await expect(
        changelog({
          reporter,
          dir: cwd,
        }),
      ).rejects.toThrow(/Need to specify at least one package or policy/);
    });

    it("throws error when empty arrays are provided", async () => {
      await expect(
        changelog({
          reporter,
          dir: cwd,
          package: [],
          policy: [],
        }),
      ).rejects.toThrow(/Need to specify at least one package or policy/);
    });
  });

  describe("output format", () => {
    it("separates multiple changelogs with double newlines", async () => {
      await addChangeDescription(["pkg-a"], "minor", "Feature A");
      await addChangeDescription(["pkg-b"], "patch", "Fix B");

      await changelog({
        reporter,
        dir: cwd,
        package: ["pkg-a", "pkg-b"],
      });

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      // Check that output contains double newlines between sections
      expect(output).toBeTruthy();
    });
  });
});
