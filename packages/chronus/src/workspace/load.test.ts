import { expect, it } from "vitest";
import { stringify } from "yaml";
import type { ChronusUserConfig } from "../config/types.js";
import { createTestHost } from "../testing/test-host.js";
import type { PackageJson } from "../workspace-manager/types.js";
import { loadChronusWorkspace } from "./load.js";

function makeHost(options: { config?: Partial<ChronusUserConfig>; packages?: Record<string, PackageJson> } = {}) {
  return createTestHost({
    "proj/package.json": JSON.stringify({
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

it("(LEGACY) includes additionalPackages", async () => {
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

it("(LEGACY) marks additionalPackages as standalone", async () => {
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
  expect(workspace.getPackage("a").state).toBe("versioned");
  expect(workspace.getPackage("b").state).toBe("standalone");
});

it("marks packages with standalone: true as standalone", async () => {
  const host = createTestHost({
    "proj/.chronus/config.yaml": stringify({
      baseBranch: "main",
      packages: [
        { path: ".", type: "pnpm" },
        { path: "extra/*", type: "npm", standalone: true },
      ],
    }),
    "proj/pnpm-workspace.yaml": stringify({ packages: ["packages/*"] }),
    "proj/packages/a/package.json": JSON.stringify({ name: "a", version: "1.0.0" }),
    "proj/extra/b/package.json": JSON.stringify({ name: "b", version: "1.0.0" }),
  });
  const workspace = await loadChronusWorkspace(host.host, "proj");
  expect(workspace.getPackage("a").state).toBe("versioned");
  expect(workspace.getPackage("b").state).toBe("standalone");
});
