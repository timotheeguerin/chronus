import { describe, expect, it } from "vitest";
import { updateDependencyVersion, type ResolvedVersionAction } from "./update-dependency-version.js";

describe("stable mode", () => {
  const resolvedVersion: ResolvedVersionAction = {
    newVersion: "2.0.0",
    oldVersion: "1.0.0",
  };
  it("update fixed version", () => {
    expect(updateDependencyVersion("1.0.0", resolvedVersion, "stable")).toBe("2.0.0");
  });
  it("update '~x.y.z' version", () => {
    expect(updateDependencyVersion("~1.0.0", resolvedVersion, "stable")).toBe("~2.0.0");
  });
  it("update '^x.y.z' version", () => {
    expect(updateDependencyVersion("^1.0.0", resolvedVersion, "stable")).toBe("^2.0.0");
  });
  it("update '>=x.y.z' version", () => {
    expect(updateDependencyVersion(">=1.0.0", resolvedVersion, "stable")).toBe(">=2.0.0");
  });

  it("keeps '*' the same", () => {
    expect(updateDependencyVersion("*", resolvedVersion, "stable")).toBe("*");
  });

  describe("workspace: versions", () => {
    it("update fixed version", () => {
      expect(updateDependencyVersion("workspace:1.0.0", resolvedVersion, "stable")).toBe("workspace:2.0.0");
    });
    it("update 'workspace:~x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:~1.0.0", resolvedVersion, "stable")).toBe("workspace:~2.0.0");
    });
    it("update 'workspace:^x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:^1.0.0", resolvedVersion, "stable")).toBe("workspace:^2.0.0");
    });
    it("update 'workspace:>=x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:>=1.0.0", resolvedVersion, "stable")).toBe("workspace:>=2.0.0");
    });
    it("keeps 'workspace:~' ", () => {
      expect(updateDependencyVersion("workspace:~", resolvedVersion, "stable")).toBe("workspace:~");
    });
    it("keeps 'workspace:^' ", () => {
      expect(updateDependencyVersion("workspace:^", resolvedVersion, "stable")).toBe("workspace:^");
    });
    it("keeps 'workspace:*' ", () => {
      expect(updateDependencyVersion("workspace:*", resolvedVersion, "stable")).toBe("workspace:*");
    });
  });
});

describe("prerelease mode", () => {
  const resolvedVersion: ResolvedVersionAction = {
    newVersion: "2.0.0-dev.1",
    oldVersion: "1.0.0",
  };
  it("update fixed version", () => {
    expect(updateDependencyVersion("1.0.0", resolvedVersion, "prerelease")).toBe("1.0.0 || >= 2.0.0-dev.1");
  });
  it("update '~x.y.z' version", () => {
    expect(updateDependencyVersion("~1.0.0", resolvedVersion, "prerelease")).toBe("~1.0.0 || >= 2.0.0-dev.1");
  });
  it("update '^x.y.z' version", () => {
    expect(updateDependencyVersion("^1.0.0", resolvedVersion, "prerelease")).toBe("^1.0.0 || >= 2.0.0-dev.1");
  });
  it("update '>=x.y.z' version", () => {
    expect(updateDependencyVersion(">=1.0.0", resolvedVersion, "prerelease")).toBe(">=1.0.0 || >= 2.0.0-dev.1");
  });

  it("keeps '*' the same", () => {
    expect(updateDependencyVersion("*", resolvedVersion, "prerelease")).toBe("*");
  });

  describe("workspace: versions", () => {
    it("update fixed version", () => {
      expect(updateDependencyVersion("workspace:1.0.0", resolvedVersion, "prerelease")).toBe("1.0.0 || >= 2.0.0-dev.1");
    });
    it("update 'workspace:~x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:~1.0.0", resolvedVersion, "prerelease")).toBe(
        "~1.0.0 || >= 2.0.0-dev.1",
      );
    });
    it("update 'workspace:^x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:^1.0.0", resolvedVersion, "prerelease")).toBe(
        "^1.0.0 || >= 2.0.0-dev.1",
      );
    });
    it("update 'workspace:>=x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:>=1.0.0", resolvedVersion, "prerelease")).toBe(
        ">=1.0.0 || >= 2.0.0-dev.1",
      );
    });
    it("keeps 'workspace:~' ", () => {
      expect(updateDependencyVersion("workspace:~", resolvedVersion, "prerelease")).toBe("~1.0.0 || >= 2.0.0-dev.1");
    });
    it("keeps 'workspace:^' ", () => {
      expect(updateDependencyVersion("workspace:^", resolvedVersion, "prerelease")).toBe("^1.0.0 || >= 2.0.0-dev.1");
    });
    it("keeps 'workspace:*' ", () => {
      expect(updateDependencyVersion("workspace:*", resolvedVersion, "prerelease")).toBe("* || >= 2.0.0-dev.1");
    });
  });
});
