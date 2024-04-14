import z from "zod";
import type { ChronusResolvedConfig } from "../config/types.js";
import { createEmbeddedFile, type EmbeddedFile, type TextFile } from "../file/index.js";
import { ChronusError } from "../utils/errors.js";
import { getBaseFileName } from "../utils/path-utils.js";
import { parseYaml } from "../yaml/parse.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

const changeFrontMatterSchema = z.object({
  changeKind: z.string(),
  packages: z.array(z.string()),
});

function parseChangeFrontMatter(content: EmbeddedFile | string): ChangeDescriptionFrontMatter {
  // try {
  const yaml = parseYaml(content);
  return changeFrontMatterSchema.parse(yaml.data);
  // } catch (error) {
  //   throw new ChronusError(`Invalid Frontmatter for ${file}. Error: ${error}`);
  // }
}

export function parseChangeDescription(config: ChronusResolvedConfig, file: TextFile): ChangeDescription {
  const execResult = mdRegex.exec(file.content);
  if (!execResult) {
    throw new ChronusError(`Couldn't parse ${file.path}. Front matter is missing.`);
  }
  const [, frontMatterRaw, contentRaw] = execResult;
  const pos = file.content.indexOf(frontMatterRaw);
  const frontMattterFile = createEmbeddedFile({ content: frontMatterRaw, file, pos, end: pos + frontMatterRaw.length });
  const frontMatter = parseChangeFrontMatter(frontMattterFile);

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
