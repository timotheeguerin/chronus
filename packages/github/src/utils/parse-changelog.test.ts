import { describe, expect, it } from "vitest";
import { extractVersionChangelog } from "./parse-changelog.js";

function makeChangelog(version: string) {
  return [
    "",
    "### Features:",
    `- feat${version}_1`,
    `- feat${version}_2`,
    `### Bug fixes:`,
    `- bug${version}_1`,
    `- bug${version}_2`,
    "",
  ].join("\n");
}
const multiVersionChangelog = [
  "## 1.2.0",
  makeChangelog("1.2.0"),
  "## 1.1.0",
  makeChangelog("1.1.0"),
  "## 1.0.0",
  makeChangelog("1.0.0"),
].join("\n");

describe("multi version changelog", () => {
  it("extract last version", () => {
    expect(extractVersionChangelog(multiVersionChangelog, "1.2.0")).toEqual(makeChangelog("1.2.0"));
  });

  it("extract middle version", () => {
    expect(extractVersionChangelog(multiVersionChangelog, "1.1.0")).toEqual(makeChangelog("1.1.0"));
  });

  it("extract first version", () => {
    expect(extractVersionChangelog(multiVersionChangelog, "1.0.0")).toEqual(makeChangelog("1.0.0"));
  });
});

it("extract only version", () => {
  expect(extractVersionChangelog(["## 1.0.0", makeChangelog("1.0.0")].join("\n"), "1.0.0")).toEqual(
    makeChangelog("1.0.0"),
  );
});

it("extract multi digit version", () => {
  expect(extractVersionChangelog(["## 42.54.0", makeChangelog("42.54.0")].join("\n"), "42.54.0")).toEqual(
    makeChangelog("42.54.0"),
  );
});

it("extract prerelease version", () => {
  expect(
    extractVersionChangelog(["## 1.0.0-alpha.1", makeChangelog("1.0.0-alpha.1")].join("\n"), "1.0.0-alpha.1"),
  ).toEqual(makeChangelog("1.0.0-alpha.1"));
});
