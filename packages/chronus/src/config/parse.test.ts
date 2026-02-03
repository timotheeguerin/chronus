import { describe, expect, it } from "vitest";
import { ChronusDiagnosticError } from "../utils/errors.js";
import { parseConfig } from "./parse.js";

describe("packages field", () => {
  it("accepts packages as array of strings", () => {
    const config = parseConfig(`
baseBranch: main
packages:
  - "packages/*"
  - "libs/*"
`);
    expect(config.packages).toEqual(["packages/*", "libs/*"]);
  });

  it("accepts packages as array of objects with path and kind", () => {
    const config = parseConfig(`
baseBranch: main
packages:
  - path: "pnpm-workspace.yaml"
    type: "pnpm"
  - path: "other/*"
`);
    expect(config.packages).toEqual([{ path: "pnpm-workspace.yaml", type: "pnpm" }, { path: "other/*" }]);
  });

  it("accepts mixed packages array", () => {
    const config = parseConfig(`
baseBranch: main
packages:
  - path: "pnpm-workspace.yaml"
    type: "pnpm"
  - "additional/*"
`);
    expect(config.packages).toEqual([{ path: "pnpm-workspace.yaml", type: "pnpm" }, "additional/*"]);
  });
});

describe("packages with deprecated options", () => {
  it("emits error when both packages and workspaceType are provided", () => {
    expect(() =>
      parseConfig(`
baseBranch: main
packages:
  - "packages/*"
workspaceType: pnpm
`),
    ).toThrow(ChronusDiagnosticError);

    try {
      parseConfig(`
baseBranch: main
packages:
  - "packages/*"
workspaceType: pnpm
`);
    } catch (e) {
      expect(e).toBeInstanceOf(ChronusDiagnosticError);
      const error = e as ChronusDiagnosticError;
      expect(error.diagnostics).toHaveLength(1);
      expect(error.diagnostics[0].message).toContain("Cannot use 'workspaceType' when 'packages' is defined");
      expect(error.diagnostics[0].message).toContain("Migrate by removing 'workspaceType'");
    }
  });

  it("emits error when both packages and additionalPackages are provided", () => {
    expect(() =>
      parseConfig(`
baseBranch: main
packages:
  - "packages/*"
additionalPackages:
  - "extra/*"
`),
    ).toThrow(ChronusDiagnosticError);

    try {
      parseConfig(`
baseBranch: main
packages:
  - "packages/*"
additionalPackages:
  - "extra/*"
`);
    } catch (e) {
      expect(e).toBeInstanceOf(ChronusDiagnosticError);
      const error = e as ChronusDiagnosticError;
      expect(error.diagnostics).toHaveLength(1);
      expect(error.diagnostics[0].message).toContain("Cannot use 'additionalPackages' when 'packages' is defined");
      expect(error.diagnostics[0].message).toContain("Migrate by moving all entries from 'additionalPackages'");
    }
  });

  it("emits multiple errors when packages is used with both workspaceType and additionalPackages", () => {
    try {
      parseConfig(`
baseBranch: main
packages:
  - "packages/*"
workspaceType: pnpm
additionalPackages:
  - "extra/*"
`);
    } catch (e) {
      expect(e).toBeInstanceOf(ChronusDiagnosticError);
      const error = e as ChronusDiagnosticError;
      expect(error.diagnostics).toHaveLength(2);
      const messages = error.diagnostics.map((d) => d.message);
      expect(messages.some((m) => m.includes("Cannot use 'workspaceType'"))).toBe(true);
      expect(messages.some((m) => m.includes("Cannot use 'additionalPackages'"))).toBe(true);
    }
  });

  it("allows workspaceType without packages", () => {
    const config = parseConfig(`
baseBranch: main
workspaceType: pnpm
`);
    expect(config.workspaceType).toBe("pnpm");
  });

  it("allows additionalPackages without packages", () => {
    const config = parseConfig(`
baseBranch: main
additionalPackages:
  - "extra/*"
`);
    expect(config.additionalPackages).toEqual(["extra/*"]);
  });
});
