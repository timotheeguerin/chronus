import { beforeEach, describe, expect, it } from "@jest/globals";
import { dump } from "js-yaml";
import { join } from "node:path";
import { createTestDir, TestDir } from "../testing/index.js";
import { createTestHost, TestHost } from "../testing/test-host.js";
import { execAsync } from "../utils/exec-async.js";

describe("pnpm", () => {
  let host: TestHost;
  beforeEach(async () => {
    host = createTestHost({
      "proj/pnpm-workspace.yaml": dump({
        packages: "packages/*",
      }),
    });
  });

  describe("getRepoRoot", () => {
    beforeEach(async () => {
      await host.addFile("packages/pkg-a/src/foo/bar.ts");
    });
  });
});
