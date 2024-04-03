import type { ChronusWorkspace } from "@chronus/chronus";
import { beforeEach, describe, expect, it } from "vitest";
import { TestingChangeKinds, createTestChronusWorkspace } from "../testing/test-chronus-workspace.js";
import { BasicChangelogGenerator } from "./basic.js";

let workspace: ChronusWorkspace;

beforeEach(() => {
  workspace = createTestChronusWorkspace({ packages: { "pkg-a": {}, "pkg-b": {}, "pkg-c": {} } });
});

describe("generate single package changelog", () => {
  it("separate changes per change kinds", () => {
    const generator = new BasicChangelogGenerator(workspace);
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
});

describe("generate aggregated changelog", () => {
  it("group changes by change kinds then packages", () => {
    const generator = new BasicChangelogGenerator(workspace);
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
