import { beforeEach, describe, expect, it } from "vitest";
import type { Reporter } from "../../reporters/types.js";
import { mkChangeFile, mkChronusConfigFile, mkPnpmWorkspaceFile } from "../../testing/test-chronus-workspace.js";
import { createTestHost, type TestHost } from "../../testing/test-host.js";
import { changelog } from "./changelog.js";

let testHost: TestHost;

let changeCounter = 0;

function createMockReporter(): Reporter & { output: string[] } {
  const output: string[] = [];
  return {
    output,
    log: (message: string) => output.push(message),
    task: async () => {},
  };
}

function setupWorkspace(): TestHost {
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

  return createTestHost({
    "proj/pnpm-workspace.yaml": mkPnpmWorkspaceFile(),
    "proj/.chronus/config.yaml": configWithPolicies,
    "proj/packages/pkg-a/package.json": JSON.stringify({ name: "pkg-a", version: "1.0.0" }),
    "proj/packages/pkg-b/package.json": JSON.stringify({ name: "pkg-b", version: "2.0.0" }),
    "proj/packages/pkg-c/package.json": JSON.stringify({ name: "pkg-c", version: "0.5.0" }),
    "proj/packages/pkg-d/package.json": JSON.stringify({ name: "pkg-d", version: "1.0.0" }),
  });
}

function addChange(packages: string | string[], changeKind: "patch" | "minor" | "major", message?: string): void {
  const changeFilename = `test-change-${changeCounter++}.md`;
  testHost.addFile(`proj/.chronus/changes/${changeFilename}`, mkChangeFile(packages, changeKind, message));
}

beforeEach(() => {
  testHost = setupWorkspace();
  changeCounter = 0;
});

describe("single package", () => {
  it("generates changelog for a single package", async () => {
    addChange("pkg-a", "minor", "Add new feature");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      package: "pkg-a",
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("1.1.0");
    expect(reporter.output[0]).toContain("Add new feature");
  });

  it("throws error for non-existent package", async () => {
    addChange("pkg-a", "minor");
    const reporter = createMockReporter();

    await expect(
      changelog(testHost.host, {
        reporter,
        dir: "proj",
        package: "non-existent-pkg",
      }),
    ).rejects.toThrow(/No release action found for package non-existent-pkg/);
  });
});

describe("single policy", () => {
  it("generates changelog for a single policy", async () => {
    addChange(["pkg-a", "pkg-b"], "minor", "Add shared feature");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      policy: "stable-policy",
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("1.1.0");
    expect(reporter.output[0]).toContain("Add shared feature");
    expect(reporter.output[0]).toContain("pkg-a");
    expect(reporter.output[0]).toContain("pkg-b");
  });

  it("throws error for non-existent policy", async () => {
    addChange("pkg-a", "minor");
    const reporter = createMockReporter();

    await expect(
      changelog(testHost.host, {
        reporter,
        dir: "proj",
        policy: "non-existent-policy",
      }),
    ).rejects.toThrow(/Policy non-existent-policy is not defined/);
  });
});

describe("multiple packages", () => {
  it("generates changelogs for multiple packages", async () => {
    addChange("pkg-d", "minor", "Feature in pkg-d");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      package: ["pkg-d"],
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("1.1.0");
    expect(reporter.output[0]).toContain("Feature in pkg-d");
  });

  it("generates separate changelogs for each package", async () => {
    addChange("pkg-c", "minor", "Feature C");
    addChange("pkg-d", "patch", "Fix D");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      package: ["pkg-c", "pkg-d"],
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("Feature C");
    expect(reporter.output[0]).toContain("Fix D");
  });
});

describe("multiple policies", () => {
  it("generates changelogs for multiple policies", async () => {
    addChange("pkg-a", "minor", "Stable feature");
    addChange("pkg-c", "minor", "Preview feature");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      policy: ["stable-policy", "preview-policy"],
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("Stable feature");
    expect(reporter.output[0]).toContain("Preview feature");
  });
});

describe("mixed packages and policies", () => {
  it("generates changelogs for both packages and policies", async () => {
    addChange(["pkg-a", "pkg-b"], "minor", "Stable feature");
    addChange("pkg-d", "patch", "Independent fix");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      package: "pkg-d",
      policy: "stable-policy",
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("Independent fix");
    expect(reporter.output[0]).toContain("Stable feature");
  });

  it("handles arrays of both packages and policies", async () => {
    addChange("pkg-a", "minor", "Stable feature");
    addChange("pkg-c", "minor", "Preview feature");
    addChange("pkg-d", "patch", "Independent fix");
    const reporter = createMockReporter();

    await changelog(testHost.host, {
      reporter,
      dir: "proj",
      package: ["pkg-d"],
      policy: ["stable-policy", "preview-policy"],
    });

    expect(reporter.output).toHaveLength(1);
    expect(reporter.output[0]).toContain("Independent fix");
    expect(reporter.output[0]).toContain("Stable feature");
    expect(reporter.output[0]).toContain("Preview feature");
  });
});

describe("error cases", () => {
  it("throws error when neither package nor policy is specified", async () => {
    const reporter = createMockReporter();

    await expect(
      changelog(testHost.host, {
        reporter,
        dir: "proj",
      }),
    ).rejects.toThrow(/Need to specify at least one package or policy/);
  });

  it("throws error when empty arrays are provided", async () => {
    const reporter = createMockReporter();

    await expect(
      changelog(testHost.host, {
        reporter,
        dir: "proj",
        package: [],
        policy: [],
      }),
    ).rejects.toThrow(/Need to specify at least one package or policy/);
  });
});
