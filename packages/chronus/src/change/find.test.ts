import { describe, expect, it } from "vitest";
import type { ChronusWorkspace } from "../../dist/index.js";
import type { GitRepository } from "../source-control/git.js";
import { createTestChronusWorkspace } from "../testing/test-chronus-workspace.js";
import { createTestHost } from "../testing/test-host.js";
import { findChangeStatus } from "./find.js";

interface TestOptions {
  committed?: string[];
  staged?: string[];
  untrackedOrModified?: string[];
  changedFiles?: string[];
}

let workspace: ChronusWorkspace;

function find(options: TestOptions) {
  workspace = createTestChronusWorkspace({
    packages: {
      "pkg-a": {},
      "pkg-b": {},
      "pkg-c": {},
    },
    config: {
      changedFiles: options.changedFiles,
    },
  });
  const partialGit: Partial<GitRepository> = {
    listUntrackedOrModifiedFiles: () => Promise.resolve(options.untrackedOrModified ?? []),
    listStagedFiles: () => Promise.resolve(options.staged ?? []),
    listChangedFilesFromBase: () => Promise.resolve(options.committed ?? []),
  };
  const git = partialGit as GitRepository;

  const host = createTestHost();
  return findChangeStatus(host.host, git, workspace);
}

describe("collect changes", () => {
  it.each(["committed"] as const)("%s", async (key) => {
    const result = await find({
      [key]: ["packages/pkg-a/file1.ts"],
    });
    expect(result.all.packageChanged).toEqual([workspace.getPackage("pkg-a")]);
    expect(result[key].packageChanged).toEqual([workspace.getPackage("pkg-a")]);
    for (const [cur, value] of Object.entries(result)) {
      if (cur !== "all" && cur !== "packages" && cur !== key) {
        expect(value.packageChanged).toHaveLength(0);
      }
    }
  });
});

it("collect changes to different packages", async (key) => {
  const result = await find({
    committed: ["packages/pkg-a/file1.ts", "packages/pkg-b/file2.ts"],
  });
  expect(result.all.packageChanged).toEqual([workspace.getPackage("pkg-a"), workspace.getPackage("pkg-b")]);
});

it("multiple changes to same package only include it once", async (key) => {
  const result = await find({
    committed: ["packages/pkg-a/file1.ts", "packages/pkg-a/file2.ts"],
  });
  expect(result.all.packageChanged).toEqual([workspace.getPackage("pkg-a")]);
});

describe("package change area", () => {
  it("mark as committed if both committed and staged files", async () => {
    const result = await find({
      committed: ["packages/pkg-a/file1.ts"],
      staged: ["packages/pkg-a/file2.ts"],
    });
    expect(result.packages.get("pkg-a")?.changed).toEqual("committed");
  });
  it("mark as staged if both staged and untracked files", async () => {
    const result = await find({
      staged: ["packages/pkg-a/file1.ts"],
      untrackedOrModified: ["packages/pkg-a/file2.ts"],
    });
    expect(result.packages.get("pkg-a")?.changed).toEqual("staged");
  });
  it("mark as committed if both committed and untracked files", async () => {
    const result = await find({
      committed: ["packages/pkg-a/file1.ts"],
      untrackedOrModified: ["packages/pkg-a/file2.ts"],
    });
    expect(result.packages.get("pkg-a")?.changed).toEqual("committed");
  });
  it("mark as committed if committed, staged and untracked files", async () => {
    const result = await find({
      committed: ["packages/pkg-a/file1.ts"],
      staged: ["packages/pkg-a/file2.ts"],
      untrackedOrModified: ["packages/pkg-a/file3.ts"],
    });
    expect(result.packages.get("pkg-a")?.changed).toEqual("committed");
  });
});

describe("filter files", () => {
  it("only include changes in files from the filter", async () => {
    const result = await find({
      committed: ["packages/pkg-a/file1.md", "packages/pkg-b/file1.ts"],
      changedFiles: ["**/*.ts"],
    });
    expect(result.all.filesChanged).toEqual(["packages/pkg-b/file1.ts"]);
    expect(result.all.packageChanged).toEqual([workspace.getPackage("pkg-b")]);
  });

  it("exclude pattern starting with ! changes in files from the filter", async () => {
    const result = await find({
      committed: ["packages/pkg-a/file1.md", "packages/pkg-b/file1.ts"],
      changedFiles: ["!**/*.md"],
    });
    expect(result.all.filesChanged).toEqual(["packages/pkg-b/file1.ts"]);
    expect(result.all.packageChanged).toEqual([workspace.getPackage("pkg-b")]);
  });
  it("include and exclude patterns", async () => {
    const result = await find({
      committed: ["packages/pkg-a/file1.md", "packages/pkg-b/file1.ts", "packages/pkg-c/file1.test.ts"],
      changedFiles: ["**/*.ts", "!**/*.test.ts"],
    });
    expect(result.all.filesChanged).toEqual(["packages/pkg-b/file1.ts"]);
    expect(result.all.packageChanged).toEqual([workspace.getPackage("pkg-b")]);
  });
});
