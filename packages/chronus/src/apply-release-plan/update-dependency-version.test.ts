import { describe, expect, it } from "vitest";
import { updateDependencyVersion } from "./update-dependency-version.js";

describe("updateDependencyVersion", () => {
  it("update fixed version", () => {
    expect(updateDependencyVersion("1.0.0", "2.0.0")).toBe("2.0.0");
  });
  it("update '~x.y.z' version", () => {
    expect(updateDependencyVersion("~1.0.0", "2.0.0")).toBe("~2.0.0");
  });
  it("update '^x.y.z' version", () => {
    expect(updateDependencyVersion("^1.0.0", "2.0.0")).toBe("^2.0.0");
  });
  it("update '>=x.y.z' version", () => {
    expect(updateDependencyVersion(">=1.0.0", "2.0.0")).toBe(">=2.0.0");
  });

  it("keeps '*' the same", () => {
    expect(updateDependencyVersion("*", "2.0.0")).toBe("*");
  });

  describe("workspace: versions", () => {
    it("update fixed version", () => {
      expect(updateDependencyVersion("workspace:1.0.0", "2.0.0")).toBe("workspace:2.0.0");
    });
    it("update 'workspace:~x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:~1.0.0", "2.0.0")).toBe("workspace:~2.0.0");
    });
    it("update 'workspace:^x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:^1.0.0", "2.0.0")).toBe("workspace:^2.0.0");
    });
    it("update 'workspace:>=x.y.z' version", () => {
      expect(updateDependencyVersion("workspace:>=1.0.0", "2.0.0")).toBe("workspace:>=2.0.0");
    });
    it("keeps 'workspace:~' ", () => {
      expect(updateDependencyVersion("workspace:~", "2.0.0")).toBe("workspace:~");
    });
    it("keeps 'workspace:^' ", () => {
      expect(updateDependencyVersion("workspace:^", "2.0.0")).toBe("workspace:^");
    });
    it("keeps 'workspace:*' ", () => {
      expect(updateDependencyVersion("workspace:*", "2.0.0")).toBe("workspace:*");
    });
  });
});
