import { ChronusError } from "../utils/errors.js";
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
    const path = joinPaths(current, configFileName);
    return isPathAccessible(host, path);
  });
  if (root === undefined) {
    throw new ChronusError(`Cannot find ${configFileName} in a parent folder to ${dir}`);
  }

  const configPath = resolvePath(root, configFileName);
  let file;
  try {
    file = await host.readFile(configPath);
  } catch (e) {
    throw new ChronusError(`Could not find ${configFileName}`);
  }
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
