import jsYaml from "js-yaml";
import z from "zod";
import { ChronusError } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { isPathAccessible, lookup } from "../utils/index.js";
import { joinPaths, resolvePath } from "../utils/path-utils.js";
import type { ChronusResolvedConfig, ChronusUserConfig } from "./types.js";

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

const schema = z.object({
  baseBranch: z.string(),
  workspaceType: z.enum(["auto", "npm", "pnpm", "rush"]).optional(),
  versionPolicies: z.array(versionPolicySchema).optional(),
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
  return {
    workspaceRoot: root,
    ...parseConfig(file.content),
  };
}
