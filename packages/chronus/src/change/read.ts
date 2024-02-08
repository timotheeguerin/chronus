import { dump } from "js-yaml";
import type { ChronusHost } from "../utils/host.js";
import { isDefined } from "../utils/misc-utils.js";
import type { ChronusWorkspace } from "../workspace/types.js";
import { parseChangeDescription } from "./parse.js";
import type { ChangeDescription, ChangeDescriptionFrontMatter } from "./types.js";

export interface PrintChangeDescriptionOptions {
  readonly frontMatterComment?: string;
}

export function printChangeDescription(change: Omit<ChangeDescription, "id">, options?: PrintChangeDescriptionOptions) {
  const frontMatter: ChangeDescriptionFrontMatter = {
    changeKind: change.changeKind.name,
    packages: change.packages,
  };
  const frontMatterComment = options?.frontMatterComment && `# ${options?.frontMatterComment}`;
  return ["---", frontMatterComment, dump(frontMatter, { quotingType: '"' }).trimEnd(), "---", "", change.content]
    .filter(isDefined)
    .join("\n");
}

export async function readChangeDescription(
  host: ChronusHost,
  workspace: ChronusWorkspace,
  filename: string,
): Promise<ChangeDescription> {
  const file = await host.readFile(filename);
  return parseChangeDescription(workspace.config, file);
}
