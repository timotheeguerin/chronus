import jsYaml from "js-yaml";
import z from "zod";
import { ChronusError } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { isPathAccessible, lookup } from "../utils/index.js";
import { joinPaths, resolvePath } from "../utils/path-utils.js";
import type { ChangeKindUserConfig, ChronusResolvedConfig, ChronusUserConfig } from "./types.js";

const configFileName = ".chronus.yaml";
const versionPolicySchema = z.union([
  z.object({
    type: z.literal("lockstep"),
    name: z.string(),
    packages: z.array(z.string()),
    step: z.enum(["major", "minor", "patch"]),
  }),
  z.object({
    type: z.literal("independent"),
    name: z.string(),
    packages: z.array(z.string()),
  }),
]);

const changeKindsSchema = z.object({
  versionType: z.enum(["none", "patch", "minor", "major"]),
  title: z.string().optional(),
  description: z.string().optional(),
});

const schema = z.object({
  baseBranch: z.string(),
  workspaceType: z.enum(["auto", "npm", "pnpm", "rush"]).optional(),
  versionPolicies: z.array(versionPolicySchema).optional(),
  ignore: z.array(z.string()).optional(),
  changeKinds: z.record(changeKindsSchema),
});

export function parseConfig(content: string): ChronusUserConfig {
  const yaml = jsYaml.load(content);
  return schema.parse(yaml);
}

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
    throw new ChronusError("Could not find .chronus.yaml");
  }
  const useConfig = parseConfig(file.content);
  return {
    workspaceRoot: root,
    ...useConfig,
    changeKinds: useConfig.changeKinds ?? defaultChangeKinds,
  };
}

export const defaultChangeKinds: Record<string, ChangeKindUserConfig> = Object.freeze({
  none: { versionType: "none" },
  minor: { versionType: "minor" },
  patch: { versionType: "patch" },
  major: { versionType: "major" },
});
