import { rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createTestDir, type TestDir } from "../testing/index.js";
import { getCIContext } from "./ci-context.js";

let testDir: TestDir;

beforeEach(async () => {
  testDir = await createTestDir();
  for (const name of [
    "GITHUB_EVENT_NAME",
    "GITHUB_EVENT_PATH",
    "GITHUB_REPOSITORY",
    "GITHUB_HEAD_REF",
    "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER",
    "SYSTEM_PULLREQUEST_SOURCEBRANCH",
    "BUILD_REPOSITORY_NAME",
    "GH_REPO",
    "GH_PR_NUMBER",
    "GH_PR_HEAD_REF",
    "GH_PR_TITLE",
  ]) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(testDir.path, { recursive: true, force: true });
});

it("reads the source branch and title from a GitHub PR event", async () => {
  await testDir.addFile(
    "event.json",
    JSON.stringify({ pull_request: { number: 123, head: { ref: "publish/release" }, title: "[skip chg] Release" } }),
  );
  vi.stubEnv("GITHUB_EVENT_NAME", "pull_request");
  vi.stubEnv("GITHUB_EVENT_PATH", join(testDir.path, "event.json"));
  vi.stubEnv("GITHUB_REPOSITORY", "owner/repo");
  vi.stubEnv("GITHUB_HEAD_REF", "refs/pull/123/merge");
  expect(getCIContext()).toEqual({
    repo: "owner/repo",
    prNumber: 123,
    headRef: "publish/release",
    prTitle: "[skip chg] Release",
  });
});

it("combines Azure DevOps metadata with an explicitly supplied PR title", () => {
  vi.stubEnv("SYSTEM_PULLREQUEST_PULLREQUESTNUMBER", "456");
  vi.stubEnv("SYSTEM_PULLREQUEST_SOURCEBRANCH", "refs/heads/publish/release");
  vi.stubEnv("BUILD_REPOSITORY_NAME", "owner/repo");
  vi.stubEnv("GH_PR_TITLE", "[skip chg] Release");
  expect(getCIContext()).toEqual({
    repo: "owner/repo",
    prNumber: 456,
    headRef: "refs/heads/publish/release",
    prTitle: "[skip chg] Release",
  });
});

it("supports explicit context when no CI provider is present", () => {
  vi.stubEnv("GH_REPO", "owner/repo");
  vi.stubEnv("GH_PR_NUMBER", "789");
  vi.stubEnv("GH_PR_HEAD_REF", "feature");
  vi.stubEnv("GH_PR_TITLE", "Feature");
  expect(getCIContext()).toEqual({ repo: "owner/repo", prNumber: 789, headRef: "feature", prTitle: "Feature" });
});

it("allows unavailable title metadata but reports malformed event data", async () => {
  vi.stubEnv("GITHUB_EVENT_NAME", "pull_request_target");
  vi.stubEnv("GITHUB_HEAD_REF", "feature");
  expect(getCIContext().prTitle).toBeUndefined();
  expect(getCIContext().headRef).toBe("feature");
  await testDir.addFile("event.json", "{}");
  vi.stubEnv("GITHUB_EVENT_PATH", join(testDir.path, "event.json"));
  expect(getCIContext).toThrow(/missing 'pull_request' metadata/);
  await testDir.writeFile("event.json", "{");
  expect(getCIContext).toThrow(SyntaxError);
});
