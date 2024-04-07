import { load } from "js-yaml";
import z from "zod";
import type { ChronusUserConfig } from "./types.js";

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
  changeKinds: z.record(changeKindsSchema).optional(),
  changelog: z.union([z.string(), z.tuple([z.string(), z.record(z.unknown())])]).optional(),
  changedFiles: z.array(z.string()).optional(),
});

export function parseConfig(content: string): ChronusUserConfig {
  const yaml = load(content);
  return schema.parse(yaml);
}
