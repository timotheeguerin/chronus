import { expect, it } from "vitest";
import { stringify } from "yaml";
import type { ChronusUserConfig } from "../config/types.js";
import { createTestHost } from "../testing/test-host.js";
import type { PackageJson } from "../workspace-manager/node/types.js";
import { loadChronusWorkspace } from "./load.js";

function makeHost(options: { config?: Partial<ChronusUserConfig>; packages?: Record<string, PackageJson> } = {}) {
  return createTestHost({
    "proj/package.json": stringify({
      workspaces: ["packages/*"],
    }),
    "proj/.chronus/config.yaml": stringify({
      baseBranch: "main",
      ...options.config,
    }),
    ...Object.entries(options.packages ?? {}).reduce((acc: any, [key, value]) => {
      acc[`proj/${key}/package.json`] = JSON.stringify(value);
      return acc;
    }, {}),
  });
}

it("loads basic workspace", async () => {
  const host = makeHost({
    packages: {
      "packages/a": {
        name: "a",
        version: "1.0.0",
      },
    },
  });
  const workspace = await loadChronusWorkspace(host.host, "proj");
  expect(workspace.packages).toHaveLength(1);
  expect(workspace.packages[0].name).toBe("a");
});

it("doesn't include private packages", async () => {
  const host = makeHost({
    packages: {
      "packages/a": {
        name: "a",
        version: "1.0.0",
      },
      "packages/b": {
        name: "b",
        version: "1.0.0",
        private: true,
      },
    },
  });
  const workspace = await loadChronusWorkspace(host.host, "proj");
  expect(workspace.packages).toHaveLength(1);
  expect(workspace.packages[0].name).toBe("a");
});

it("includes additionalPackages", async () => {
  const host = makeHost({
    config: {
      additionalPackages: ["extra/*"],
    },
    packages: {
      "packages/a": {
        name: "a",
        version: "1.0.0",
      },
      "extra/b": {
        name: "b",
        version: "1.0.0",
      },
    },
  });
  const workspace = await loadChronusWorkspace(host.host, "proj");
  expect(workspace.packages).toHaveLength(2);
  expect(workspace.packages[0].name).toBe("a");
  expect(workspace.packages[1].name).toBe("b");
});
