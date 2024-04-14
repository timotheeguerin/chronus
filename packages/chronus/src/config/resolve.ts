import { ChronusDiagnosticError } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { isPathAccessible, lookup } from "../utils/index.js";
import { joinPaths, resolvePath } from "../utils/path-utils.js";
import { parseConfig } from "./parse.js";
import type { ChangeKindResolvedConfig, ChangeKindUserConfig, ChronusResolvedConfig } from "./types.js";

const configFileName = ".chronus/config.yaml";

export const defaultChangeKinds: Record<string, ChangeKindUserConfig> = Object.freeze({
  none: { versionType: "none" },
  minor: { versionType: "minor" },
  patch: { versionType: "patch" },
  major: { versionType: "major" },
});

export async function resolveConfig(host: ChronusHost, dir: string): Promise<ChronusResolvedConfig> {
  const root = await lookup(dir, (current) => {
    return isPathAccessible(host, joinPaths(current, configFileName));
  });
  if (root === undefined) {
    throw new ChronusDiagnosticError({
      code: "config-not-found",
      severity: "error",
      message: `Cannot find ${configFileName} in a parent folder to ${dir}`,
      target: null,
    });
  }

  const configPath = resolvePath(root, configFileName);
  const file = await host.readFile(configPath);
  const userConfig = parseConfig(file);
  return {
    workspaceRoot: root,
    ...userConfig,
    changeKinds: addNameToChangeKinds(userConfig.changeKinds ?? defaultChangeKinds),
  };
}

export function addNameToChangeKinds(
  changeKinds: Record<string, ChangeKindUserConfig>,
): Record<string, ChangeKindResolvedConfig> {
  const items = Object.entries(changeKinds).map(([name, value]) => [name, { ...value, name }]);
  return Object.fromEntries(items);
}
