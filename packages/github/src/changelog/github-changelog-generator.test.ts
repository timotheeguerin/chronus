import type { ChronusWorkspace } from "@chronus/chronus";
import { createTestChronusWorkspace, TestingChangeKinds } from "@chronus/chronus/testing";
import { createHash } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { GithubInfo } from "./fetch-pr-info.js";
import { GithubChangelogGenerator } from "./github-changelog-generator.js";

let workspace: ChronusWorkspace;

function mkSha(seed: string): string {
  const shasum = createHash("sha1");
  shasum.update(seed);
  return shasum.digest("hex");
}

function mkGithubInfo(data: { prNumber?: number; commit?: string }): GithubInfo {
  const commit = data.commit ?? mkSha("dummy");
  return {
    pullRequest: data.prNumber
      ? { number: data.prNumber, url: `https://github.com/owner/repo/pr/${data.prNumber}` }
      : undefined,
    commit,
    commitUrl: `https://github.com/owner/repo/commit/${commit}`,
    author: { login: "foobar", url: "https://github.com/foobar" },
  };
}

beforeEach(() => {
  workspace = createTestChronusWorkspace({ packages: { "pkg-a": {}, "pkg-b": {}, "pkg-c": {} } });
});

describe("generate single package changelog", () => {
  it("separate changes per change kinds", () => {
    const generator = new GithubChangelogGenerator(workspace, {});
    const generated = generator.renderPackageVersion("1.0.0", [
      { id: "change-1", changeKind: TestingChangeKinds.major, content: "Change 1", packages: [] },
      { id: "change-2", changeKind: TestingChangeKinds.minor, content: "Change 2", packages: [] },
      { id: "change-3", changeKind: TestingChangeKinds.patch, content: "Change 3", packages: [] },
    ]);

    expect(generated).toEqual(
      [
        "## 1.0.0",
        "",
        "### Majors",
        "",
        "- Change 1",
        "",
        "### Minors",
        "",
        "- Change 2",
        "",
        "### Patches",
        "",
        "- Change 3",
        "",
      ].join("\n"),
    );
  });

  it("include PR number if data was retrieved", () => {
    const generator = new GithubChangelogGenerator(workspace, {
      "change-1": mkGithubInfo({ prNumber: 123 }),
      "change-2": mkGithubInfo({ prNumber: 123 }),
    });
    const generated = generator.renderPackageVersion("1.0.0", [
      { id: "change-1", changeKind: TestingChangeKinds.minor, content: "Change 1", packages: [] },
      { id: "change-2", changeKind: TestingChangeKinds.minor, content: "Change 2", packages: [] },
    ]);

    expect(generated).toEqual(
      [
        "## 1.0.0",
        "",
        "### Minors",
        "",
        "- [#123](https://github.com/owner/repo/pr/123) Change 1",
        "- [#123](https://github.com/owner/repo/pr/123) Change 2",
        "",
      ].join("\n"),
    );
  });

  it("include commit if no PR was retrieved ", () => {
    const commit1 = mkSha("change-1");
    const commit2 = mkSha("change-2");
    const generator = new GithubChangelogGenerator(workspace, {
      "change-1": mkGithubInfo({ commit: commit1 }),
      "change-2": mkGithubInfo({ commit: commit2 }),
    });
    const generated = generator.renderPackageVersion("1.0.0", [
      { id: "change-1", changeKind: TestingChangeKinds.minor, content: "Change 1", packages: [] },
      { id: "change-2", changeKind: TestingChangeKinds.minor, content: "Change 2", packages: [] },
    ]);

    expect(generated).toEqual(
      [
        "## 1.0.0",
        "",
        "### Minors",
        "",
        "- [54b1d04](https://github.com/owner/repo/commit/54b1d043db716686e3fd1f5c5b978a104326ca9e) Change 1",
        "- [8caf338](https://github.com/owner/repo/commit/8caf3384f2304302a1216d838e09f66c6a5b660c) Change 2",
        "",
      ].join("\n"),
    );
  });

  it("indent multi line change entry", () => {
    const generator = new GithubChangelogGenerator(workspace, {});
    const generated = generator.renderPackageVersion("1.0.0", [
      { id: "change-1", changeKind: TestingChangeKinds.major, content: "Change 1\nwith\nsome\ndetails", packages: [] },
    ]);

    expect(generated).toEqual(
      [
        //render indented
        "## 1.0.0",
        "",
        "### Majors",
        "",
        "- Change 1",
        "  with",
        "  some",
        "  details",
        "",
      ].join("\n"),
    );
  });
});

describe("generate aggregated changelog", () => {
  it("group changes by change kinds then packages", () => {
    const generator = new GithubChangelogGenerator(workspace, {});
    const generated = generator.renderAggregatedChangelog("1.0.0", {
      "pkg-a": [
        { id: "change-1", changeKind: TestingChangeKinds.major, content: "Change 1", packages: [] },
        { id: "change-2", changeKind: TestingChangeKinds.minor, content: "Change 2", packages: [] },
        { id: "change-3", changeKind: TestingChangeKinds.patch, content: "Change 3", packages: [] },
      ],
      "pkg-b": [{ id: "change-4", changeKind: TestingChangeKinds.minor, content: "Change 4", packages: [] }],
    });

    expect(generated).toEqual(
      [
        "# 1.0.0",
        "",
        "## Majors",
        "",
        "### pkg-a",
        "",
        "- Change 1",
        "",
        "## Minors",
        "",
        "### pkg-a",
        "",
        "- Change 2",
        "",
        "### pkg-b",
        "",
        "- Change 4",
        "",
        "## Patches",
        "",
        "### pkg-a",
        "",
        "- Change 3",
        "",
      ].join("\n"),
    );
  });
});
