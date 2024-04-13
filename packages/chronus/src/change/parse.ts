import { parse } from "yaml";
import z from "zod";
import type { ChronusResolvedConfig } from "../config/types.js";
import { ChronusError } from "../utils/errors.js";
import type { File } from "../utils/host.js";
import { getBaseFileName } from "../utils/path-utils.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

const changeFrontMatterSchema = z.object({
  changeKind: z.string(),
  packages: z.array(z.string()),
});

function parseChangeFrontMatter(frontMatter: string, file: File): ChangeDescriptionFrontMatter {
  try {
    const yaml = parse(frontMatter);
    return changeFrontMatterSchema.parse(yaml);
  } catch (error) {
    throw new ChronusError(`Invalid Frontmatter for ${file}. Error: ${error}`);
  }
}

export function parseChangeDescription(config: ChronusResolvedConfig, file: File): ChangeDescription {
  const execResult = mdRegex.exec(file.content);
  if (!execResult) {
    throw new ChronusError(`Couldn't parse ${file.path}. Front matter is missing.`);
  }
  const [, frontMatterRaw, contentRaw] = execResult;
  const frontMatter = parseChangeFrontMatter(frontMatterRaw, file);

  const changeKind = config.changeKinds[frontMatter.changeKind];
  if (changeKind === undefined) {
    throw new ChronusError(
      `Change ${file.path} is using a changeKind ${frontMatter.changeKind} which is defined in the config. Available ones are:\n${Object.keys(config.changeKinds).join(", ")}`,
    );
  }

  const id = getBaseFileName(file.path).replace(/.md$/, "");
  return {
    ...frontMatter,
    id,
    changeKind,
    content: contentRaw.trim(),
  };
}
