import { describe, expect, it } from "vitest";
import { normalizePackagesConfig } from "./resolve.js";

describe("normalizePackagesConfig", () => {
  it("uses packages directly when provided", () => {
    const result = normalizePackagesConfig({
      baseBranch: "main",
      packages: ["packages/*", { path: "libs/*", type: "npm" }],
    });
    expect(result).toEqual([{ path: "packages/*" }, { path: "libs/*", type: "npm" }]);
  });

  it("falls back to workspaceType when packages is not provided", () => {
    const result = normalizePackagesConfig({
      baseBranch: "main",
      workspaceType: "pnpm",
    });
    expect(result).toEqual([{ path: ".", type: "pnpm" }]);
  });

  it("marks additionalPackages as standalone", () => {
    const result = normalizePackagesConfig({
      baseBranch: "main",
      additionalPackages: ["extra/*"],
    });
    expect(result).toEqual([
      { path: ".", type: "auto" },
      { path: "extra/*", type: "npm", standalone: true },
    ]);
  });

  it("preserves standalone flag from packages config", () => {
    const result = normalizePackagesConfig({
      baseBranch: "main",
      packages: [
        { path: ".", type: "pnpm" },
        { path: "extra/*", type: "npm", standalone: true },
      ],
    });
    expect(result).toEqual([
      { path: ".", type: "pnpm" },
      { path: "extra/*", type: "npm", standalone: true },
    ]);
  });
});
