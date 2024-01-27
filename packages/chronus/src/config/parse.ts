import jsYaml from "js-yaml";
import z from "zod";
import { ChronusError } from "../utils/errors.js";
import type { ChronusHost } from "../utils/host.js";
import { resolvePath } from "../utils/path-utils.js";
import type { ChronusConfig } from "./types.js";

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
  versionPolicies: z.array(versionPolicySchema).optional(),
});

export function parseConfig(content: string): ChronusConfig {
  const yaml = jsYaml.load(content);
  return schema.parse(yaml);
}

export async function resolveConfig(host: ChronusHost, rootDir: string) {
  const configPath = resolvePath(rootDir, ".chronus.yaml");
  let file;
  try {
    file = await host.readFile(configPath);
  } catch (e) {
    throw new ChronusError("Could not find .chronus.yaml");
  }
  return parseConfig(file.content);
}
