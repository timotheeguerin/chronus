import { strictEqual } from "assert";
import { describe, it } from "vitest";
import { extractCursor } from "../testing/test-utils.js";
import { getLocationInYamlScript } from "./location.js";
import { parseYaml } from "./parse.js";

function findRightLocation(code: string, path: string[]) {
  const { pos, source } = extractCursor(code);
  const yamlScript = parseYaml(source);
  const location = getLocationInYamlScript(yamlScript, path);
  strictEqual(location.pos, pos);
}

function itFindKeyAndValueLocation(code: string, path: string[]) {
  const { pos: keyPos, source: sourceWithoutKeyCursor } = extractCursor(code, "┆K┆");
  const { pos: valuePos, source } = extractCursor(sourceWithoutKeyCursor, "┆V┆");

  it("value", () => {
    const yamlScript = parseYaml(source);
    const valueLocation = getLocationInYamlScript(yamlScript, path, "value");
    strictEqual(valueLocation.pos, valuePos);
  });

  it("key", () => {
    const yamlScript = parseYaml(source);
    const keyLocation = getLocationInYamlScript(yamlScript, path, "key");
    strictEqual(keyLocation.pos, keyPos);
  });
}

describe("property at root", () => {
  itFindKeyAndValueLocation(
    `
        one: abc
        ┆K┆two: ┆V┆def
        three: ghi
      `,
    ["two"],
  );
});

describe("property at in nested object", () => {
  itFindKeyAndValueLocation(
    `
      root: true
      nested:
        more:
          one: abc
          ┆K┆two: ┆V┆def
          three: ghi
    `,
    ["nested", "more", "two"],
  );
});

describe("property under array", () => {
  itFindKeyAndValueLocation(
    `
      items:
        - name: abc
        - one: abc
          ┆K┆two: ┆V┆def
          three: ghi
      `,
    ["items", "1", "two"],
  );
});

it("array item", () =>
  findRightLocation(
    `
      items:
        - name: abc
        - ┆one: abc
          three: ghi
      `,
    ["items", "1"],
  ));
