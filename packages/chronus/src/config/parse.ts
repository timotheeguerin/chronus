import jsYaml from "js-yaml";
import z from "zod";
import type { ChronusConfig } from "./types.js";

const schema = z.object({});

export function parseConfig(content: string): ChronusConfig {
  const yaml = jsYaml.load(content);
  return schema.parse(yaml);
}
