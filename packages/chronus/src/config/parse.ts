import z from "zod";
import type { TextFile } from "../file/types.js";
import { parseYaml, validateYamlFile } from "../yaml/index.js";
import type { ChronusUserConfig } from "./types.js";

const versionPolicySchema = z.union([
  z
    .object({
      type: z.literal("lockstep"),
      name: z.string(),
      packages: z.array(z.string()),
      step: z.enum(["major", "minor", "patch"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("independent"),
      name: z.string(),
      packages: z.array(z.string()),
    })
    .strict(),
]);

const changeKindsSchema = z.object({
  versionType: z.enum(["none", "patch", "minor", "major"]),
  title: z.string().optional(),
  description: z.string().optional(),
});

const schema = z
  .object({
    baseBranch: z.string(),
    baseRemote: z.string().url().optional(),
    workspaceType: z.enum(["auto", "npm", "pnpm", "rush"]).optional(),
    additionalPackages: z.array(z.string()).optional(),
    versionPolicies: z.array(versionPolicySchema).optional(),
    ignore: z.array(z.string()).optional(),
    changeKinds: z.record(z.string(), changeKindsSchema).optional(),
    changelog: z.union([z.string(), z.tuple([z.string(), z.record(z.string(), z.unknown())])]).optional(),
    changedFiles: z.array(z.string()).optional(),
  })
  .strict();

export function parseConfig(content: string | TextFile): ChronusUserConfig {
  const parsed = parseYaml(content);
  return { ...validateYamlFile(parsed, schema), source: parsed };
}
