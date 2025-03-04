import { expect, it } from "vitest";
import type { VersionType } from "../types.js";
import { incrementVersion } from "./increment-version.js";

const cases: [string, VersionType, string][] = [
  ["1.0.0", "major", "2.0.0"],
  ["1.1.0", "major", "2.0.0"],
  ["1.0.1", "major", "2.0.0"],
  ["0.1.0", "major", "0.2.0"],

  ["1.0.0", "minor", "1.1.0"],
  ["1.1.0", "minor", "1.2.0"],
  ["1.0.1", "minor", "1.1.0"],

  ["1.0.0", "patch", "1.0.1"],
  ["1.1.0", "patch", "1.1.1"],
  ["1.0.1", "patch", "1.0.2"],

  ["1.0.0-alpha.1", "major", "1.0.0-alpha.2"],
  ["1.0.0-alpha.1", "minor", "1.0.0-alpha.2"],
  ["1.0.0-alpha.1", "patch", "1.0.0-alpha.2"],

  ["bad", "patch", "bad"],
];

it.each(cases)("%s @%s -> %s", (oldVersion, type, expected) => {
  const newVersion = incrementVersion({
    packageName: "pkg-a",
    policy: null as any,
    type,
    oldVersion,
  });

  expect(newVersion).toBe(expected);
});
