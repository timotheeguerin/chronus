import { describe, expect, it } from "vitest";
import { getLastJsonObject } from "./misc-utils.js";

describe("getLastJsonObject", () => {
  it("parse when whole string is a json object", () => {
    const json = '{"a": 1, "b": 2}';
    expect(getLastJsonObject(json)).toEqual({ a: 1, b: 2 });
  });

  it("parse when there is some leading whitespace", () => {
    const json = '       {"a": 1, "b": 2}';
    expect(getLastJsonObject(json)).toEqual({ a: 1, b: 2 });
  });

  it("parse when there is some trailing whitespace", () => {
    const json = '{"a": 1, "b": 2}           ';
    expect(getLastJsonObject(json)).toEqual({ a: 1, b: 2 });
  });

  it("parse when there is some newlines", () => {
    const json = 'Result:\n{"a": 1, "b": 2}\nDone.';
    expect(getLastJsonObject(json)).toEqual({ a: 1, b: 2 });
  });

  it("parse when json string contains { and }", () => {
    const json = 'Result:\n{"a": "some { and } contained here", "b": 2}\nDone.';
    expect(getLastJsonObject(json)).toEqual({ a: "some { and } contained here", b: 2 });
  });
});
