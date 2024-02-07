import { load } from "js-yaml";
import z from "zod";
import type { ChronusResolvedConfig } from "../config/types.js";
import { ChronusError } from "../utils/errors.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

const changeFrontMatterSchema = z.object({
  changeKind: z.string(),
  packages: z.array(z.string()),
});

function parseChangeFrontMatter(frontMatter: string, filename: string): ChangeDescriptionFrontMatter {
  try {
    const yaml = load(frontMatter);
    return changeFrontMatterSchema.parse(yaml);
  } catch (error) {
    throw new ChronusError(`Invalid Frontmatter for ${filename}. Error: ${error}`);
  }
}

export function parseChangeDescription(
  config: ChronusResolvedConfig,
  content: string,
  filename: string,
): ChangeDescription {
  const execResult = mdRegex.exec(content);
  if (!execResult) {
    throw new ChronusError(`Couldn't parse ${filename}. Front matter is missing.`);
  }
  const [, frontMatterRaw, contentRaw] = execResult;
  const frontMatter = parseChangeFrontMatter(frontMatterRaw, filename);

  const changeKind = config.changeKinds[frontMatter.changeKind];
  if (changeKind === undefined) {
    throw new ChronusError(
      `Change ${filename} is using a changeKind ${frontMatter.changeKind} which is defined in the config. Available ones are:\n${Object.keys(config.changeKinds).join(", ")}`,
    );
  }
  return {
    ...frontMatter,
    changeKind,
    content: contentRaw.trim(),
  };
}
