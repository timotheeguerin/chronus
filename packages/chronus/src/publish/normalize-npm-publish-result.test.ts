import { describe, expect, it } from "vitest";

import { normalizeNpmPublishResult } from "./publish-package.js";

describe("normalizeNpmPublishResult", () => {
  const flat = {
    id: "pkg-a@1.0.0",
    name: "pkg-a",
    version: "1.0.0",
    size: 142,
    unpackedSize: 42,
    shasum: "abc",
    integrity: "sha512-xxx",
  };

  it("returns the flat/legacy object as-is", () => {
    expect(normalizeNpmPublishResult(flat, "pkg-a")).toEqual(flat);
  });

  it("unwraps the keyed format (npm >=12) using the package name", () => {
    const keyed = { "pkg-a": flat };
    expect(normalizeNpmPublishResult(keyed, "pkg-a")).toEqual(flat);
  });

  it("falls back to the first entry of the keyed format when the name doesn't match", () => {
    const keyed = { "pkg-a": flat };
    expect(normalizeNpmPublishResult(keyed, "other")).toEqual(flat);
  });

  it("unwraps the keyed format without a package name hint", () => {
    const keyed = { "pkg-a": flat };
    expect(normalizeNpmPublishResult(keyed)).toEqual(flat);
  });

  it("returns null for null input", () => {
    expect(normalizeNpmPublishResult(null)).toBeNull();
  });

  it("returns null for an empty object", () => {
    expect(normalizeNpmPublishResult({})).toBeNull();
  });
});
